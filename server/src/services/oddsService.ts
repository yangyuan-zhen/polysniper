import axios from "axios";
import { logger } from "../utils/logger";
import { config } from "../config";
import { BettingOdds, OddsSource } from "../../../shared/types/index";

class OddsService {
  private lastFetchTime: number = 0;
  private cachedOdds: Map<string, BettingOdds> = new Map();
  private FETCH_INTERVAL = 30000; // 30秒更新一次赔率，避免 API 额度消耗太快

  /**
   * 获取 NBA 比赛赔率
   * @returns 比赛 ID 到赔率数据的映射
   */
  async getNBAOdds(): Promise<Map<string, BettingOdds>> {
    const now = Date.now();
    if (
      now - this.lastFetchTime < this.FETCH_INTERVAL &&
      this.cachedOdds.size > 0
    ) {
      return this.cachedOdds;
    }

    if (!config.odds.apiKey) {
      logger.warn("⚠️ 未配置 THE_ODDS_API_KEY，跳过博彩赔率获取");
      return new Map();
    }

    try {
      logger.info("🏆 正在从 The Odds API 获取赔率...");
      const response = await axios.get(
        `${config.odds.apiUrl}/basketball_nba/odds/`,
        {
          params: {
            apiKey: config.odds.apiKey,
            regions: config.odds.regions,
            markets: config.odds.markets,
            bookmakers: config.odds.bookmakers,
            oddsFormat: "decimal",
          },
        },
      );

      const oddsMap = new Map<string, BettingOdds>();
      const games = response.data;

      for (const game of games) {
        // 使用队名作为 key
        const homeTeam = game.home_team;
        const awayTeam = game.away_team;
        const key = `${homeTeam}_vs_${awayTeam}`;

        const sources: OddsSource[] = [];

        for (const bookmaker of game.bookmakers) {
          const market = bookmaker.markets.find((m: any) => m.key === "h2h");
          if (!market) continue;

          const homeOutcome = market.outcomes.find(
            (o: any) => o.name === homeTeam,
          );
          const awayOutcome = market.outcomes.find(
            (o: any) => o.name === awayTeam,
          );

          if (homeOutcome && awayOutcome) {
            const homeOdds = homeOutcome.price;
            const awayOdds = awayOutcome.price;

            // 计算包含抽水的概率
            const rawHomeProb = 1 / homeOdds;
            const rawAwayProb = 1 / awayOdds;
            const totalRawProb = rawHomeProb + rawAwayProb;

            // 剔除抽水 (Vig/Margin) 后的真实概率
            const homeProb = rawHomeProb / totalRawProb;
            const awayProb = rawAwayProb / totalRawProb;

            sources.push({
              bookmaker: bookmaker.title,
              homeOdds,
              awayOdds,
              homeProb,
              awayProb,
              lastUpdate: new Date(bookmaker.last_update).getTime(),
            });
          }
        }

        if (sources.length > 0) {
          const avgHomeProb =
            sources.reduce((sum, s) => sum + s.homeProb, 0) / sources.length;
          const avgAwayProb =
            sources.reduce((sum, s) => sum + s.awayProb, 0) / sources.length;
          const bestHomeProb = Math.max(...sources.map((s) => s.homeProb));

          oddsMap.set(key, {
            sources,
            averageHomeProb: avgHomeProb,
            averageAwayProb: avgAwayProb,
            bestHomeProb: bestHomeProb,
          });
        }
      }

      this.cachedOdds = oddsMap;
      this.lastFetchTime = now;
      logger.info(`✅ 成功获取 ${oddsMap.size} 场比赛的博彩赔率`);
      return oddsMap;
    } catch (error: any) {
      logger.error("❌ 获取赔率失败:", error.message);
      return this.cachedOdds; // 返回旧缓存
    }
  }

  /**
   * 匹配队名（模糊匹配或映射）
   */
  findOddsForTeams(
    homeTeamName: string,
    awayTeamName: string,
    oddsMap: Map<string, BettingOdds>,
  ): BettingOdds | undefined {
    // 尝试直接匹配
    const directKey = `${homeTeamName}_vs_${awayTeamName}`;
    if (oddsMap.has(directKey)) return oddsMap.get(directKey);

    // 尝试反向（有些 API 顺序不同）
    const reverseKey = `${awayTeamName}_vs_${homeTeamName}`;
    if (oddsMap.has(reverseKey)) {
      const odds = oddsMap.get(reverseKey);
      if (odds) {
        // 需要调换主客队概率
        return {
          sources: odds.sources.map((s) => ({
            ...s,
            homeOdds: s.awayOdds,
            awayOdds: s.homeOdds,
            homeProb: s.awayProb,
            awayProb: s.homeProb,
          })),
          averageHomeProb: odds.averageAwayProb,
          averageAwayProb: odds.averageHomeProb,
          bestHomeProb: 1 - Math.min(...odds.sources.map((s) => s.homeProb)), // 这是一个近似
        };
      }
    }

    // 模糊匹配：只要包含关键队名（如 "Lakers" 匹配 "Los Angeles Lakers"）
    for (const [key, value] of oddsMap.entries()) {
      const [oHome, oAway] = key.split("_vs_");
      if (
        (oHome.includes(homeTeamName) || homeTeamName.includes(oHome)) &&
        (oAway.includes(awayTeamName) || awayTeamName.includes(oAway))
      ) {
        return value;
      }
    }

    return undefined;
  }
}

export const oddsService = new OddsService();
