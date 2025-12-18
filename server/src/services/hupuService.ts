import axios from 'axios';
import { config } from '../config';
import { logger } from '../utils/logger';
import { cache } from '../utils/cache';
import { HupuScoreData, MatchStatus, CacheKey } from '../types';

class HupuService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = config.hupu.apiUrl;
  }

  /**
   * 获取NBA赛程列表
   */
  async getSchedule(date?: string): Promise<any> {
    try {
      // 先检查缓存（3秒缓存）
      const cacheKey = `${CacheKey.HUPU_SCHEDULE}:${date || 'today'}`;
      const cached = await cache.get(cacheKey);
      if (cached) {
        return cached;
      }

      const params: any = {
        competitionTag: 'nba',
      };

      if (date) {
        params.date = date; // 格式: YYYY-MM-DD
      }

      const response = await axios.get(`${this.baseUrl}/scheduleList`, {
        params,
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
        },
      });

      const data = response.data;
      
      // 缓存3秒
      await cache.set(cacheKey, data, 3);
      
      logger.debug('已获取虎扑赛程数据');
      return data;
    } catch (error) {
      logger.error('获取虎扑赛程失败:', error);
      throw error;
    }
  }

  /**
   * 获取所有比赛（扁平化）
   */
  async getAllGames(): Promise<any[]> {
    try {
      const schedule = await this.getSchedule();
      const gameList = schedule.result?.gameList || [];
      
      // 扁平化所有日期的比赛
      const allGames: any[] = [];
      gameList.forEach((dayData: any) => {
        const matchList = dayData.matchList || [];
        allGames.push(...matchList);
      });
      
      return allGames;
    } catch (error) {
      logger.error('获取所有比赛失败:', error);
      return [];
    }
  }

  /**
   * 获取特定比赛的比分数据
   */
  async getGameScore(gameId: string): Promise<HupuScoreData | null> {
    try {
      const allGames = await this.getAllGames();
      const game = allGames.find((g: any) => g.matchId === gameId);

      if (!game) {
        return null;
      }

      return this.parseGameScore(game);
    } catch (error) {
      logger.error(`获取比赛 ${gameId} 失败:`, error);
      return null;
    }
  }

  /**
   * 根据球队名称匹配比赛
   */
  async getGameByTeams(homeTeamName: string, awayTeamName: string): Promise<HupuScoreData | null> {
    try {
      const allGames = await this.getAllGames();

      const game = allGames.find((g: any) => {
        const homeTeam = g.homeTeamName || '';
        const awayTeam = g.awayTeamName || '';
        
        return (
          homeTeam.includes(homeTeamName) &&
          awayTeam.includes(awayTeamName)
        );
      });

      if (!game) {
        return null;
      }

      return this.parseGameScore(game);
    } catch (error) {
      logger.error('根据球队获取比赛失败:', error);
      return null;
    }
  }

  /**
   * 解析虎扑比赛数据（增强版，包含完整时间信息）
   */
  private parseGameScore(game: any): HupuScoreData {
    const homeScore = parseInt(game.homeScore || '0', 10);
    const awayScore = parseInt(game.awayScore || '0', 10);
    
    // 虎扑 matchStatus: "NOTSTARTED", "COMPLETED", "LIVE" 等
    let status: MatchStatus;
    const matchStatus = game.matchStatus || '';
    
    if (matchStatus === 'NOTSTARTED') {
      status = MatchStatus.PRE;
    } else if (matchStatus === 'COMPLETED') {
      status = MatchStatus.FINAL;
    } else {
      status = MatchStatus.LIVE;
    }

    // 解析节次信息
    const currentQuarter = game.currentQuarter || 1;
    const quarter = this.parseQuarterFromNumber(currentQuarter, matchStatus);
    
    // 解析时间信息
    let timeRemaining = '';
    
    if (matchStatus === 'NOTSTARTED') {
      // 未开始：显示开始时间
      const matchTime = game.matchTime || '';
      timeRemaining = matchTime; // 如 "2025-12-15 08:00:00"
    } else if (matchStatus === 'COMPLETED') {
      // 已结束：显示比赛耗时
      const costTime = game.costTime || '';
      timeRemaining = costTime; // 如 "2:06"
    } else {
      // 进行中：显示当前时间状态
      // 虎扑提供 matchStatusChinese 如 "第四节 05:30"
      const statusChinese = game.matchStatusChinese || '';
      const costTime = game.costTime || '';
      timeRemaining = statusChinese || costTime || 'LIVE';
    }

    return {
      homeScore,
      awayScore,
      quarter,
      timeRemaining,
      status,
    };
  }

  /**
   * 从数字解析节次
   */
  private parseQuarterFromNumber(quarterNum: number, matchStatus: string): string {
    if (matchStatus === 'NOTSTARTED') return '未开始';
    if (matchStatus === 'COMPLETED') return 'FINAL';
    
    if (quarterNum <= 4) {
      return `Q${quarterNum}`;
    } else {
      return `OT${quarterNum - 4}`;
    }
  }


  /**
   * 获取所有今日比赛
   */
  async getTodayGames(): Promise<HupuScoreData[]> {
    try {
      const allGames = await this.getAllGames();
      
      // 获取今天的日期（格式：YYYYMMDD）
      const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
      
      // 筛选今天的比赛
      const todayGames = allGames.filter((game: any) => {
        const gameDate = new Date(game.chinaStartTime).toISOString().split('T')[0].replace(/-/g, '');
        return gameDate === today;
      });

      return todayGames.map((game: any) => this.parseGameScore(game));
    } catch (error) {
      logger.error('获取今日比赛失败:', error);
      return [];
    }
  }

  /**
   * 获取正在进行的比赛
   */
  async getLiveGames(): Promise<any[]> {
    try {
      const allGames = await this.getAllGames();
      return allGames.filter((game: any) => {
        const status = game.matchStatus || '';
        return status !== 'NOTSTARTED' && status !== 'COMPLETED';
      });
    } catch (error) {
      logger.error('获取进行中比赛失败:', error);
      return [];
    }
  }

  /**
   * 获取比赛的详细信息（包含所有字段）
   */
  getGameDetails(game: any): any {
    return {
      // 基础信息
      matchId: game.matchId,
      homeTeamId: game.homeTeamId,
      awayTeamId: game.awayTeamId,
      homeTeamName: game.homeTeamName,
      awayTeamName: game.awayTeamName,
      homeTeamLogo: game.homeTeamLogo,
      awayTeamLogo: game.awayTeamLogo,
      
      // 比分
      homeScore: parseInt(game.homeScore || '0', 10),
      awayScore: parseInt(game.awayScore || '0', 10),
      
      // 状态
      matchStatus: game.matchStatus,
      matchStatusChinese: game.matchStatusChinese,
      
      // 时间信息
      currentQuarter: game.currentQuarter,
      matchTime: game.matchTime, // 开始时间：2025-12-15 08:00:00
      costTime: game.costTime, // 比赛耗时：2:06
      chinaStartTime: game.chinaStartTime, // 时间戳（毫秒）
      beginTime: game.beginTime, // 时间戳（秒）
      
      // 其他
      winTeamName: game.winTeamName,
      gdcId: game.gdcId,
      leagueType: game.leagueType,
    };
  }
}

export const hupuService = new HupuService();
