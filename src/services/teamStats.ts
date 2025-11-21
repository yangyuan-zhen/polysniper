import type { H2HGame } from '../types';


export interface TeamStats {
  teamName: string;
  recentGames: H2HGame[];
  wins: number;
  losses: number;
  winRate: number;
  avgScore: number;
  recentForm: string; // e.g., "WWLWW"
  lastUpdated: number;
}

// Calculate stats from games
export function calculateTeamStats(teamName: string, games: H2HGame[]): TeamStats {
  let wins = 0;
  let losses = 0;
  let totalScore = 0;
  const recentFormGames = games.slice(0, 5);
  const form: string[] = [];

  for (const game of games) {
    const isHome = game.home === teamName;
    const isWinner = game.winner === teamName;
    const teamScore = isHome ? game.homeScore : game.awayScore;

    if (isWinner) {
      wins++;
    } else {
      losses++;
    }

    totalScore += teamScore;
  }

  // Calculate form for last 5 games
  for (const game of recentFormGames) {
    const isWinner = game.winner === teamName;
    form.push(isWinner ? 'W' : 'L');
  }

  const totalGames = wins + losses;
  const winRate = totalGames > 0 ? wins / totalGames : 0;
  const avgScore = totalGames > 0 ? totalScore / totalGames : 0;

  return {
    teamName,
    recentGames: games,
    wins,
    losses,
    winRate,
    avgScore,
    recentForm: form.join(''),
    lastUpdated: Date.now(),
  };
}

// Get or fetch team stats (with caching using ESPN API)
export async function getOrFetchTeamStats(teamName: string, days: number = 30): Promise<TeamStats | null> {
  // Only use localStorage in browser
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    // Check cache first
    const cacheKey = `team_stats_${teamName}`;
    const cached = localStorage.getItem(cacheKey);

    if (cached) {
      const stats: TeamStats = JSON.parse(cached);
      const age = Date.now() - stats.lastUpdated;
      // Cache valid for 1 hour
      if (age < 60 * 60 * 1000) {
        console.log(`✅ Using cached stats for ${teamName}`);
        return stats;
      }
    }

    // Fetch fresh data from ESPN API
    console.log(`🔄 Fetching stats for ${teamName} from ESPN...`);
    const games = await getTeamRecentGames(teamName, days);

    if (games.length === 0) {
      console.warn(`⚠️ No games found for ${teamName}`);
      return null;
    }

    // Calculate stats from games
    const stats = calculateTeamStats(teamName, games);

    // Cache the result
    localStorage.setItem(cacheKey, JSON.stringify(stats));

    console.log(`✅ Successfully loaded stats for ${teamName}: ${stats.wins}W-${stats.losses}L (${(stats.winRate * 100).toFixed(1)}%)`);
    return stats;
  } catch (error) {
    console.error(`❌ Failed to fetch stats for ${teamName}:`, error);
    return null;
  }
}

// Prefetch stats for multiple teams in parallel
export async function prefetchTeamStats(teamNames: string[]): Promise<Map<string, TeamStats>> {
  const uniqueTeams = Array.from(new Set(teamNames));
  const statsMap = new Map<string, TeamStats>();

  console.log(`🔄 Prefetching stats for ${uniqueTeams.length} teams...`);

  // Fetch all teams in parallel
  const results = await Promise.allSettled(
    uniqueTeams.map(async (teamName) => {
      const stats = await getOrFetchTeamStats(teamName);
      return { teamName, stats };
    })
  );

  // Collect successful results
  for (const result of results) {
    if (result.status === 'fulfilled' && result.value.stats) {
      statsMap.set(result.value.teamName, result.value.stats);
    }
  }

  console.log(`✅ Prefetched stats for ${statsMap.size} teams`);

  return statsMap;
}

/**
 * 评估球队实力等级
 * 返回 1-5 的等级：5=强队, 1=弱队
 */
export function evaluateTeamStrength(stats: TeamStats | null): number {
  if (!stats) return 3; // 无数据，默认中等

  let score = 0;

  // 1. 胜率评分 (0-2分)
  if (stats.winRate >= 0.65) score += 2;      // 强队
  else if (stats.winRate >= 0.55) score += 1.5; // 中上
  else if (stats.winRate >= 0.45) score += 1;   // 中等
  else if (stats.winRate >= 0.35) score += 0.5; // 中下
  // < 0.35 = 0分 (弱队)

  // 2. 近期状态 (0-2分)
  const recentWins = (stats.recentForm.match(/W/g) || []).length;
  if (recentWins >= 4) score += 2;      // 近期很强
  else if (recentWins >= 3) score += 1.5; // 近期不错
  else if (recentWins >= 2) score += 1;   // 近期一般
  else if (recentWins >= 1) score += 0.5; // 近期较差
  // 0 wins = 0分

  // 3. 平均得分 (0-1分)
  if (stats.avgScore >= 115) score += 1;      // 进攻强
  else if (stats.avgScore >= 110) score += 0.75;
  else if (stats.avgScore >= 105) score += 0.5;
  else if (stats.avgScore >= 100) score += 0.25;
  // < 100 = 0分

  // 总分0-5，映射到1-5等级
  const level = Math.min(5, Math.max(1, Math.round(score) + 1));
  
  return level;
}

/**
 * 判断是否是强队（等级 >= 4）
 */
export function isStrongTeam(stats: TeamStats | null): boolean {
  return evaluateTeamStrength(stats) >= 4;
}

/**
 * 判断是否是弱队（等级 <= 2）
 */
export function isWeakTeam(stats: TeamStats | null): boolean {
  return evaluateTeamStrength(stats) <= 2;
}
