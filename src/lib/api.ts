import type { AppLanguage, AppMode, UserRole } from '../shared/types';

export interface ApiSessionContext {
  mode: AppMode;
  lang: AppLanguage;
  role: UserRole;
  userName: string;
  userId: number | null;
  storeId: number;
}

export async function apiFetch<T>(
  path: string,
  ctx: ApiSessionContext,
  options: RequestInit = {},
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-app-mode': ctx.mode,
    'x-app-lang': ctx.lang,
    'x-user-role': ctx.role,
    'x-user-name': encodeURIComponent(ctx.userName),
    'x-store-id': String(ctx.storeId),
    ...(ctx.userId ? { 'x-user-id': String(ctx.userId) } : {}),
    ...((options.headers as Record<string, string>) || {}),
  };

  const res = await fetch(path, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return data as T;
}
