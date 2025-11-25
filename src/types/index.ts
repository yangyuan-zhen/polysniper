// 球队历史对战数据
export interface H2HGame {
  home: string;
  away: string;
  homeScore: number;
  awayScore: number;
  winner: string;
  date: string;
  venue?: string;
  attendance?: number;
}

// ESPN API 比赛数据
export interface ESPNGame {
  id: string;
  date: string;
  name: string;
  shortName: string;
  competitions: Array<{
    id: string;
    date: string;
    attendance?: number;
    venue?: {
      fullName: string;
    };
    competitors: Array<{
      id: string;
      homeAway: 'home' | 'away';
      winner: boolean;
      score: string;
      team: {
        id: string;
        displayName: string;
        abbreviation: string;
      };
    }>;
  }>;
}

// 球员伤病信息
export interface PlayerInjury {
  athleteId: string;
  athleteName: string;
  position?: string;
  jersey?: string;
  status: string; // "Out", "Doubtful", "Questionable"
  date?: string;
  details?: string;
  headshot?: string;
}

// 球队伤病名单
export interface TeamInjuries {
  teamId: string;
  teamName: string;
  injuries: PlayerInjury[];
}

// ESPN 胜率预测
export interface WinProbability {
  homeWinPercentage: number; // 当前胜率（实时或赛前）
  tiePercentage: number;
  playId?: string;
  pregameHomeWinPercentage?: number; // 赛前预测胜率（用于判断强队）
  isPregame?: boolean; // 是否为赛前数据
}
