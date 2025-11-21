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
  try {
    const response = await fetch('/api/hupu/1/7.5.60/basketballapi/scheduleList?competitionTag=nba');
    if (!response.ok) {
      throw new Error('Network response was not ok');
    }
    const data: ApiResponse = await response.json();
    
    const currentDate = data.result.scheduleListStats.currentDate;
    const todayGames = data.result.gameList.find(g => g.day === currentDate);
    
    return todayGames ? todayGames.matchList : [];
  } catch (error) {
    console.error('Error fetching matches:', error);
    return [];
  }
};
