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
   */
  async getScoreboard(): Promise<any> {
    try {
      // 先检查缓存
      const cached = await cache.get(CacheKey.ESPN_SCORES);
      if (cached) {
        return cached;
      }

      const response = await axios.get(`${this.baseUrl}/scoreboard`, {
        timeout: 10000,
      });

      const data = response.data;
      
      // 缓存10秒
      await cache.set(CacheKey.ESPN_SCORES, data, 10);
      
      logger.debug('已获取 ESPN 球队数据');
      return data;
    } catch (error) {
      logger.error('获取 ESPN 比分板失败:', error);
      throw error;
    }
  }

  /**
   * 获取特定比赛的胜率数据
   */
  async getGameWinProbability(gameId: string): Promise<ESPNData | null> {
    try {
      const scoreboard = await this.getScoreboard();
      const game = scoreboard.events?.find((event: any) => event.id === gameId);

      if (!game) {
        return null;
      }

      const competitions = game.competitions?.[0];
      
      // 从 situation.lastPlay.probability 获取胜率（ESPN 已返回小数形式）
      const probability = competitions?.situation?.lastPlay?.probability;
      const homeWinProb = probability?.homeWinPercentage || 0;
      const awayWinProb = probability?.awayWinPercentage || 0;

      return {
        homeWinProb,
        awayWinProb,
        pregameHomeWinProb: homeWinProb, // ESPN 只提供实时胜率
        pregameAwayWinProb: awayWinProb,
        injuries: await this.getInjuries(),
      };
    } catch (error) {
      logger.error(`Failed to get win probability for game ${gameId}:`, error);
      return null;
    }
  }

  /**
   * 根据球队名称匹配比赛并获取胜率
   */
  async getWinProbabilityByTeams(homeTeamName: string, awayTeamName: string): Promise<ESPNData | null> {
    try {
      const scoreboard = await this.getScoreboard();
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
        return null;
      }

      return this.getGameWinProbability(game.id);
    } catch (error) {
      logger.error('Failed to get win probability by teams:', error);
      return null;
    }
  }

  /**
   * 获取球员伤病报告
   */
  async getInjuries(): Promise<InjuryReport[]> {
    try {
      // 先检查缓存（伤病数据变化较慢，缓存30分钟）
      const cached = await cache.get<InjuryReport[]>(CacheKey.ESPN_INJURIES);
      if (cached) {
        return cached;
      }

      // ESPN 的伤病数据可能需要单独的 API 端点
      // 这里先返回空数组，实际使用时需要根据 ESPN API 文档调整
      const injuries: InjuryReport[] = [];

      await cache.set(CacheKey.ESPN_INJURIES, injuries, 1800); // 缓存30分钟
      
      return injuries;
    } catch (error) {
      logger.error('Failed to fetch injuries:', error);
      return [];
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
