/**
 * 比赛 ID 生成器
 * 生成统一的比赛 ID 格式：{HOME_TEAM}-{AWAY_TEAM}-{DATE}
 */

import { TeamMapping } from '../config/teamMappings';

/**
 * 生成比赛 ID
 * @param homeTeam 主队映射
 * @param awayTeam 客队映射
 * @param date 比赛日期（可选，默认今天）
 * @returns 比赛 ID，例如：LAL-GSW-20231215
 */
export function generateMatchId(
  homeTeam: TeamMapping,
  awayTeam: TeamMapping,
  date?: Date
): string {
  const matchDate = date || new Date();
  const dateStr = matchDate.toISOString().split('T')[0].replace(/-/g, '');
  
  return `${homeTeam.id}-${awayTeam.id}-${dateStr}`;
}

/**
 * 从ESPN事件生成比赛ID
 */
export function generateMatchIdFromESPN(
  homeTeamName: string,
  awayTeamName: string,
  dateStr: string
): string {
  // 简化版本，直接使用缩写
  const home = homeTeamName.substring(0, 3).toUpperCase();
  const away = awayTeamName.substring(0, 3).toUpperCase();
  const date = new Date(dateStr).toISOString().split('T')[0].replace(/-/g, '');
  
  return `${home}-${away}-${date}`;
}

/**
 * 解析比赛 ID
 */
export function parseMatchId(matchId: string): {
  homeTeamId: string;
  awayTeamId: string;
  date: string;
} | null {
  const parts = matchId.split('-');
  
  if (parts.length !== 3) {
    return null;
  }

  return {
    homeTeamId: parts[0],
    awayTeamId: parts[1],
    date: parts[2],
  };
}

/**
 * 格式化日期为 YYYYMMDD
 */
export function formatDateForMatchId(date: Date): string {
  return date.toISOString().split('T')[0].replace(/-/g, '');
}

/**
 * 检查两个比赛ID是否匹配同一场比赛
 * 考虑主客场可能颠倒的情况
 */
export function isSameMatch(matchId1: string, matchId2: string): boolean {
  const match1 = parseMatchId(matchId1);
  const match2 = parseMatchId(matchId2);

  if (!match1 || !match2) {
    return false;
  }

  // 日期必须相同
  if (match1.date !== match2.date) {
    return false;
  }

  // 检查球队是否匹配（考虑主客场颠倒）
  const sameOrder = match1.homeTeamId === match2.homeTeamId && match1.awayTeamId === match2.awayTeamId;
  const reverseOrder = match1.homeTeamId === match2.awayTeamId && match1.awayTeamId === match2.homeTeamId;

  return sameOrder || reverseOrder;
}
