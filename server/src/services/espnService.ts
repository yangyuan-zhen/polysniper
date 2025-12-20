import axios from 'axios';
import { config } from '../config';
import { logger } from '../utils/logger';
import { cache } from '../utils/cache';
import { ESPNData, InjuryReport, CacheKey } from '../types';

class ESPNService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = config.espn.apiUrl;
  }

  /**
   * 获取所有比赛的比分数据
   * @param dates 日期参数，格式 YYYYMMDD，不传则返回当天
   */
  async getScoreboard(dates?: string): Promise<any> {
    try {
      // 构造缓存键（包含日期）
      const cacheKey = dates ? `${CacheKey.ESPN_SCORES}:${dates}` : CacheKey.ESPN_SCORES;
      
      // 先检查缓存
      const cached = await cache.get(cacheKey);
      if (cached) {
        return cached;
      }

      const params: any = {};
      if (dates) {
        params.dates = dates;
      }

      const response = await axios.get(`${this.baseUrl}/scoreboard`, {
        params,
        timeout: 10000,
      });

      const data = response.data;
      
      // 缓存10秒
      await cache.set(cacheKey, data, 10);
      
      logger.debug(`已获取 ESPN 球队数据${dates ? ` (日期: ${dates})` : ''}`);
      return data;
    } catch (error) {
      logger.error('获取 ESPN 比分板失败:', error);
      throw error;
    }
  }

  /**
   * 获取特定比赛的胜率数据（使用 summary API）
   */
  async getGameWinProbability(gameId: string): Promise<ESPNData | null> {
    try {
      // 使用 summary API 获取详细数据
      const response = await axios.get(`${this.baseUrl}/summary`, {
        params: { event: gameId },
        timeout: 10000,
      });
      
      const summary = response.data;
      
      let homeWinProb = 0;
      let awayWinProb = 0;
      let pregameHomeWinProb = 0;
      let pregameAwayWinProb = 0;
      
      // 方法1: 从 winprobability 数组获取（最准确）
      if (summary.winprobability && summary.winprobability.length > 0) {
        // 第一个元素是赛前预测，最后一个是当前胜率
        const pregame = summary.winprobability[0];
        const current = summary.winprobability[summary.winprobability.length - 1];
        
        pregameHomeWinProb = pregame.homeWinPercentage || 0.5;
        pregameAwayWinProb = 1 - pregameHomeWinProb;
        
        homeWinProb = current.homeWinPercentage || pregameHomeWinProb;
        awayWinProb = 1 - homeWinProb;
        
        logger.debug(`[ESPN] WinProbability - 赛前: H${(pregameHomeWinProb * 100).toFixed(1)}% A${(pregameAwayWinProb * 100).toFixed(1)}%, 当前: H${(homeWinProb * 100).toFixed(1)}% A${(awayWinProb * 100).toFixed(1)}%`);
      }
      
      // 方法2: 从 pickcenter 的 moneyLine 计算胜率（备用）
      if (homeWinProb === 0 && summary.pickcenter && summary.pickcenter.length > 0) {
        const pick = summary.pickcenter[0];
        const homeMoneyLine = pick.homeTeamOdds?.moneyLine;
        const awayMoneyLine = pick.awayTeamOdds?.moneyLine;
        
        if (homeMoneyLine && awayMoneyLine) {
          // 将 American odds 转换为隐含概率
          homeWinProb = this.moneyLineToProb(homeMoneyLine);
          awayWinProb = this.moneyLineToProb(awayMoneyLine);
          
          // 归一化
          const total = homeWinProb + awayWinProb;
          homeWinProb = homeWinProb / total;
          awayWinProb = awayWinProb / total;
          
          pregameHomeWinProb = homeWinProb;
          pregameAwayWinProb = awayWinProb;
          
          logger.debug(`[ESPN] MoneyLine 计算胜率 - H:${(homeWinProb * 100).toFixed(1)}% A:${(awayWinProb * 100).toFixed(1)}%`);
        }
      }

      // 获取伤病数据
      const injuries = this.parseInjuriesFromSummary(summary.injuries);
      
      if (injuries.length > 0) {
        logger.debug(`[ESPN] 找到 ${injuries.length} 个伤病报告`);
      }
      
      // 即使胜率为 0，也返回数据（可能有伤病信息）
      const result = {
        homeWinProb,
        awayWinProb,
        pregameHomeWinProb,
        pregameAwayWinProb,
        injuries,
      };
      
      logger.debug(`[ESPN] 返回数据 - 胜率: ${homeWinProb > 0 ? 'Y' : 'N'}, 伤病: ${injuries.length}`);
      
      return result;
    } catch (error) {
      logger.error(`Failed to get win probability for game ${gameId}:`, error);
      return null;
    }
  }
  
  /**
   * 将 American Money Line 赔率转换为概率
   */
  private moneyLineToProb(moneyLine: number): number {
    if (moneyLine < 0) {
      // 负数表示热门，例如 -150 表示需要下注 150 赢 100
      return Math.abs(moneyLine) / (Math.abs(moneyLine) + 100);
    } else {
      // 正数表示冷门，例如 +150 表示下注 100 赢 150
      return 100 / (moneyLine + 100);
    }
  }
  
  /**
   * 从 summary API 的 injuries 数据解析
   */
  private parseInjuriesFromSummary(injuriesData: any[]): any[] {
    if (!injuriesData || injuriesData.length === 0) {
      return [];
    }
    
    const injuries: any[] = [];
    
    injuriesData.forEach((teamData: any) => {
      const team = teamData.team;
      const teamInjuries = teamData.injuries || [];
      
      teamInjuries.forEach((injury: any) => {
        injuries.push({
          ...injury,
          team: {
            id: team?.id,
            displayName: team?.displayName,
            abbreviation: team?.abbreviation,
          },
        });
      });
    });
    
    return injuries;
  }

  /**
   * 根据球队名称匹配比赛并获取胜率
   * @param gameDate 比赛日期，格式 YYYYMMDD，用于查询未来比赛
   */
  async getWinProbabilityByTeams(homeTeamName: string, awayTeamName: string, gameDate?: string): Promise<ESPNData | null> {
    try {
      logger.debug(`[ESPN] 查找比赛: ${homeTeamName} vs ${awayTeamName}${gameDate ? ` (日期: ${gameDate})` : ''}`);
      
      const scoreboard = await this.getScoreboard(gameDate);
      const game = scoreboard.events?.find((event: any) => {
        const competitors = event.competitions?.[0]?.competitors;
        const home = competitors?.find((c: any) => c.homeAway === 'home');
        const away = competitors?.find((c: any) => c.homeAway === 'away');
        
        return (
          home?.team?.displayName?.includes(homeTeamName) &&
          away?.team?.displayName?.includes(awayTeamName)
        );
      });

      if (!game) {
        logger.debug(`[ESPN] 未找到比赛: ${homeTeamName} vs ${awayTeamName}`);
        return null;
      }

      logger.debug(`[ESPN] 找到比赛 ID: ${game.id}, 调用 getGameWinProbability`);
      return this.getGameWinProbability(game.id);
    } catch (error) {
      logger.error(`Failed to get win probability by teams (${homeTeamName} vs ${awayTeamName}):`, error);
      return null;
    }
  }


  /**
   * 获取所有球队信息
   */
  async getAllTeams(): Promise<any> {
    try {
      const response = await axios.get(`${this.baseUrl}/teams`, {
        timeout: 10000,
      });

      return response.data.sports?.[0]?.leagues?.[0]?.teams || [];
    } catch (error) {
      logger.error('获取 ESPN 球队失败:', error);
      return [];
    }
  }

  /**
   * 获取特定球队信息
   */
  async getTeam(teamId: string): Promise<any> {
    try {
      const response = await axios.get(`${this.baseUrl}/teams/${teamId}`, {
        timeout: 10000,
      });

      return response.data.team;
    } catch (error) {
      logger.error(`Failed to fetch team ${teamId}:`, error);
      return null;
    }
  }
}

export const espnService = new ESPNService();
