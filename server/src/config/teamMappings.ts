/**
 * NBA 30支球队映射配置
 * 用于匹配虎扑中文名、ESPN英文名、Polymarket关键词
 */

export interface TeamMapping {
  id: string;           // 球队缩写 ID
  espnId: string;       // ESPN 球队 ID
  espnName: string;     // ESPN 英文全名
  espnAbbr: string;     // ESPN 缩写
  hupuName: string;     // 虎扑中文名
  polyKeywords: string[]; // Polymarket 可能的关键词
  conference: 'East' | 'West'; // 分区
  division: string;     // 赛区
}

export const NBA_TEAMS: TeamMapping[] = [
  // 东部 - 大西洋赛区
  {
    id: 'BOS',
    espnId: '2',
    espnName: 'Boston Celtics',
    espnAbbr: 'BOS',
    hupuName: '凯尔特人',
    polyKeywords: ['Celtics', 'BOS', 'Boston Celtics'],
    conference: 'East',
    division: 'Atlantic',
  },
  {
    id: 'BKN',
    espnId: '17',
    espnName: 'Brooklyn Nets',
    espnAbbr: 'BKN',
    hupuName: '篮网',
    polyKeywords: ['Nets', 'BKN', 'Brooklyn Nets'],
    conference: 'East',
    division: 'Atlantic',
  },
  {
    id: 'NYK',
    espnId: '18',
    espnName: 'New York Knicks',
    espnAbbr: 'NYK',
    hupuName: '尼克斯',
    polyKeywords: ['Knicks', 'NYK', 'NY Knicks', 'New York Knicks'],
    conference: 'East',
    division: 'Atlantic',
  },
  {
    id: 'PHI',
    espnId: '20',
    espnName: 'Philadelphia 76ers',
    espnAbbr: 'PHI',
    hupuName: '76人',
    polyKeywords: ['76ers', 'Sixers', 'PHI', 'Philadelphia 76ers'],
    conference: 'East',
    division: 'Atlantic',
  },
  {
    id: 'TOR',
    espnId: '28',
    espnName: 'Toronto Raptors',
    espnAbbr: 'TOR',
    hupuName: '猛龙',
    polyKeywords: ['Raptors', 'TOR', 'Toronto Raptors'],
    conference: 'East',
    division: 'Atlantic',
  },

  // 东部 - 中部赛区
  {
    id: 'CHI',
    espnId: '4',
    espnName: 'Chicago Bulls',
    espnAbbr: 'CHI',
    hupuName: '公牛',
    polyKeywords: ['Bulls', 'CHI', 'Chicago Bulls'],
    conference: 'East',
    division: 'Central',
  },
  {
    id: 'CLE',
    espnId: '5',
    espnName: 'Cleveland Cavaliers',
    espnAbbr: 'CLE',
    hupuName: '骑士',
    polyKeywords: ['Cavaliers', 'Cavs', 'CLE', 'Cleveland Cavaliers'],
    conference: 'East',
    division: 'Central',
  },
  {
    id: 'DET',
    espnId: '8',
    espnName: 'Detroit Pistons',
    espnAbbr: 'DET',
    hupuName: '活塞',
    polyKeywords: ['Pistons', 'DET', 'Detroit Pistons'],
    conference: 'East',
    division: 'Central',
  },
  {
    id: 'IND',
    espnId: '11',
    espnName: 'Indiana Pacers',
    espnAbbr: 'IND',
    hupuName: '步行者',
    polyKeywords: ['Pacers', 'IND', 'Indiana Pacers'],
    conference: 'East',
    division: 'Central',
  },
  {
    id: 'MIL',
    espnId: '15',
    espnName: 'Milwaukee Bucks',
    espnAbbr: 'MIL',
    hupuName: '雄鹿',
    polyKeywords: ['Bucks', 'MIL', 'Milwaukee Bucks'],
    conference: 'East',
    division: 'Central',
  },

  // 东部 - 东南赛区
  {
    id: 'ATL',
    espnId: '1',
    espnName: 'Atlanta Hawks',
    espnAbbr: 'ATL',
    hupuName: '老鹰',
    polyKeywords: ['Hawks', 'ATL', 'Atlanta Hawks'],
    conference: 'East',
    division: 'Southeast',
  },
  {
    id: 'CHA',
    espnId: '30',
    espnName: 'Charlotte Hornets',
    espnAbbr: 'CHA',
    hupuName: '黄蜂',
    polyKeywords: ['Hornets', 'CHA', 'Charlotte Hornets'],
    conference: 'East',
    division: 'Southeast',
  },
  {
    id: 'MIA',
    espnId: '14',
    espnName: 'Miami Heat',
    espnAbbr: 'MIA',
    hupuName: '热火',
    polyKeywords: ['Heat', 'MIA', 'Miami Heat'],
    conference: 'East',
    division: 'Southeast',
  },
  {
    id: 'ORL',
    espnId: '19',
    espnName: 'Orlando Magic',
    espnAbbr: 'ORL',
    hupuName: '魔术',
    polyKeywords: ['Magic', 'ORL', 'Orlando Magic'],
    conference: 'East',
    division: 'Southeast',
  },
  {
    id: 'WAS',
    espnId: '27',
    espnName: 'Washington Wizards',
    espnAbbr: 'WAS',
    hupuName: '奇才',
    polyKeywords: ['Wizards', 'WAS', 'Washington Wizards'],
    conference: 'East',
    division: 'Southeast',
  },

  // 西部 - 西北赛区
  {
    id: 'DEN',
    espnId: '7',
    espnName: 'Denver Nuggets',
    espnAbbr: 'DEN',
    hupuName: '掘金',
    polyKeywords: ['Nuggets', 'DEN', 'Denver Nuggets'],
    conference: 'West',
    division: 'Northwest',
  },
  {
    id: 'MIN',
    espnId: '16',
    espnName: 'Minnesota Timberwolves',
    espnAbbr: 'MIN',
    hupuName: '森林狼',
    polyKeywords: ['Timberwolves', 'Wolves', 'MIN', 'Minnesota Timberwolves'],
    conference: 'West',
    division: 'Northwest',
  },
  {
    id: 'OKC',
    espnId: '25',
    espnName: 'Oklahoma City Thunder',
    espnAbbr: 'OKC',
    hupuName: '雷霆',
    polyKeywords: ['Thunder', 'OKC', 'Oklahoma City Thunder'],
    conference: 'West',
    division: 'Northwest',
  },
  {
    id: 'POR',
    espnId: '22',
    espnName: 'Portland Trail Blazers',
    espnAbbr: 'POR',
    hupuName: '开拓者',
    polyKeywords: ['Blazers', 'Trail Blazers', 'POR', 'Portland Trail Blazers'],
    conference: 'West',
    division: 'Northwest',
  },
  {
    id: 'UTA',
    espnId: '26',
    espnName: 'Utah Jazz',
    espnAbbr: 'UTA',
    hupuName: '爵士',
    polyKeywords: ['Jazz', 'UTA', 'Utah Jazz'],
    conference: 'West',
    division: 'Northwest',
  },

  // 西部 - 太平洋赛区
  {
    id: 'GSW',
    espnId: '9',
    espnName: 'Golden State Warriors',
    espnAbbr: 'GSW',
    hupuName: '勇士',
    polyKeywords: ['Warriors', 'GSW', 'GS Warriors', 'Golden State Warriors'],
    conference: 'West',
    division: 'Pacific',
  },
  {
    id: 'LAC',
    espnId: '12',
    espnName: 'LA Clippers',
    espnAbbr: 'LAC',
    hupuName: '快船',
    polyKeywords: ['Clippers', 'LAC', 'LA Clippers', 'L.A. Clippers', 'Los Angeles Clippers'],
    conference: 'West',
    division: 'Pacific',
  },
  {
    id: 'LAL',
    espnId: '13',
    espnName: 'Los Angeles Lakers',
    espnAbbr: 'LAL',
    hupuName: '湖人',
    polyKeywords: ['Lakers', 'LAL', 'LA Lakers', 'L.A. Lakers', 'Los Angeles Lakers'],
    conference: 'West',
    division: 'Pacific',
  },
  {
    id: 'PHX',
    espnId: '21',
    espnName: 'Phoenix Suns',
    espnAbbr: 'PHX',
    hupuName: '太阳',
    polyKeywords: ['Suns', 'PHX', 'Phoenix Suns'],
    conference: 'West',
    division: 'Pacific',
  },
  {
    id: 'SAC',
    espnId: '23',
    espnName: 'Sacramento Kings',
    espnAbbr: 'SAC',
    hupuName: '国王',
    polyKeywords: ['Kings', 'SAC', 'Sacramento Kings'],
    conference: 'West',
    division: 'Pacific',
  },

  // 西部 - 西南赛区
  {
    id: 'DAL',
    espnId: '6',
    espnName: 'Dallas Mavericks',
    espnAbbr: 'DAL',
    hupuName: '独行侠',
    polyKeywords: ['Mavericks', 'Mavs', 'DAL', 'Dallas Mavericks'],
    conference: 'West',
    division: 'Southwest',
  },
  {
    id: 'HOU',
    espnId: '10',
    espnName: 'Houston Rockets',
    espnAbbr: 'HOU',
    hupuName: '火箭',
    polyKeywords: ['Rockets', 'HOU', 'Houston Rockets'],
    conference: 'West',
    division: 'Southwest',
  },
  {
    id: 'MEM',
    espnId: '29',
    espnName: 'Memphis Grizzlies',
    espnAbbr: 'MEM',
    hupuName: '灰熊',
    polyKeywords: ['Grizzlies', 'MEM', 'Memphis Grizzlies'],
    conference: 'West',
    division: 'Southwest',
  },
  {
    id: 'NOP',
    espnId: '3',
    espnName: 'New Orleans Pelicans',
    espnAbbr: 'NOP',
    hupuName: '鹈鹕',
    polyKeywords: ['Pelicans', 'NOP', 'New Orleans Pelicans'],
    conference: 'West',
    division: 'Southwest',
  },
  {
    id: 'SAS',
    espnId: '24',
    espnName: 'San Antonio Spurs',
    espnAbbr: 'SAS',
    hupuName: '马刺',
    polyKeywords: ['Spurs', 'SAS', 'San Antonio Spurs'],
    conference: 'West',
    division: 'Southwest',
  },
];

/**
 * 根据虎扑中文名查找球队
 */
export function findTeamByHupuName(hupuName: string): TeamMapping | undefined {
  return NBA_TEAMS.find(team => team.hupuName === hupuName || hupuName.includes(team.hupuName));
}

/**
 * 根据 ESPN 名称查找球队
 */
export function findTeamByESPNName(espnName: string): TeamMapping | undefined {
  const normalized = espnName.toLowerCase();
  return NBA_TEAMS.find(team => 
    team.espnName.toLowerCase() === normalized || 
    team.espnAbbr.toLowerCase() === normalized ||
    normalized.includes(team.espnName.toLowerCase().split(' ').pop() || '')
  );
}

/**
 * 根据 Polymarket 关键词查找球队
 */
export function findTeamByPolyKeyword(keyword: string): TeamMapping | undefined {
  const normalized = keyword.toLowerCase();
  return NBA_TEAMS.find(team => 
    team.polyKeywords.some(k => normalized.includes(k.toLowerCase()))
  );
}

/**
 * 根据球队 ID 查找
 */
export function findTeamById(id: string): TeamMapping | undefined {
  return NBA_TEAMS.find(team => team.id === id);
}

/**
 * 获取所有球队 ID 列表
 */
export function getAllTeamIds(): string[] {
  return NBA_TEAMS.map(team => team.id);
}

/**
 * 匹配比赛双方球队
 */
export function matchTeams(homeTeam: string, awayTeam: string, source: 'hupu' | 'espn' | 'poly'): {
  home: TeamMapping | undefined;
  away: TeamMapping | undefined;
} {
  let findFunc: (name: string) => TeamMapping | undefined;

  switch (source) {
    case 'hupu':
      findFunc = findTeamByHupuName;
      break;
    case 'espn':
      findFunc = findTeamByESPNName;
      break;
    case 'poly':
      findFunc = findTeamByPolyKeyword;
      break;
  }

  return {
    home: findFunc(homeTeam),
    away: findFunc(awayTeam),
  };
}
