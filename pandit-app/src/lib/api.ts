import { Platform } from "react-native";

// The marketplace backend. On web and the iOS simulator, localhost reaches the
// host machine. (Android emulator would use 10.0.2.2.)
const DEFAULT_API_BASE =
  Platform.OS === "android" ? "http://10.0.2.2:8099" : "http://localhost:8099";

// Environment-driven base URL. `EXPO_PUBLIC_*` vars are inlined at build time, so
// each profile (dev / preview / production) can point at a different backend
// without code changes. Unset = local dev default above. For staging/prod set e.g.
// EXPO_PUBLIC_API_BASE=https://panditji-express2.vercel.app
export const API_BASE = process.env.EXPO_PUBLIC_API_BASE || DEFAULT_API_BASE;

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

// fetch() has no built-in timeout, so a dead connection would hang forever on a
// flaky mobile network. Abort after REQUEST_TIMEOUT_MS.
const REQUEST_TIMEOUT_MS = 15000;
// Idempotent GETs may be retried on transient failures; mutations never are.
const MAX_GET_RETRIES = 2;

function backoff(attempt: number): Promise<void> {
  const delay = 300 * Math.pow(3, attempt) + Math.random() * 150; // 300ms, 900ms + jitter
  return new Promise((resolve) => setTimeout(resolve, delay));
}

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  // For multipart (FormData) uploads, let fetch set Content-Type so it includes
  // the boundary; only default to JSON for ordinary bodies.
  const isForm = typeof FormData !== "undefined" && init?.body instanceof FormData;
  const headers: Record<string, string> = {
    ...(isForm ? {} : { "Content-Type": "application/json" }),
    ...((init?.headers as Record<string, string>) ?? {}),
  };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;

  const method = (init?.method ?? "GET").toUpperCase();
  // Only idempotent GETs are retried. POST/PATCH are never auto-retried — a retried
  // accept/status/location call would be a duplicate side effect.
  const maxAttempts = method === "GET" ? MAX_GET_RETRIES + 1 : 1;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const isLast = attempt === maxAttempts - 1;
    try {
      const res = await fetchWithTimeout(`${API_BASE}${path}`, { ...init, headers });
      if (res.status === 204) return undefined as T;
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        // Retry idempotent GETs on a transient 5xx; never retry a 4xx.
        if (method === "GET" && res.status >= 500 && !isLast) {
          await backoff(attempt);
          continue;
        }
        // Only treat a 401 as a dead session if we actually sent a token; a 401 on
        // the login/verify calls (wrong OTP) carries no token and must not log out.
        if (res.status === 401 && authToken) onUnauthorized?.();
        const err = body?.error ?? {};
        throw new ApiError(res.status, err.code ?? "error", err.message ?? "Request failed");
      }
      return body as T;
    } catch (e) {
      if (e instanceof ApiError) throw e; // a real HTTP error — do not mask as network
      // Network failure or timeout. Retry idempotent GETs, else surface cleanly.
      if (method === "GET" && !isLast) {
        await backoff(attempt);
        continue;
      }
      throw new ApiError(0, "network_error", "Network request failed. Check your connection.");
    }
  }
  // Unreachable, but satisfies the type checker.
  throw new ApiError(0, "network_error", "Network request failed.");
}

export const api = {
  get: <T>(p: string) => request<T>(p),
  post: <T>(p: string, data?: unknown) =>
    request<T>(p, { method: "POST", body: data ? JSON.stringify(data) : undefined }),
  postForm: <T>(p: string, form: FormData) =>
    request<T>(p, { method: "POST", body: form }),
  patch: <T>(p: string, data?: unknown) =>
    request<T>(p, { method: "PATCH", body: data ? JSON.stringify(data) : undefined }),
};
