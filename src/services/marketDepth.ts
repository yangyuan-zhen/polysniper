/**
 * Market Depth and Liquidity Analysis for NBA Markets
 * 
 * Provides order book analysis, spread monitoring, and trading momentum
 * to enhance signal confidence for NBA game predictions
 */

interface OrderBookLevel {
  price: string;
  size: string;
}

interface OrderBookData {
  market: string;
  asset_id: string;
  timestamp: string;
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  min_order_size: string;
  tick_size: string;
}

interface SpreadData {
  spread: string;
}

interface TradeData {
  side: 'BUY' | 'SELL';
  size: number;
  price: number;
  timestamp: number;
}

interface MarketDepthMetrics {
  spread: number;           // 买卖价差 (0-1)
  bidDepth: number;         // 买单总量
  askDepth: number;         // 卖单总量
  depthImbalance: number;   // 买卖失衡度 (-1 to 1, 正值=买方强)
  liquidity: 'high' | 'medium' | 'low';
  confidence: number;       // 信号置信度 (0-1)
}

interface TradingMomentum {
  buyPressure: number;      // 买方压力 (0-1)
  sellPressure: number;     // 卖方压力 (0-1)
  recentBuyVolume: number;  // 最近买入量
  recentSellVolume: number; // 最近卖出量
  momentum: 'bullish' | 'bearish' | 'neutral';
  bigTrades: number;        // 大额交易数量
}

/**
 * Fetch order book for a specific token
 * 添加重试机制和超时处理
 */
export async function fetchOrderBook(tokenId: string): Promise<OrderBookData | null> {
  const maxRetries = 2;
  const timeout = 5000; // 5秒超时
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      const response = await fetch(`/api/clob/book?token_id=${tokenId}`, {
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        if (attempt < maxRetries) continue; // 重试
        return null;
      }
      
      const data = await response.json();
      return data;
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.warn(`[Market Depth] Order book request timeout (attempt ${attempt + 1}/${maxRetries + 1})`);
      } else {
        console.warn(`[Market Depth] Error fetching order book (attempt ${attempt + 1}/${maxRetries + 1}):`, error.message);
      }
      
      if (attempt === maxRetries) {
        return null; // 所有重试都失败
      }
      
      // 等待后重试
      await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
    }
  }
  
  return null;
}

/**
 * Fetch spread for a specific token
 * 添加重试机制和超时处理
 */
export async function fetchSpread(tokenId: string): Promise<number | null> {
  const maxRetries = 2;
  const timeout = 5000; // 5秒超时
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      const response = await fetch(`/api/clob/spread?token_id=${tokenId}`, {
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        if (attempt < maxRetries) continue; // 重试
        return null;
      }
      
      const data: SpreadData = await response.json();
      return parseFloat(data.spread);
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.warn(`[Market Depth] Spread request timeout (attempt ${attempt + 1}/${maxRetries + 1})`);
      } else {
        console.warn(`[Market Depth] Error fetching spread (attempt ${attempt + 1}/${maxRetries + 1}):`, error.message);
      }
      
      if (attempt === maxRetries) {
        return null; // 所有重试都失败，返回null
      }
      
      // 等待后重试
      await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
    }
  }
  
  return null;
}

/**
 * Fetch recent trades for market analysis
 * 添加重试机制和超时处理
 */
export async function fetchRecentTrades(
  conditionId: string, 
  limit: number = 100
): Promise<TradeData[]> {
  const maxRetries = 2;
  const timeout = 5000; // 5秒超时
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      const response = await fetch(
        `/api/polymarket/trades?market=${conditionId}&limit=${limit}`,
        { signal: controller.signal }
      );
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        if (attempt < maxRetries) continue; // 重试
        return [];
      }
      
      const trades = await response.json();
      return trades.map((t: any) => ({
        side: t.side as 'BUY' | 'SELL',
        size: t.size,
        price: t.price,
        timestamp: t.timestamp
      }));
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.warn(`[Market Depth] Trades request timeout (attempt ${attempt + 1}/${maxRetries + 1})`);
      } else {
        console.warn(`[Market Depth] Error fetching trades (attempt ${attempt + 1}/${maxRetries + 1}):`, error.message);
      }
      
      if (attempt === maxRetries) {
        return []; // 所有重试都失败
      }
      
      // 等待后重试
      await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
    }
  }
  
  return [];
}

/**
 * Analyze market depth and calculate liquidity metrics
 */
export async function analyzeMarketDepth(tokenId: string): Promise<MarketDepthMetrics | null> {
  try {
    const [orderBook, spread] = await Promise.all([
      fetchOrderBook(tokenId),
      fetchSpread(tokenId)
    ]);

    if (!orderBook || spread === null) {
      return null;
    }

    // Calculate bid and ask depth
    const bidDepth = orderBook.bids.reduce((sum, level) => 
      sum + parseFloat(level.size), 0
    );
    const askDepth = orderBook.asks.reduce((sum, level) => 
      sum + parseFloat(level.size), 0
    );
    const totalDepth = bidDepth + askDepth;

    // Calculate depth imbalance (-1 to 1)
    // Positive = more buy orders (bullish), Negative = more sell orders (bearish)
    const depthImbalance = totalDepth > 0 
      ? (bidDepth - askDepth) / totalDepth 
      : 0;

    // Classify liquidity
    let liquidity: 'high' | 'medium' | 'low';
    if (totalDepth > 10000) liquidity = 'high';
    else if (totalDepth > 5000) liquidity = 'medium';
    else liquidity = 'low';

    // Calculate signal confidence based on spread and liquidity
    let confidence = 1.0;
    
    // Spread penalty
    if (spread > 0.05) confidence *= 0.6;      // 5%+ spread
    else if (spread > 0.03) confidence *= 0.8; // 3-5% spread
    else if (spread > 0.02) confidence *= 0.9; // 2-3% spread
    
    // Liquidity penalty
    if (liquidity === 'low') confidence *= 0.7;
    else if (liquidity === 'medium') confidence *= 0.85;

    return {
      spread,
      bidDepth,
      askDepth,
      depthImbalance,
      liquidity,
      confidence
    };
  } catch (error) {
    console.error('[Market Depth] Error analyzing market depth:', error);
    return null;
  }
}

/**
 * Analyze trading momentum from recent trades
 */
export async function analyzeTradingMomentum(
  conditionId: string,
  lookbackMinutes: number = 60
): Promise<TradingMomentum | null> {
  try {
    const trades = await fetchRecentTrades(conditionId, 200);
    if (trades.length === 0) return null;

    const now = Date.now();
    const cutoff = now - (lookbackMinutes * 60 * 1000);
    
    // Filter recent trades
    const recentTrades = trades.filter(t => t.timestamp * 1000 > cutoff);
    
    if (recentTrades.length === 0) return null;

    // Calculate volumes
    const buyVolume = recentTrades
      .filter(t => t.side === 'BUY')
      .reduce((sum, t) => sum + t.size * t.price, 0);
    
    const sellVolume = recentTrades
      .filter(t => t.side === 'SELL')
      .reduce((sum, t) => sum + t.size * t.price, 0);
    
    const totalVolume = buyVolume + sellVolume;

    // Calculate pressures
    const buyPressure = totalVolume > 0 ? buyVolume / totalVolume : 0.5;
    const sellPressure = totalVolume > 0 ? sellVolume / totalVolume : 0.5;

    // Determine momentum
    let momentum: 'bullish' | 'bearish' | 'neutral';
    if (buyPressure > 0.6) momentum = 'bullish';
    else if (sellPressure > 0.6) momentum = 'bearish';
    else momentum = 'neutral';

    // Count big trades (>$100 value)
    const bigTrades = recentTrades.filter(t => t.size * t.price > 100).length;

    return {
      buyPressure,
      sellPressure,
      recentBuyVolume: buyVolume,
      recentSellVolume: sellVolume,
      momentum,
      bigTrades
    };
  } catch (error) {
    console.error('[Market Depth] Error analyzing momentum:', error);
    return null;
  }
}

/**
 * Get comprehensive market analysis for NBA game
 * Combines depth, spread, and momentum analysis
 */
export async function getNBAMarketAnalysis(
  tokenId: string,
  conditionId: string
): Promise<{
  depth: MarketDepthMetrics | null;
  momentum: TradingMomentum | null;
  recommendation: string;
  confidence: number;
}> {
  const [depth, momentum] = await Promise.all([
    analyzeMarketDepth(tokenId),
    analyzeTradingMomentum(conditionId, 60)
  ]);

  // Calculate overall confidence
  let overallConfidence = 1.0;
  if (depth) {
    overallConfidence *= depth.confidence;
  } else {
    overallConfidence *= 0.5; // No depth data
  }

  // Generate recommendation
  let recommendation = '';
  
  if (depth) {
    if (depth.liquidity === 'low') {
      recommendation += '⚠️ 低流动性市场，价格可能不稳定。';
    }
    if (depth.spread > 0.05) {
      recommendation += '⚠️ 价差过大，建议谨慎交易。';
    }
    if (Math.abs(depth.depthImbalance) > 0.3) {
      const direction = depth.depthImbalance > 0 ? '买方' : '卖方';
      recommendation += `📊 订单簿${direction}占优 (${(Math.abs(depth.depthImbalance) * 100).toFixed(0)}%)。`;
    }
  }

  if (momentum) {
    if (momentum.momentum === 'bullish') {
      recommendation += '📈 近期买盘强劲。';
    } else if (momentum.momentum === 'bearish') {
      recommendation += '📉 近期卖盘压力大。';
    }
    if (momentum.bigTrades > 5) {
      recommendation += `💰 检测到${momentum.bigTrades}笔大额交易。`;
    }
  }

  if (recommendation === '') {
    recommendation = '✓ 市场状态正常';
  }

  return {
    depth,
    momentum,
    recommendation,
    confidence: overallConfidence
  };
}
