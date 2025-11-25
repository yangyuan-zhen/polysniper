export interface Match {
  matchId: string;
  matchStatus: string; // "COMPLETED", "NOTSTARTED", etc.
  matchStatusChinese: string; // "已结束", "未开始"
  homeTeamName: string;
  awayTeamName: string;
  homeScore: number;
  awayScore: number;
  currentQuarter?: number; // e.g. 4
  costTime?: string; // e.g. "02:30" or "2:27"
  matchTime: string; // Start time
  sectionEndTime?: string; // JSON string of quarter end times
  frontEndMatchStatus?: {
    id: number;
    desc: string; // e.g. "第二节 剩8:09"
  };
}

interface ScheduleListStats {
  currentDate: string;
}

interface MatchListWrapper {
  day: string;
  matchList: Match[];
}

interface ApiResponse {
  result: {
    scheduleListStats: ScheduleListStats;
    gameList: MatchListWrapper[];
  };
}

export const fetchDailyMatches = async (): Promise<Match[]> => {
  const maxRetries = 2;
  const timeout = 8000; // 8秒超时（虎扑API可能较慢）
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      const response = await fetch(
        '/api/hupu/1/7.5.60/basketballapi/scheduleList?competitionTag=nba',
        { signal: controller.signal }
      );
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        if (attempt < maxRetries) continue; // 重试
        throw new Error('Network response was not ok');
      }
      
      const data: ApiResponse = await response.json();
      
      const currentDate = data.result.scheduleListStats.currentDate;
      const todayGames = data.result.gameList.find(g => g.day === currentDate);
      
      return todayGames ? todayGames.matchList : [];
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.warn(`[API] Hupu request timeout (attempt ${attempt + 1}/${maxRetries + 1})`);
      } else {
        console.warn(`[API] Error fetching matches (attempt ${attempt + 1}/${maxRetries + 1}):`, error.message);
      }
      
      if (attempt === maxRetries) {
        console.error('[API] All retry attempts failed for Hupu API');
        return [];
      }
      
      // 等待后重试
      await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
    }
  }
  
  return [];
};
