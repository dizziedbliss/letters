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

export type Role = 'admin' | 'reader';

/** Returns the role the code unlocks, or null if it's wrong. */
export async function login(code: string): Promise<Role | null> {
  try {
    const { role } = await request<{ role: Role }>('/login', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
    return role;
  } catch {
    return null;
  }
}

export const logout = () => request('/logout', { method: 'POST' });

/** Current session's role, or null when signed out. */
export async function currentRole(): Promise<Role | null> {
  try {
    return (await request<{ role: Role }>('/me')).role;
  } catch {
    return null;
  }
}

/** Reader endpoints for her page; `exclude` avoids repeating the current letter. */
export const readerApi = {
  random: (exclude?: number) =>
    request<Letter>(`/letters/random${exclude ? `?exclude=${exclude}` : ''}`),
};

export const adminApi = {
  list: () => request<Letter[]>('/admin/letters'),
  create: (title: string, body: string) =>
    request<Letter>('/admin/letters', { method: 'POST', body: JSON.stringify({ title, body }) }),
  update: (id: number, title: string, body: string) =>
    request<Letter>(`/admin/letters/${id}`, { method: 'PUT', body: JSON.stringify({ title, body }) }),
  remove: (id: number) => request<{ ok: true }>(`/admin/letters/${id}`, { method: 'DELETE' }),
};
