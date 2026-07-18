// Server-side TxLINE credential management.
// The long-lived API token comes from env (activated once via scripts/txline-setup.ts).
// Guest JWTs are session tokens we can mint freely and refresh on 401/403.

import { JWT_URL } from "./config";

let cachedJwt: string | null = process.env.TXLINE_JWT ?? null;
let refreshing: Promise<string> | null = null;

export function getApiToken(): string {
  const token = process.env.TXLINE_API_TOKEN;
  if (!token) throw new Error("TXLINE_API_TOKEN not set — run scripts/txline-setup.ts");
  return token;
}

export async function getJwt(): Promise<string> {
  if (cachedJwt) return cachedJwt;
  return renewJwt();
}

export async function renewJwt(): Promise<string> {
  if (!refreshing) {
    refreshing = (async () => {
      const res = await fetch(JWT_URL, { method: "POST" });
      if (!res.ok) throw new Error(`guest/start failed: ${res.status}`);
      const { token } = (await res.json()) as { token: string };
      cachedJwt = token;
      refreshing = null;
      return token;
    })().catch((err) => {
      refreshing = null;
      throw err;
    });
  }
  return refreshing;
}

export async function authHeaders(): Promise<Record<string, string>> {
  return {
    Authorization: `Bearer ${await getJwt()}`,
    "X-Api-Token": getApiToken(),
  };
}
