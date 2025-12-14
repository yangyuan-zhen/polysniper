import { queuedFetch } from './requestQueue';
import { polymarketWS, type PriceUpdate } from './polymarketWebSocket';

const TEAM_NAME_MAP: Record<string, string> = {
  '凯尔特人': 'Celtics',
  '快船': 'Clippers',
  '马刺': 'Spurs',
  '国王': 'Kings',
  '奇才': 'Wizards',
  '篮网': 'Nets',
  '火箭': 'Rockets',
  '魔术': 'Magic',
  '鹈鹕': 'Pelicans',
  '勇士': 'Warriors',
  '独行侠': 'Mavericks',
  '开拓者': 'Trail Blazers',
  '爵士': 'Jazz',
  '公牛': 'Bulls',
  '太阳': 'Suns',
  '老鹰': 'Hawks',
  '活塞': 'Pistons',
  '步行者': 'Pacers',
  '76人': '76ers',
  '骑士': 'Cavaliers',
  '猛龙': 'Raptors',
  '黄蜂': 'Hornets',
  '热火': 'Heat',
  '尼克斯': 'Knicks',
  '森林狼': 'Timberwolves',
  '雷霆': 'Thunder',
  '掘金': 'Nuggets',
  '灰熊': 'Grizzlies',
  '湖人': 'Lakers',
  '雄鹿': 'Bucks'
};

interface PolymarketEvent {
  id: string;
  title: string;
  slug: string;
  markets: PolymarketMarket[];
}

interface PolymarketMarket {
  id: string;
  question: string;
  outcomes: string[] | string; // Can be array or JSON string
  outcomePrices: string[] | string; // Can be array or JSON string
  volume24hr?: number;
  clobTokenIds?: string[] | string; // Can be array or JSON string
}

// Cache for NBA events to avoid repeated fetches
let nbaEventsCache: { events: PolymarketEvent[]; timestamp: number } | null = null;
const CACHE_DURATION = 5 * 1000; // 5 seconds - 降低缓存时间以获取更新的价格

export const getEnglishTeamName = (chineseName: string): string => {
  return TEAM_NAME_MAP[chineseName] || chineseName;
};

// WebSocket 价格缓存
const wsPriceCache = new Map<string, { price: string; timestamp: number }>();
const WS_CACHE_DURATION = 60000; // 60 秒缓存有效期

/**
 * 从 WebSocket 缓存获取价格
 */
const getPriceFromWSCache = (tokenId: string): string | null => {
  const cached = wsPriceCache.get(tokenId);
  if (!cached) return null;
  
  // 检查缓存是否过期
  if (Date.now() - cached.timestamp > WS_CACHE_DURATION) {
    wsPriceCache.delete(tokenId);
    return null;
  }
  
  return cached.price;
};

/**
 * 更新 WebSocket 价格缓存
 */
const updateWSPriceCache = (tokenId: string, price: string): void => {
  wsPriceCache.set(tokenId, {
    price,
    timestamp: Date.now()
  });
};

/**
 * Fetch CLOB price via REST API (Fallback only - WebSocket is preferred)
 * This is only used when WebSocket prices are unavailable
 */
const fetchClobPrice = async (tokenId: string, retries = 2): Promise<string | null> => {
  // 首先检查 WebSocket 缓存
  const wsPrice = getPriceFromWSCache(tokenId);
  if (wsPrice !== null) {
    return wsPrice;
  }
  const timeout = 5000; // 增加到5秒超时
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      const response = await queuedFetch(`/api/clob/price?token_id=${tokenId}&side=sell`, {
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        if (attempt === retries) return null;
        continue;
      }
      
      const data = await response.json();
      return data.price;
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.warn(`[Polymarket] CLOB price request timeout (attempt ${attempt + 1}/${retries + 1})`);
      } else {
        console.warn(`[Polymarket] Error fetching CLOB price (attempt ${attempt + 1}/${retries + 1}):`, error.message);
      }
      
      if (attempt === retries) {
        return null;
      }
      
      // 指数退避：500ms, 1000ms, 1500ms
      await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
    }
  }
  return null;
};

/**
 * 使用 WebSocket 订阅价格更新
 */
export const subscribeToMarketPrices = (
  tokenIds: string[],
  onUpdate: (tokenId: string, price: string) => void
): (() => void) => {
  if (tokenIds.length === 0) {
    return () => {};
  }
  
  // 确保 WebSocket 已连接
  if (polymarketWS.getConnectionState() === 'disconnected') {
    console.log('[WebSocket] 自动启动连接...');
    polymarketWS.connect();
  }
  
  // 为每个 tokenId 创建订阅
  const callbacks: Array<() => void> = [];
  
  tokenIds.forEach(tokenId => {
    const callback = (update: PriceUpdate) => {
      // 更新缓存
      updateWSPriceCache(update.tokenId, update.price);
      // 通知订阅者
      onUpdate(update.tokenId, update.price);
    };
    
    polymarketWS.subscribe(tokenId, callback);
    
    // 保存取消订阅函数
    callbacks.push(() => {
      polymarketWS.unsubscribe(tokenId, callback);
    });
  });
  
  // 返回统一的取消订阅函数
  return () => {
    callbacks.forEach(unsubscribe => unsubscribe());
  };
};

/**
 * Enrich market with CLOB prices via REST API (Fallback method)
 * Note: This is only used as fallback when WebSocket prices are unavailable
 * Prefer using subscribeToMarketPrices() which uses WebSocket
 */
const enrichWithClobPrices = async (market: PolymarketMarket, marketName?: string): Promise<PolymarketMarket> => {
  // If the market has CLOB token IDs, fetch live prices from CLOB
  if (!market.clobTokenIds) {
    return market;
  }

  // Parse clobTokenIds if it's a string
  let tokenIds: string[] = [];
  try {
    if (typeof market.clobTokenIds === 'string') {
      tokenIds = JSON.parse(market.clobTokenIds);
    } else if (Array.isArray(market.clobTokenIds)) {
      tokenIds = market.clobTokenIds;
    } else {
      return market;
    }
  } catch (e) {
    return market;
  }

  if (tokenIds.length === 0) {
    return market;
  }
  
  try {
    // Fetch prices via REST API (fallback method)
    if (marketName) {
      console.log(`[REST Fallback] Fetching prices for ${marketName}`);
    }
    const pricePromises = tokenIds.map(tokenId => fetchClobPrice(tokenId));
    const clobPrices = await Promise.all(pricePromises);

    // Validate CLOB prices - they should sum to approximately 1.0
    const validClobPrices = clobPrices.filter(p => p !== null);
    if (validClobPrices.length === clobPrices.length) {
      const sum = validClobPrices.reduce((acc, p) => acc + parseFloat(p!), 0);
      
      // Allow 3% tolerance for CLOB price variations
      if (Math.abs(sum - 1.0) > 0.03) {
        console.warn(`⚠️ CLOB价格验证失败: 总和=${(sum * 100).toFixed(1)}¢ (应为100¢), 回退到缓存价格`);
        return market;
      }
      
      // Normalize prices to sum to exactly 1.0
      if (Math.abs(sum - 1.0) > 0.001) {
        const normalizedPrices = clobPrices.map(p => {
          if (p === null) return null;
          return (parseFloat(p) / sum).toFixed(4);
        });
        // Use normalized prices instead
        clobPrices.splice(0, clobPrices.length, ...normalizedPrices);
      }
    } else {
      // 部分价格获取失败，回退到缓存价格
      console.warn(`⚠️ CLOB价格获取失败: ${validClobPrices.length}/${clobPrices.length} 成功, 回退到缓存价格`);
      return market;
    }

    // Parse outcomePrices if it's a string
    let currentPrices: string[] = [];
    try {
      if (typeof market.outcomePrices === 'string') {
        currentPrices = JSON.parse(market.outcomePrices);
      } else if (Array.isArray(market.outcomePrices)) {
        currentPrices = market.outcomePrices;
      } else {
        return market;
      }
    } catch (e) {
      return market;
    }

    // Update outcomePrices with CLOB prices if available
    const updatedPrices = currentPrices.map((price, index) => {
      const clobPrice = clobPrices[index];
      if (clobPrice !== null) {
        return clobPrice;
      }
      return price;
    });

    // 只在成功更新时记录一次
    if (marketName) {
      console.log(`[REST Fallback] ✓ ${marketName} REST API价格已更新`);
    }

    return {
      ...market,
      outcomePrices: updatedPrices
    };
  } catch (error) {
    console.error('Error enriching with CLOB prices:', error);
  }

  return market;
};

// Fetch all NBA events from Polymarket using tag_id
async function fetchNBAEvents(skipCache = false): Promise<PolymarketEvent[]> {
  // Check cache first (unless skipCache is true)
  if (!skipCache && nbaEventsCache && Date.now() - nbaEventsCache.timestamp < CACHE_DURATION) {
    return nbaEventsCache.events;
  }

  try {
    const url = `/api/polymarket/events?tag_id=745&closed=false&limit=100`;
    
    // 使用请求队列和重试机制
    const maxRetries = 2;
    const timeout = 8000; // 8秒超时
    
    let events: PolymarketEvent[] = [];
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        
        const response = await queuedFetch(url, {
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          if (attempt < maxRetries) continue; // 重试
          throw new Error(`Polymarket API error: ${response.status}`);
        }
        
        events = await response.json();
        break; // 成功，跳出循环
      } catch (error: any) {
        if (error.name === 'AbortError') {
          console.warn(`[Polymarket] Events request timeout (attempt ${attempt + 1}/${maxRetries + 1})`);
        } else {
          console.warn(`[Polymarket] Error fetching events (attempt ${attempt + 1}/${maxRetries + 1}):`, error.message);
        }
        
        if (attempt === maxRetries) {
          throw error; // 所有重试都失败
        }
        
        // 等待后重试
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
      }
    }
    
    // Filter for actual games (not futures) - games have "vs" or "vs." in title
    const gameEvents = events.filter((event: PolymarketEvent) => {
      const title = event.title || '';
      return title.includes(' vs ') || title.includes(' vs. ');
    });
    
    // Update cache
    nbaEventsCache = {
      events: gameEvents,
      timestamp: Date.now()
    };
    
    return gameEvents;
  } catch (error) {
    console.error('Error fetching NBA events:', error);
    return [];
  }
}

export const searchPolymarketMatch = async (homeTeam: string, awayTeam: string, forceRefresh = false): Promise<PolymarketMarket | null> => {
  const homeEn = getEnglishTeamName(homeTeam);
  const awayEn = getEnglishTeamName(awayTeam);

  try {
    // 定期输出节流器状态（仅在有排队时）
    // const stats = polymarketThrottler.getStats();
    // if (stats.queued > 5) {
    //   console.log(`[节流器] 队列:${stats.queued} 活跃:${stats.active}`);
    // }
    
    const events = await fetchNBAEvents(forceRefresh);
    
    // If no events (API blocked), return null
    if (events.length === 0) {
      return null;
    }
    
    // Find the event that contains both team names in the title
    const matchEvent = events.find(e => {
      const title = e.title || '';
      return title.includes(homeEn) && title.includes(awayEn);
    });

    if (!matchEvent || !matchEvent.markets.length) {
      return null;
    }

    // 只对特定比赛显示详细调试
    const isDebug = (homeEn === 'Thunder' && awayEn === 'Kings') || (homeEn === 'Kings' && awayEn === 'Thunder');
    
    if (isDebug) {
      console.log(`[调试] ${homeEn} vs ${awayEn} - 找到 ${matchEvent.markets.length} 个市场`);
    }
    
    // Find the "Winner" market (moneyline) - must have team names in outcomes
    // Filter out Over/Under, Spread, 1H, 2H, and other prop markets
    const winnerMarket = matchEvent.markets.find(m => {
      if (isDebug) {
        console.log(`  检查市场: "${m.question}"`);
      }
      
      const question = m.question.toLowerCase();
      
      // 排除非全场胜负盘（使用正则表达式单词边界匹配）
      if (/\bspread\b/.test(question)) {
        if (isDebug) console.log(`    ❌ 排除: 包含 spread`);
        return false;
      }
      if (/\bo\/u\b/.test(question) || /\bover\b/.test(question) || /\bunder\b/.test(question)) {
        if (isDebug) console.log(`    ❌ 排除: 包含 over/under`);
        return false;
      }
      if (/\b1h\b/.test(question) || question.includes('first half')) {
        if (isDebug) console.log(`    ❌ 排除: 上半场`);
        return false;
      }
      if (/\b2h\b/.test(question) || question.includes('second half')) {
        if (isDebug) console.log(`    ❌ 排除: 下半场`);
        return false;
      }
      if (/\btotal\b/.test(question)) {
        if (isDebug) console.log(`    ❌ 排除: 包含 total`);
        return false;
      }
      if (/\bhandicap\b/.test(question)) {
        if (isDebug) console.log(`    ❌ 排除: 包含 handicap`);
        return false;
      }
      if (/\bpoints?\b/.test(question)) {
        if (isDebug) console.log(`    ❌ 排除: 包含 points`);
        return false;
      }
      if (/\bquarter\b/.test(question)) {
        if (isDebug) console.log(`    ❌ 排除: 单节`);
        return false;
      }
      if (/\bmoneyline\b/.test(question) && /\b1h\b/.test(question)) {
        if (isDebug) console.log(`    ❌ 排除: 上半场 moneyline`);
        return false;
      }
      
      // Parse outcomes to check
      let outcomes: string[] = [];
      try {
        if (typeof m.outcomes === 'string') {
          outcomes = JSON.parse(m.outcomes);
        } else if (Array.isArray(m.outcomes)) {
          outcomes = m.outcomes;
        }
      } catch (e) {
        if (isDebug) console.log(`    ❌ 排除: 无法解析 outcomes`);
        return false;
      }
      
      if (isDebug) console.log(`    Outcomes: [${outcomes.join(', ')}]`);
      
      // 必须是恰好2个结果（不是3个或更多）
      if (outcomes.length !== 2) {
        if (isDebug) console.log(`    ❌ 排除: outcomes 数量 ${outcomes.length} (需要2个)`);
        return false;
      }
      
      // Check if outcomes contain team names (not "Over"/"Under", "Yes"/"No", etc)
      const hasHomeTeam = outcomes.some(o => o.includes(homeEn));
      const hasAwayTeam = outcomes.some(o => o.includes(awayEn));
      
      if (isDebug) console.log(`    包含 ${homeEn}? ${hasHomeTeam}, 包含 ${awayEn}? ${hasAwayTeam}`);
      
      if (hasHomeTeam && hasAwayTeam) {
        if (isDebug) console.log(`    ✅ 选中此市场！`);
        return true;
      } else {
        if (isDebug) console.log(`    ❌ 排除: 不包含球队名称`);
        return false;
      }
    });

    if (winnerMarket) {
      // Debug: 检查市场数据（更新前）
      const pricesBefore = typeof winnerMarket.outcomePrices === 'string' 
        ? JSON.parse(winnerMarket.outcomePrices) 
        : winnerMarket.outcomePrices;
      
      // Use REST API to get latest prices
      const enrichedMarket = await enrichWithClobPrices(winnerMarket, `${homeEn} vs ${awayEn}`);
      
      // 检查价格是否有更新
      const pricesAfter = typeof enrichedMarket.outcomePrices === 'string'
        ? JSON.parse(enrichedMarket.outcomePrices)
        : enrichedMarket.outcomePrices;
      
      const pricesChanged = JSON.stringify(pricesBefore) !== JSON.stringify(pricesAfter);
      
      console.log(`[市场] ${homeEn} vs ${awayEn}:`, {
        question: enrichedMarket.question,
        outcomes: enrichedMarket.outcomes,
        prices: pricesAfter,
        updated: pricesChanged ? '✓ CLOB' : '× 缓存'
      });
      
      return enrichedMarket;
    } else {
      // 只对有问题的比赛显示警告
      if (isDebug) {
        console.warn(`⚠️ 未找到Winner市场: ${homeEn} vs ${awayEn}`);
        console.warn(`  提示: 检查上面的日志看看为什么所有市场都被过滤了`);
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error searching Polymarket:', error);
    return null;
  }
};

export const getMarketPrice = async (marketId: string): Promise<PolymarketMarket | null> => {
  try {
    const response = await fetch(`/api/polymarket/markets/${marketId}`);
    if (!response.ok) throw new Error('Polymarket Market API error');
    const market = await response.json();
    return await enrichWithClobPrices(market);
  } catch (error) {
    console.error('Error fetching market price:', error);
    return null;
  }
};

// Helper to determine if price is bullish/bearish (mock logic replaced by real logic if possible)
// For "Winner", usually there are two outcomes.
// We need to map the price to the "Home" team or "Away" team specifically.
export const normalizeMarketData = (market: PolymarketMarket, homeTeamEn: string, awayTeamEn: string) => {
  // Parse outcomes. usually ["Team A", "Team B"]
  // We want the price of the HOME team for consistency, or return both.
  
  try {
    let outcomes: string[] = [];
    let prices: string[] = [];

    try {
        if (typeof market.outcomes === 'string') {
            outcomes = JSON.parse(market.outcomes);
        } else if (Array.isArray(market.outcomes)) {
            outcomes = market.outcomes;
        }
        
        if (typeof market.outcomePrices === 'string') {
            prices = JSON.parse(market.outcomePrices);
        } else if (Array.isArray(market.outcomePrices)) {
            prices = market.outcomePrices;
        }
    } catch (e) {
        console.error('解析 outcomes/prices 失败:', e);
        return { homePrice: "0.0", awayPrice: "0.0", homeRawPrice: 0, awayRawPrice: 0 };
    }
    
    // Find index of home team and away team
    const homeIndex = outcomes.findIndex((o: string) => o.includes(homeTeamEn));
    const awayIndex = outcomes.findIndex((o: string) => o.includes(awayTeamEn));
    
    let homePriceStr = "0";
    let awayPriceStr = "0";

    if (homeIndex !== -1) {
        homePriceStr = prices[homeIndex];
        // If 2 outcomes, assume the other is away if not found explicitly
        if (awayIndex === -1 && prices.length === 2) {
            awayPriceStr = prices[homeIndex === 0 ? 1 : 0];
        } else if (awayIndex !== -1) {
            awayPriceStr = prices[awayIndex];
        }
    } else if (awayIndex !== -1) {
        awayPriceStr = prices[awayIndex];
        if (prices.length === 2) {
            homePriceStr = prices[awayIndex === 0 ? 1 : 0];
        }
    } else {
        // Fallback: Assume first is Home, second is Away (or vice versa? unlikely to be random if we matched title)
        // Often market outcomes are sorted. Let's just take 0 and 1.
        homePriceStr = prices[0];
        awayPriceStr = prices[1] || "0";
    }
    
    const result = {
      homePrice: (parseFloat(homePriceStr) * 100).toFixed(1), // Convert to cents
      awayPrice: (parseFloat(awayPriceStr) * 100).toFixed(1),
      homeRawPrice: parseFloat(homePriceStr),
      awayRawPrice: parseFloat(awayPriceStr),
      outcomes: outcomes as string[],
      prices: prices as string[]
    };
    
    // Validate that prices sum to approximately 100%
    const priceSum = result.homeRawPrice + result.awayRawPrice;
    if (Math.abs(priceSum - 1.0) > 0.01) {
      console.warn(`⚠️ 价格异常 ${homeTeamEn} vs ${awayTeamEn}: ${(priceSum * 100).toFixed(1)}¢ (应该是100¢)`);
    }
    
    return result;
  } catch (e) {
    console.error("Error parsing market data", e);
    return { homePrice: "0.0", awayPrice: "0.0", homeRawPrice: 0, awayRawPrice: 0 };
  }
};

