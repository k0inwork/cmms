import type { ApiError, TokenResponse } from "@/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

let accessToken: string | null = null;
let refreshToken: string | null = null;
let refreshPromise: Promise<void> | null = null;

// ─── Token persistence ────────────────────────────────────────────────────────

const TOKEN_KEY = "cmms_access_token";
const REFRESH_KEY = "cmms_refresh_token";

export function getStoredTokens(): { access: string | null; refresh: string | null } {
  if (typeof window === "undefined") return { access: null, refresh: null };
  return {
    access: localStorage.getItem(TOKEN_KEY),
    refresh: localStorage.getItem(REFRESH_KEY),
  };
}

export function storeTokens(access: string, refresh: string) {
  accessToken = access;
  refreshToken = refresh;
  localStorage.setItem(TOKEN_KEY, access);
  localStorage.setItem(REFRESH_KEY, refresh);
}

export function clearTokens() {
  accessToken = null;
  refreshToken = null;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

export function getAccessToken(): string | null {
  if (accessToken) return accessToken;
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

// ─── Token refresh ────────────────────────────────────────────────────────────

async function refreshAccessToken(): Promise<void> {
  const token = refreshToken || getStoredTokens().refresh;
  if (!token) throw new Error("No refresh token");

  const res = await fetch(`${API_BASE}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken: token }),
  });

  if (!res.ok) {
    clearTokens();
    throw new Error("Token refresh failed");
  }

  const data: TokenResponse = await res.json();
  storeTokens(data.accessToken, data.refreshToken);
}

async function getValidAccessToken(): Promise<string | null> {
  const token = getAccessToken();
  if (token) return token;

  if (!refreshPromise) {
    refreshPromise = refreshAccessToken().finally(() => {
      refreshPromise = null;
    });
  }

  try {
    await refreshPromise;
    return getAccessToken();
  } catch {
    return null;
  }
}

// ─── API client ───────────────────────────────────────────────────────────────

export class ApiClientError extends Error {
  constructor(
    public status: number,
    public body: ApiError,
  ) {
    super(body.error);
  }
}

export async function apiClient<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = await getValidAccessToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (res.status === 401) {
    // Try refresh once before giving up
    const hdrs = (options.headers as Record<string, string>) ?? {};
    if (token && !hdrs["X-Retry"]) {
      try {
        await refreshAccessToken();
        const newToken = getAccessToken();
        if (newToken) {
          return apiClient<T>(path, {
            ...options,
            headers: { ...hdrs, "X-Retry": "true" },
          });
        }
      } catch {
        // refresh failed, fall through to logout
      }
    }
    clearTokens();
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
    throw new ApiClientError(401, { error: "Session expired" });
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: "Request failed" }));
    throw new ApiClientError(res.status, body);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export function apiGet<T>(path: string) {
  return apiClient<T>(path);
}

export function apiPost<T>(path: string, body: unknown) {
  return apiClient<T>(path, { method: "POST", body: JSON.stringify(body) });
}

export function apiPatch<T>(path: string, body: unknown) {
  return apiClient<T>(path, { method: "PATCH", body: JSON.stringify(body) });
}

export function apiDelete<T>(path: string) {
  return apiClient<T>(path, { method: "DELETE" });
}
