// =============================================================================
// 前端专用类型定义
// =============================================================================
// 这个文件引用共享类型，并添加前端特有的类型定义

// 导入所有共享类型（从本地 shared.ts 导入，该文件与后端共享类型保持同步）
import { SignalType, MatchStatus } from './shared';
import type { UnifiedMatch, ArbitrageSignal } from './shared';

// 导出所有共享类型
export * from './shared';

// =============================================================================
// 前端特有类型（不与后端共享）
// =============================================================================

/** 前端应用状态 */
export interface AppState {
  loading: boolean;
  error: string | null;
  connected: boolean;
  lastUpdate: number;
}

/** UI 配置 */
export interface UIConfig {
  theme: 'light' | 'dark';
  autoRefresh: boolean;
  refreshInterval: number; // 毫秒
  soundEnabled: boolean;
  notifications: boolean;
}

/** 过滤器选项 */
export interface FilterOptions {
  status?: MatchStatus[];
  minConfidence?: number;
  hasSignals?: boolean;
  searchQuery?: string;
}

/** 排序选项 */
export interface SortOptions {
  field: 'startTime' | 'confidence' | 'edge' | 'lastUpdate';
  direction: 'asc' | 'desc';
}

/** 分页信息 */
export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
}

/** 前端组件 Props */
export interface MatchCardProps {
  match: UnifiedMatch;
  showDetails?: boolean;
  onSelect?: (match: UnifiedMatch) => void;
  onSignalClick?: (signal: ArbitrageSignal) => void;
}

/** 图表数据点 */
export interface ChartDataPoint {
  timestamp: number;
  homePrice: number;
  awayPrice: number;
  espnProb?: number;
  signal?: ArbitrageSignal;
}

/** 价格趋势数据 */
export interface PriceTrend {
  matchId: string;
  dataPoints: ChartDataPoint[];
  timeRange: '1h' | '6h' | '24h' | 'all';
}

/** 通知消息 */
export interface NotificationMessage {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
  actions?: Array<{
    label: string;
    action: () => void;
  }>;
}

/** 用户偏好设置 */
export interface UserPreferences {
  favoriteTeams: string[];
  alertThresholds: {
    confidence: number;
    edge: number;
  };
  display: {
    showProbabilities: boolean;
    showPrices: boolean;
    showVolume: boolean;
  };
}

/** 本地存储键 */
export enum StorageKey {
  USER_PREFERENCES = 'polysniper_user_preferences',
  UI_CONFIG = 'polysniper_ui_config',
  NOTIFICATIONS = 'polysniper_notifications',
  FILTER_OPTIONS = 'polysniper_filter_options',
}

// =============================================================================
// 类型守卫和工具函数
// =============================================================================

/** 检查是否为有效的过滤器选项 */
export function isValidFilterOptions(options: Partial<FilterOptions>): options is FilterOptions {
  return (
    options.status === undefined ||
    Array.isArray(options.status) ||
    typeof options.minConfidence === 'number' ||
    typeof options.hasSignals === 'boolean' ||
    typeof options.searchQuery === 'string'
  );
}

/** 创建默认的 UI 配置 */
export function createDefaultUIConfig(): UIConfig {
  return {
    theme: 'light',
    autoRefresh: true,
    refreshInterval: 10000, // 10 秒
    soundEnabled: true,
    notifications: true,
  };
}

/** 创建默认的用户偏好 */
export function createUserPreferences(): UserPreferences {
  return {
    favoriteTeams: [],
    alertThresholds: {
      confidence: 0.7,
      edge: 5.0,
    },
    display: {
      showProbabilities: true,
      showPrices: true,
      showVolume: true,
    },
  };
}

/** 格式化价格显示 */
export function formatPrice(price: number): string {
  return `${(price * 100).toFixed(1)}¢`;
}

/** 格式化百分比 */
export function formatPercentage(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

/** 格式化收益率 */
export function formatEdge(edge: number): string {
  const sign = edge >= 0 ? '+' : '';
  return `${sign}${edge.toFixed(1)}%`;
}

/** 获取信号类型的显示文本 */
export function getSignalTypeText(type: SignalType): string {
  switch (type) {
    case SignalType.BUY_HOME:
      return '买入主队';
    case SignalType.SELL_HOME:
      return '卖出主队';
    case SignalType.BUY_AWAY:
      return '买入客队';
    case SignalType.SELL_AWAY:
      return '卖出客队';
    case SignalType.NONE:
      return '无信号';
    default:
      return '未知';
  }
}

/** 获取信号类型的颜色 */
export function getSignalTypeColor(type: SignalType): string {
  switch (type) {
    case SignalType.BUY_HOME:
      return '#10b981'; // green
    case SignalType.SELL_HOME:
      return '#ef4444'; // red
    case SignalType.BUY_AWAY:
      return '#10b981'; // green
    case SignalType.SELL_AWAY:
      return '#ef4444'; // red
    case SignalType.NONE:
      return '#6b7280'; // gray
    default:
      return '#6b7280';
  }
}

/** 检查比赛是否为收藏 */
export function isFavoriteMatch(match: UnifiedMatch, favoriteTeams: string[]): boolean {
  return favoriteTeams.includes(match.homeTeam.id) || favoriteTeams.includes(match.awayTeam.id);
}

/** 计算距离现在的时间 */
export function getTimeAgo(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  
  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  
  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes}分钟前`;
  if (hours < 24) return `${hours}小时前`;
  return `${days}天前`;
}
