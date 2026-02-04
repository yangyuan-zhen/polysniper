import axios from "axios";
import { logger } from "../utils/logger";
import { config } from "../config";
import { cache } from "../utils/cache";
import { ESPNData, CacheKey } from "../../../shared/types/index";

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
      // 注意：不缓存实时数据（比分、时间、胜率）
      // 这些数据需要实时获取，由调用方控制请求频率（节流）

      const params: any = {};
      if (dates) {
        params.dates = dates;
      }

      // 发起请求
      const response = await axios.get(`${this.baseUrl}/scoreboard`, {
        params,
        timeout: 10000,
      });

      const data = response.data;

      logger.debug(`已获取 ESPN 球队数据${dates ? ` (日期: ${dates})` : ""}`);
      return data;
    } catch (error) {
      logger.error("获取 ESPN 比分板失败:", error);
      throw error;
    }
  }

  /**
   * 获取特定比赛的胜率数据（使用 summary API）
   */
  async getGameWinProbability(
    gameId: string,
  ): Promise<{ prob: ESPNData; odds?: any } | null> {
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

      // 1. 获取博彩赔率 (From PickCenter) - 这是一个非常棒的公开赔率源
      let oddsData: any = undefined;
      if (summary.pickcenter && summary.pickcenter.length > 0) {
        const sources: any[] = [];
        summary.pickcenter.forEach((pick: any) => {
          const homeML = pick.homeTeamOdds?.moneyLine;
          const awayML = pick.awayTeamOdds?.moneyLine;

          if (homeML && awayML) {
            const hProb = this.moneyLineToProb(homeML);
            const aProb = this.moneyLineToProb(awayML);
            const total = hProb + aProb;

            sources.push({
              bookmaker: pick.provider?.name || "Unknown",
              homeOdds: homeML, // American format
              awayOdds: awayML, // American format
              homeProb: hProb / total,
              awayProb: aProb / total,
              lastUpdate: Date.now(),
            });
          }
        });

        if (sources.length > 0) {
          oddsData = {
            sources,
            averageHomeProb:
              sources.reduce((s, o) => s + o.homeProb, 0) / sources.length,
            averageAwayProb:
              sources.reduce((s, o) => s + o.awayProb, 0) / sources.length,
            bestHomeProb: Math.max(...sources.map((o) => o.homeProb)),
          };
        }
      }

      // 2. 获取统计胜率 (From ESPN Analytics)
      if (summary.winprobability && summary.winprobability.length > 0) {
        const pregame = summary.winprobability[0];
        const current =
          summary.winprobability[summary.winprobability.length - 1];

        pregameHomeWinProb = pregame.homeWinPercentage || 0.5;
        pregameAwayWinProb = 1 - pregameHomeWinProb;

        homeWinProb = current.homeWinPercentage || pregameHomeWinProb;
        awayWinProb = 1 - homeWinProb;

        logger.debug(
          `[ESPN] WinProbability - 当前: H${(homeWinProb * 100).toFixed(1)}% A${(awayWinProb * 100).toFixed(1)}%`,
        );
      }

      // 备用：如果无统计胜率，使用博彩胜率填充
      if (homeWinProb === 0 && oddsData) {
        homeWinProb = oddsData.averageHomeProb;
        awayWinProb = oddsData.averageAwayProb;
        pregameHomeWinProb = homeWinProb;
        pregameAwayWinProb = awayWinProb;
      }

      const probResult: ESPNData = {
        homeWinProb,
        awayWinProb,
        pregameHomeWinProb,
        pregameAwayWinProb,
      };

      return { prob: probResult, odds: oddsData };
    } catch (error) {
      logger.error(`Failed to get data for game ${gameId}:`, error);
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
   * 根据球队名称匹配比赛并获取胜率
   * @param gameDate 比赛日期，格式 YYYYMMDD，用于查询未来比赛
   */
  async getWinProbabilityByTeams(
    homeTeamName: string,
    awayTeamName: string,
    gameDate?: string,
  ): Promise<{ prob: ESPNData; odds?: any } | null> {
    try {
      logger.debug(
        `[ESPN] 查找比赛: ${homeTeamName} vs ${awayTeamName}${gameDate ? ` (日期: ${gameDate})` : ""}`,
      );

      const scoreboard = await this.getScoreboard(gameDate);
      const game = scoreboard.events?.find((event: any) => {
        const competitors = event.competitions?.[0]?.competitors;
        const home = competitors?.find((c: any) => c.homeAway === "home");
        const away = competitors?.find((c: any) => c.homeAway === "away");

        return (
          home?.team?.displayName?.includes(homeTeamName) &&
          away?.team?.displayName?.includes(awayTeamName)
        );
      });

      if (!game) {
        logger.debug(`[ESPN] 未找到比赛: ${homeTeamName} vs ${awayTeamName}`);
        return null;
      }

      logger.debug(
        `[ESPN] 找到比赛 ID: ${game.id}, 调用 getGameWinProbability`,
      );
      return this.getGameWinProbability(game.id);
    } catch (error) {
      logger.error(
        `Failed to get win probability by teams (${homeTeamName} vs ${awayTeamName}):`,
        error,
      );
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
      logger.error("获取 ESPN 球队失败:", error);
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
