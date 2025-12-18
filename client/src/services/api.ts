import type { UnifiedMatch } from '../types/backend';

const API_BASE = '/api';

interface ApiResponse<T> {
  success: boolean;
  data: T;
  timestamp: string;
  cached?: boolean;
}

interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
  };
  timestamp: string;
}

/**
 * 获取所有比赛
 */
export async function fetchMatches(params?: {
  status?: 'PRE' | 'LIVE' | 'FINAL';
  hasSignals?: boolean;
}): Promise<UnifiedMatch[]> {
  const queryParams = new URLSearchParams();
  if (params?.status) queryParams.append('status', params.status);
  if (params?.hasSignals !== undefined) queryParams.append('hasSignals', String(params.hasSignals));

  const url = `${API_BASE}/matches${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
  
  const response = await fetch(url);
  const result: ApiResponse<UnifiedMatch[]> | ErrorResponse = await response.json();

  if (!result.success) {
    throw new Error((result as ErrorResponse).error.message);
  }

  return (result as ApiResponse<UnifiedMatch[]>).data;
}

/**
 * 获取单场比赛
 */
export async function fetchMatch(id: string): Promise<UnifiedMatch> {
  const response = await fetch(`${API_BASE}/matches/${id}`);
  const result: ApiResponse<UnifiedMatch> | ErrorResponse = await response.json();

  if (!result.success) {
    throw new Error((result as ErrorResponse).error.message);
  }

  return (result as ApiResponse<UnifiedMatch>).data;
}

/**
 * 获取套利信号
 */
export async function fetchSignals(): Promise<UnifiedMatch[]> {
  const response = await fetch(`${API_BASE}/signals`);
  const result: ApiResponse<UnifiedMatch[]> | ErrorResponse = await response.json();

  if (!result.success) {
    throw new Error((result as ErrorResponse).error.message);
  }

  return (result as ApiResponse<UnifiedMatch[]>).data;
}

/**
 * 获取统计信息
 */
export async function fetchStats(): Promise<{
  totalMatches: number;
  liveMatches: number;
  matchesWithSignals: number;
  totalSignals: number;
  avgConfidence: string;
  dataCompleteness: {
    withPolyData: number;
    withESPNData: number;
    withHupuData: number;
  };
}> {
  const response = await fetch(`${API_BASE}/stats`);
  const result: ApiResponse<any> | ErrorResponse = await response.json();

  if (!result.success) {
    throw new Error((result as ErrorResponse).error.message);
  }

  return (result as ApiResponse<any>).data;
}

/**
 * 健康检查
 */
export async function healthCheck(): Promise<{
  status: string;
  timestamp: string;
  uptime: number;
}> {
  const response = await fetch('/health');
  const result: ApiResponse<any> | ErrorResponse = await response.json();

  if (!result.success) {
    throw new Error((result as ErrorResponse).error.message);
  }

  return (result as ApiResponse<any>).data;
}
