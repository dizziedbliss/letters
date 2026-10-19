// Thin client for the letters backend (proxied at /api in dev)

export interface Letter {
  id: number;
  title: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    credentials: 'same-origin',
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new ApiError(res.status, data.error ?? res.statusText);
  }
  return res.json();
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function adminLogin(code: string): Promise<boolean> {
  try {
    await request('/admin/login', { method: 'POST', body: JSON.stringify({ code }) });
    return true;
  } catch {
    return false;
  }
}

export const adminLogout = () => request('/admin/logout', { method: 'POST' });

export async function isAdmin(): Promise<boolean> {
  try {
    await request('/admin/me');
    return true;
  } catch {
    return false;
  }
}

export const adminApi = {
  list: () => request<Letter[]>('/admin/letters'),
  create: (title: string, body: string) =>
    request<Letter>('/admin/letters', { method: 'POST', body: JSON.stringify({ title, body }) }),
  update: (id: number, title: string, body: string) =>
    request<Letter>(`/admin/letters/${id}`, { method: 'PUT', body: JSON.stringify({ title, body }) }),
  remove: (id: number) => request<{ ok: true }>(`/admin/letters/${id}`, { method: 'DELETE' }),
};
