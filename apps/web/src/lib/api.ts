/**
 * API client for the Enterprise OpenClaw backend.
 *
 * - Server Components: reads the `token` cookie from next/headers and calls
 *   BACKEND_URL directly.
 * - Client Components: routes requests through /api/proxy/* so the httpOnly
 *   cookie is forwarded automatically by the browser.
 */

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:3000";

type FetchOptions = RequestInit & { token?: string };

/** Low-level fetch used by Server Components (pass token explicitly). */
export async function serverFetch<T>(
  path: string,
  options: FetchOptions = {},
): Promise<T> {
  const { token, ...rest } = options;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(rest.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BACKEND_URL}${path}`, { ...rest, headers });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

/**
 * Client-side fetch wrapper.
 * Routes through /api/proxy/* which injects the httpOnly token cookie.
 * On 401, redirects to /login.
 */
export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch(`/api/proxy${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    },
  });

  if (res.status === 401) {
    if (typeof window !== "undefined") window.location.href = "/login";
    throw new Error("Unauthorized");
  }

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`API ${res.status}: ${text}`);
  }

  return res.json() as Promise<T>;
}
