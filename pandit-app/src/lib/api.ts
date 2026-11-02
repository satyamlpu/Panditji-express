import { Platform } from "react-native";

// The marketplace backend. On web and the iOS simulator, localhost reaches the
// host machine. (Android emulator would use 10.0.2.2.)
export const API_BASE =
  Platform.OS === "android" ? "http://10.0.2.2:8099" : "http://localhost:8099";

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

let authToken: string | null = null;
export function setToken(t: string | null) {
  authToken = t;
}

// The auth layer registers a handler so an expired/invalid token (401 while we
// believed we were signed in) can drop the session and bounce to login, instead
// of surfacing as a silent request failure. The marketplace API issues only a
// short-lived access token with no refresh, so re-auth means logging in again.
let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(fn: (() => void) | null) {
  onUnauthorized = fn;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((init?.headers as Record<string, string>) ?? {}),
  };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;
  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    // Only treat a 401 as a dead session if we actually sent a token; a 401 on
    // the login/verify calls (wrong OTP) carries no token and must not log out.
    if (res.status === 401 && authToken) onUnauthorized?.();
    const err = body?.error ?? {};
    throw new ApiError(res.status, err.code ?? "error", err.message ?? "Request failed");
  }
  return body as T;
}

export const api = {
  get: <T>(p: string) => request<T>(p),
  post: <T>(p: string, data?: unknown) =>
    request<T>(p, { method: "POST", body: data ? JSON.stringify(data) : undefined }),
  patch: <T>(p: string, data?: unknown) =>
    request<T>(p, { method: "PATCH", body: data ? JSON.stringify(data) : undefined }),
};
