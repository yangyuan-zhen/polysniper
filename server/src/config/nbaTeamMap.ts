/**
 * NBA 球队静态映射表
 * 中文名 → 英文名 → 缩写
 */

export interface NBATeam {
  chineseName: string;    // 虎扑中文名
  englishName: string;    // ESPN 完整名称
  polymarketName: string; // Polymarket 使用的名称（通常是队名核心词）
  abbr: string;           // 缩写
}

export const NBA_TEAM_MAP: Record<string, NBATeam> = {
  // 东部 - 大西洋赛区
  'BOS': {
    chineseName: '凯尔特人',
    englishName: 'Boston Celtics',
    polymarketName: 'Celtics',
    abbr: 'BOS'
  },
  'BKN': {
    chineseName: '篮网',
    englishName: 'Brooklyn Nets',
    polymarketName: 'Nets',
    abbr: 'BKN'
  },
  'NYK': {
    chineseName: '尼克斯',
    englishName: 'New York Knicks',
    polymarketName: 'Knicks',
    abbr: 'NYK'
  },
  'PHI': {
    chineseName: '76人',
    englishName: 'Philadelphia 76ers',
    polymarketName: '76ers',
    abbr: 'PHI'
  },
  'TOR': {
    chineseName: '猛龙',
    englishName: 'Toronto Raptors',
    polymarketName: 'Raptors',
    abbr: 'TOR'
  },

  // 东部 - 中部赛区
  'CHI': {
    chineseName: '公牛',
    englishName: 'Chicago Bulls',
    polymarketName: 'Bulls',
    abbr: 'CHI'
  },
  'CLE': {
    chineseName: '骑士',
    englishName: 'Cleveland Cavaliers',
    polymarketName: 'Cavaliers',
    abbr: 'CLE'
  },
  'DET': {
    chineseName: '活塞',
    englishName: 'Detroit Pistons',
    polymarketName: 'Pistons',
    abbr: 'DET'
  },
  'IND': {
    chineseName: '步行者',
    englishName: 'Indiana Pacers',
    polymarketName: 'Pacers',
    abbr: 'IND'
  },
  'MIL': {
    chineseName: '雄鹿',
    englishName: 'Milwaukee Bucks',
    polymarketName: 'Bucks',
    abbr: 'MIL'
  },

  // 东部 - 东南赛区
  'ATL': {
    chineseName: '老鹰',
    englishName: 'Atlanta Hawks',
    polymarketName: 'Hawks',
    abbr: 'ATL'
  },
  'CHA': {
    chineseName: '黄蜂',
    englishName: 'Charlotte Hornets',
    polymarketName: 'Hornets',
    abbr: 'CHA'
  },
  'MIA': {
    chineseName: '热火',
    englishName: 'Miami Heat',
    polymarketName: 'Heat',
    abbr: 'MIA'
  },
  'ORL': {
    chineseName: '魔术',
    englishName: 'Orlando Magic',
    polymarketName: 'Magic',
    abbr: 'ORL'
  },
  'WAS': {
    chineseName: '奇才',
    englishName: 'Washington Wizards',
    polymarketName: 'Wizards',
    abbr: 'WAS'
  },

  // 西部 - 西北赛区
  'DEN': {
    chineseName: '掘金',
    englishName: 'Denver Nuggets',
    polymarketName: 'Nuggets',
    abbr: 'DEN'
  },
  'MIN': {
    chineseName: '森林狼',
    englishName: 'Minnesota Timberwolves',
    polymarketName: 'Timberwolves',
    abbr: 'MIN'
  },
  'OKC': {
    chineseName: '雷霆',
    englishName: 'Oklahoma City Thunder',
    polymarketName: 'Thunder',
    abbr: 'OKC'
  },
  'POR': {
    chineseName: '开拓者',
    englishName: 'Portland Trail Blazers',
    polymarketName: 'Blazers',
    abbr: 'POR'
  },
  'UTA': {
    chineseName: '爵士',
    englishName: 'Utah Jazz',
    polymarketName: 'Jazz',
    abbr: 'UTA'
  },

  // 西部 - 太平洋赛区
  'GSW': {
    chineseName: '勇士',
    englishName: 'Golden State Warriors',
    polymarketName: 'Warriors',
    abbr: 'GSW'
  },
  'LAC': {
    chineseName: '快船',
    englishName: 'LA Clippers',
    polymarketName: 'Clippers',
    abbr: 'LAC'
  },
  'LAL': {
    chineseName: '湖人',
    englishName: 'Los Angeles Lakers',
    polymarketName: 'Lakers',
    abbr: 'LAL'
  },
  'PHX': {
    chineseName: '太阳',
    englishName: 'Phoenix Suns',
    polymarketName: 'Suns',
    abbr: 'PHX'
  },
  'SAC': {
    chineseName: '国王',
    englishName: 'Sacramento Kings',
    polymarketName: 'Kings',
    abbr: 'SAC'
  },

  // 西部 - 西南赛区
  'DAL': {
    chineseName: '独行侠',
    englishName: 'Dallas Mavericks',
    polymarketName: 'Mavericks',
    abbr: 'DAL'
  },
  'HOU': {
    chineseName: '火箭',
    englishName: 'Houston Rockets',
    polymarketName: 'Rockets',
    abbr: 'HOU'
  },
  'MEM': {
    chineseName: '灰熊',
    englishName: 'Memphis Grizzlies',
    polymarketName: 'Grizzlies',
    abbr: 'MEM'
  },
  'NOP': {
    chineseName: '鹈鹕',
    englishName: 'New Orleans Pelicans',
    polymarketName: 'Pelicans',
    abbr: 'NOP'
  },
  'SAS': {
    chineseName: '马刺',
    englishName: 'San Antonio Spurs',
    polymarketName: 'Spurs',
    abbr: 'SAS'
  }
};

/**
 * 通过中文名查找球队
 */
export function findTeamByChinese(chineseName: string): NBATeam | undefined {
  return Object.values(NBA_TEAM_MAP).find(team => 
    team.chineseName === chineseName || chineseName.includes(team.chineseName)
  );
}

/**
 * 通过英文名查找球队
 */
export function findTeamByEnglish(englishName: string): NBATeam | undefined {
  const normalized = englishName.toLowerCase();
  return Object.values(NBA_TEAM_MAP).find(team => 
    team.englishName.toLowerCase() === normalized ||
    team.englishName.toLowerCase().includes(normalized) ||
    normalized.includes(team.polymarketName.toLowerCase())
  );
}

/**
 * 通过 Polymarket 名称查找球队
 */
export function findTeamByPolymarket(polyName: string): NBATeam | undefined {
  const normalized = polyName.toLowerCase();
  return Object.values(NBA_TEAM_MAP).find(team => 
    normalized.includes(team.polymarketName.toLowerCase()) ||
    normalized.includes(team.abbr.toLowerCase())
  );
}

/**
 * 通过缩写查找球队
 */
export function findTeamByAbbr(abbr: string): NBATeam | undefined {
  return NBA_TEAM_MAP[abbr.toUpperCase()];
}

/**
 * 获取所有球队列表
 */
export function getAllTeams(): NBATeam[] {
  return Object.values(NBA_TEAM_MAP);
}
