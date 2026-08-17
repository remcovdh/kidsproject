const API = "";

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetch(url, options);
  if (!r.ok) {
    let msg = `Server returned ${r.status}`;
    try { const b = await r.json(); if (b?.error) msg = b.error; } catch { /* */ }
    throw new Error(msg);
  }
  return r.json() as Promise<T>;
}

export async function login(password: string): Promise<string> {
  const { token } = await apiFetch<{ token: string }>(`${API}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  return token;
}

export interface SessionSummary {
  id: string;
  name: string;
  joinCode: string;
  aiProvider: string;
  showPrompt: boolean;
  createdAt: string;
  childCount: number;
}

export async function fetchSessions(token: string): Promise<SessionSummary[]> {
  return apiFetch<SessionSummary[]>(`${API}/api/sessions`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function fetchSessionInfo(sessionId: string): Promise<{ id: string; name: string; joinCode: string }> {
  return apiFetch(`${API}/api/sessions/${sessionId}`);
}

export async function createSession(
  name: string, aiProvider: string, showPrompt: boolean, token: string
): Promise<{ id: string; joinCode: string }> {
  return apiFetch(`${API}/api/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ name, aiProvider, showPrompt }),
  });
}

export type PhotoStatus = "none" | "pending_child_confirm" | "approved" | "rejected";

export interface RosterChild {
  childId: string;
  name: string;
  displayCode: string | null;
  gameType: string;
  drawingStatus: PhotoStatus;
  worldStatus: PhotoStatus;
  published: boolean;
}

export async function fetchRoster(sessionId: string, token: string): Promise<RosterChild[]> {
  return apiFetch<RosterChild[]>(`${API}/api/sessions/${sessionId}/roster`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function uploadPhoto(
  sessionId: string, childId: string, kind: "drawing" | "world", file: File, token: string
): Promise<{ photoId: string; url: string }> {
  const form = new FormData();
  form.append("childId", childId);
  form.append("kind", kind);
  form.append("photo", file);
  return apiFetch(`${API}/api/sessions/${sessionId}/photos`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
}
