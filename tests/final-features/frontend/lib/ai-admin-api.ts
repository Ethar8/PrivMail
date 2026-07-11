// ============================================================================
// PATCH for frontend/web/src/lib/api.ts
// Adds adminApi.getAiConfig/setAiConfig and the AiConfig type + extended status.
// ============================================================================
import { api } from '@/lib/api';

export interface ServerAiConfig {
  enabled: boolean;
  model: 'llama3' | 'mistral' | 'disabled';
  endpoint: string;
  sensitivity: number; // 0..100
  timeoutMs: number;
}

export interface SystemStatus {
  users: number;
  emails: number;
  queueSize: number;
  uptime: number;
  memory: { rss: number; totalMem: number; freeMem: number; usedMemPercent: number };
  cpu: { count: number; load1: number; load5: number; load15: number; loadPercent: number };
}

export const aiAdminApi = {
  get: () => api.get<ServerAiConfig>('/admin/ai-config'),
  set: (patch: Partial<ServerAiConfig>) => api.post<ServerAiConfig>('/admin/ai-config', patch),
  status: () => api.get<SystemStatus>('/admin/status'),
};
