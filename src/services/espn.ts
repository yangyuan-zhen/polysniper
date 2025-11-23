import type { ESPNGame, H2HGame, TeamInjuries, PlayerInjury, WinProbability } from '../types';

const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports';

// ESPN Team ID mapping (中文名 -> ESPN Team ID)
const ESPN_TEAM_IDS: Record<string, { id: string; en: string }> = {
  '湖人': { id: '13', en: 'Los Angeles Lakers' },
  '勇士': { id: '9', en: 'Golden State Warriors' },
  '凯尔特人': { id: '2', en: 'Boston Celtics' },
  '篮网': { id: '17', en: 'Brooklyn Nets' },
  '尼克斯': { id: '18', en: 'New York Knicks' },
  '76人': { id: '20', en: 'Philadelphia 76ers' },
  '猛龙': { id: '28', en: 'Toronto Raptors' },
  '公牛': { id: '4', en: 'Chicago Bulls' },
  '骑士': { id: '5', en: 'Cleveland Cavaliers' },
  '活塞': { id: '8', en: 'Detroit Pistons' },
  '步行者': { id: '11', en: 'Indiana Pacers' },
  '雄鹿': { id: '15', en: 'Milwaukee Bucks' },
  '老鹰': { id: '1', en: 'Atlanta Hawks' },
  '黄蜂': { id: '30', en: 'Charlotte Hornets' },
  '热火': { id: '14', en: 'Miami Heat' },
  '魔术': { id: '19', en: 'Orlando Magic' },
  '奇才': { id: '27', en: 'Washington Wizards' },
  '掘金': { id: '7', en: 'Denver Nuggets' },
  '森林狼': { id: '16', en: 'Minnesota Timberwolves' },
  '雷霆': { id: '25', en: 'Oklahoma City Thunder' },
  '开拓者': { id: '22', en: 'Portland Trail Blazers' },
  '爵士': { id: '26', en: 'Utah Jazz' },
  '独行侠': { id: '6', en: 'Dallas Mavericks' },
  '火箭': { id: '10', en: 'Houston Rockets' },
  '灰熊': { id: '29', en: 'Memphis Grizzlies' },
  '鹈鹕': { id: '3', en: 'New Orleans Pelicans' },
  '马刺': { id: '24', en: 'San Antonio Spurs' },
  '快船': { id: '12', en: 'LA Clippers' },
  '国王': { id: '23', en: 'Sacramento Kings' },
  '太阳': { id: '21', en: 'Phoenix Suns' },
};

const normalizeName = (name: string) => name.toLowerCase().replace(/\s+/g, '');

// Get ESPN English team name from Chinese name
export const getESPNTeamName = (chineseName: string): string => {
  const team = ESPN_TEAM_IDS[chineseName];
  return team ? team.en : chineseName;
};

// Format date to YYYYMMDD
function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

// Fetch games by date for NBA
export async function fetchNBAGamesByDate(dateStr: string): Promise<ESPNGame[]> {
  try {
    const url = `${ESPN_BASE}/basketball/nba/scoreboard?dates=${dateStr}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`ESPN API error: ${response.status}`);
    }

    const data = await response.json();
    return data.events || [];
  } catch (error) {
    console.error('Error fetching ESPN games:', error);
    return [];
  }
}

// Get H2H games for a date range
export async function getH2HGamesFromESPN(
  teamA: string,
  teamB: string,
  startDate: Date,
  endDate: Date,
  onProgress?: (current: number, total: number) => void
): Promise<H2HGame[]> {
  const games: H2HGame[] = [];
  const currentDate = new Date(startDate);

  // Calculate total days to scan
  const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  let daysScanned = 0;

  while (currentDate <= endDate) {
    // Skip off-season months (July, August, September)
    const month = currentDate.getMonth();
    if (month >= 6 && month <= 8) {
      currentDate.setMonth(9); // Jump to October
      currentDate.setDate(1);
      continue;
    }

    const dateStr = formatDate(currentDate);
    const dayGames = await fetchNBAGamesByDate(dateStr);

    // Filter games that include both teams
    for (const game of dayGames) {
      if (!game.competitions || game.competitions.length === 0) continue;

      const competition = game.competitions[0];
      const competitors = competition.competitors;

      if (competitors.length !== 2) continue;

      const team1 = competitors[0].team.displayName;
      const team2 = competitors[1].team.displayName;

      // Check if this game involves both teams
      if (
        (team1 === teamA && team2 === teamB) ||
        (team1 === teamB && team2 === teamA)
      ) {
        const homeTeam = competitors.find(c => c.homeAway === 'home')!;
        const awayTeam = competitors.find(c => c.homeAway === 'away')!;

        games.push({
          date: competition.date.split('T')[0],
          home: homeTeam.team.displayName,
          away: awayTeam.team.displayName,
          homeScore: parseInt(homeTeam.score) || 0,
          awayScore: parseInt(awayTeam.score) || 0,
          winner: homeTeam.winner ? homeTeam.team.displayName : awayTeam.team.displayName,
          venue: competition.venue?.fullName,
          attendance: competition.attendance,
        });

        // If we found a game, we can report progress
        console.log(`✅ Found game: ${teamA} vs ${teamB} on ${competition.date.split('T')[0]}`);
      }
    }

    currentDate.setDate(currentDate.getDate() + 1);
    daysScanned++;

    // Report progress every 10 days
    if (onProgress && daysScanned % 10 === 0) {
      onProgress(daysScanned, totalDays);
    }

    // Reduce delay to speed up scanning
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  return games;
}

// Get recent games (last N days) - H2H only
export async function getRecentGames(
  teamA: string,
  teamB: string,
  days: number = 90
): Promise<H2HGame[]> {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  return getH2HGamesFromESPN(teamA, teamB, startDate, endDate);
}

// Get recent games for a single team (all games, not just H2H)
export async function getTeamRecentGames(
  teamName: string,
  days: number = 30
): Promise<H2HGame[]> {
  const games: H2HGame[] = [];
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  const currentDate = new Date(startDate);

  while (currentDate <= endDate) {
    // Skip off-season months (July, August, September)
    const month = currentDate.getMonth();
    if (month >= 6 && month <= 8) {
      currentDate.setMonth(9); // Jump to October
      currentDate.setDate(1);
      continue;
    }

    const dateStr = formatDate(currentDate);
    const dayGames = await fetchNBAGamesByDate(dateStr);

    // Filter games that include this team
    for (const game of dayGames) {
      if (!game.competitions || game.competitions.length === 0) continue;

      const competition = game.competitions[0];
      const competitors = competition.competitors;

      if (competitors.length !== 2) continue;

      const team1 = competitors[0].team.displayName;
      const team2 = competitors[1].team.displayName;

      // Check if this game involves the team (English name match)
      const espnTeamName = getESPNTeamName(teamName);
      if (team1 === espnTeamName || team2 === espnTeamName || team1 === teamName || team2 === teamName) {
        const homeTeam = competitors.find(c => c.homeAway === 'home')!;
        const awayTeam = competitors.find(c => c.homeAway === 'away')!;

        games.push({
          date: competition.date.split('T')[0],
          home: homeTeam.team.displayName,
          away: awayTeam.team.displayName,
          homeScore: parseInt(homeTeam.score) || 0,
          awayScore: parseInt(awayTeam.score) || 0,
          winner: homeTeam.winner ? homeTeam.team.displayName : awayTeam.team.displayName,
          venue: competition.venue?.fullName,
          attendance: competition.attendance,
        });
      }
    }

    currentDate.setDate(currentDate.getDate() + 1);

    // Reduce delay to speed up scanning
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  return games;
}

// Get current season games
export async function getCurrentSeasonGames(
  teamA: string,
  teamB: string
): Promise<H2HGame[]> {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  // NBA season starts in October
  const seasonStart = month >= 9 ? new Date(year, 9, 1) : new Date(year - 1, 9, 1);

  return getH2HGamesFromESPN(teamA, teamB, seasonStart, now);
}

// Get team injuries from ESPN
export async function getTeamInjuries(teamName: string): Promise<TeamInjuries | null> {
  try {
    const mappedMeta = ESPN_TEAM_IDS[teamName];
    let resolvedMeta: { id: string; en: string } | undefined = mappedMeta;

    if (!resolvedMeta) {
      // 尝试用英文名匹配
      const normalizedTarget = normalizeName(teamName);
      resolvedMeta = Object.values(ESPN_TEAM_IDS).find(meta => normalizeName(meta.en) === normalizedTarget);
    }

    if (!resolvedMeta) {
      console.warn(`No ESPN team ID found for: ${teamName}`);
      return null;
    }

    const teamId = resolvedMeta.id;
    const teamEnglishName = resolvedMeta.en;

    console.log(`🔄 Fetching injuries for ${teamName} (Team ID: ${teamId})...`);

    // ESPN injuries endpoint - returns all teams, we'll filter
    const url = `${ESPN_BASE}/basketball/nba/injuries`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`ESPN API error: ${response.status}`);
    }

    const data = await response.json();
    
    // Find the team injury data in the response
    // The structure is: { injuries: [ { id, displayName, injuries: [...] }, ... ] }
    const teamInjuries = data.injuries || [];
    
    if (teamInjuries.length === 0) {
      console.warn('⚠️ ESPN returned no injury data');
    }

    // Find our specific team (loose equality for ID to handle string/number mismatch)
    const normalizedEnglish = normalizeName(teamEnglishName);
    const teamInjuryData = teamInjuries.find((ti: any) => {
      const idMatch = ti.id != null && ti.id.toString() === teamId;
      const nameMatch = ti.displayName && normalizeName(ti.displayName) === normalizedEnglish;
      return idMatch || nameMatch;
    });

    if (!teamInjuryData) {
      console.log(`ℹ️ No injury data found for ${teamName} (ID: ${teamId}) in ${teamInjuries.length} teams`);
      // Log available team IDs for debugging
      if (teamInjuries.length > 0) {
        const availableIds = teamInjuries.map((ti: any) => ti.id).slice(0, 5);
        console.log('  Available IDs sample:', availableIds);
      }
      return { teamId, teamName: teamEnglishName || teamName, injuries: [] };
    }

    // Extract injuries using the correct structure
    const injuries: PlayerInjury[] = [];
    const injuryList = teamInjuryData.injuries || [];

    for (const injury of injuryList) {
      // Handle status being a string or object
      let status = 'Unknown';
      if (typeof injury.status === 'string') {
        status = injury.status;
      } else if (typeof injury.status === 'object' && injury.status !== null) {
        status = injury.status.name || injury.status.description || injury.status.type || 'Unknown';
      }

      injuries.push({
        athleteId: injury.athlete?.id || '',
        athleteName: injury.athlete?.fullName || injury.athlete?.displayName || injury.athlete?.name || 'Unknown',
        position: injury.athlete?.position?.abbreviation,
        jersey: injury.athlete?.jersey,
        status: status,
        date: injury.date || injury.updateDate,
        details: injury.shortComment || injury.longComment || injury.details || injury.description,
        headshot: injury.athlete?.headshot?.href || injury.athlete?.headshot,
      });
    }

    console.log(`✅ Found ${injuries.length} injuries for ${teamName}`);

    return {
      teamId: teamInjuryData.id?.toString() || teamId,
      teamName: teamInjuryData.displayName || teamEnglishName || teamName,
      injuries,
    };
  } catch (error) {
    console.error(`Error fetching injuries for ${teamName}:`, error);
    return null;
  }
}

/**
 * 从赔率计算隐含胜率
 * @param moneyline 美式赔率（例如：-150 或 +200）
 * @returns 胜率 (0-1)
 */
function calculateImpliedProbability(moneyline: number): number {
  if (moneyline < 0) {
    // 负数赔率（热门队）：例如 -150 表示需要下注 150 才能赢 100
    return Math.abs(moneyline) / (Math.abs(moneyline) + 100);
  } else {
    // 正数赔率（冷门队）：例如 +200 表示下注 100 能赢 200
    return 100 / (moneyline + 100);
  }
}

/**
 * 获取比赛胜率预测
 * - 比赛进行中：返回实时胜率（ESPN live win probability）
 * - 比赛未开始：返回赛前预测胜率（基于赔率计算）
 */
export async function getGameWinProbability(homeTeam: string, awayTeam: string): Promise<WinProbability | null> {
  try {
    // Use scoreboard API without date to get current games
    const url = `${ESPN_BASE}/basketball/nba/scoreboard`;
    const response = await fetch(url);

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const events = data.events || [];

    // Find the game by team names
    const game = events.find((event: any) => {
      const competitors = event.competitions?.[0]?.competitors || [];
      if (competitors.length !== 2) return false;

      const team1 = competitors[0].team.displayName;
      const team2 = competitors[1].team.displayName;

      // Check if both teams match
      return (
        (team1 === homeTeam || team1 === awayTeam) &&
        (team2 === homeTeam || team2 === awayTeam)
      );
    });

    if (!game) {
      console.log(`⚠️ Game not found: ${homeTeam} vs ${awayTeam}`);
      return null;
    }

    const gameId = game.id;
    console.log(`✅ Found game ID: ${gameId} for ${homeTeam} vs ${awayTeam}`);

    // Fetch game summary for win probability
    const summaryUrl = `${ESPN_BASE}/basketball/nba/summary?event=${gameId}`;
    const summaryRes = await fetch(summaryUrl);

    if (!summaryRes.ok) {
      return null;
    }

    const summaryData = await summaryRes.json();
    const winProbArray = summaryData.winprobability;

    // 如果有实时胜率数据（比赛进行中），使用实时数据
    if (winProbArray && winProbArray.length > 0) {
      const latest = winProbArray[winProbArray.length - 1];
      console.log(`📊 Live win probability: Home ${(latest.homeWinPercentage * 100).toFixed(1)}%`);
      
      return {
        homeWinPercentage: latest.homeWinPercentage || 0.5,
        tiePercentage: latest.tiePercentage || 0,
        playId: latest.playId,
      };
    }

    // 没有实时数据，尝试从赔率计算赛前预测
    console.log(`ℹ️ No live win probability, trying pregame odds for game ${gameId}`);
    const odds = game.competitions?.[0]?.odds?.[0];
    
    if (odds && odds.homeTeamOdds?.moneyLine) {
      const homeML = odds.homeTeamOdds.moneyLine;
      const homeWinPercentage = calculateImpliedProbability(homeML);
      
      console.log(`📊 Pregame win probability (from odds ${homeML}): Home ${(homeWinPercentage * 100).toFixed(1)}%`);
      
      return {
        homeWinPercentage,
        tiePercentage: 0,
        playId: 'pregame',
      };
    }

    console.log(`⚠️ No win probability or odds data available for game ${gameId}`);
    return null;
  } catch (error) {
    console.error('Error fetching win probability:', error);
    return null;
  }
}
