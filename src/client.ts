const BASE_URL = process.env.SBER_BASE_URL || "https://api.sberbank.ru";
const TIMEOUT = 10_000;
const MAX_RETRIES = 3;

let oauthToken: string | null = null;
let oauthExpiry = 0;

async function getToken(): Promise<string> {
  // Strategy 1: direct Bearer token
  const token = process.env.SBER_TOKEN || process.env.SBER_ACCESS_TOKEN;
  if (token) return token;

  // Strategy 2: OAuth client_credentials
  const clientId = process.env.SBER_CLIENT_ID;
  const clientSecret = process.env.SBER_CLIENT_SECRET;
  if (clientId && clientSecret) {
    if (oauthToken && Date.now() < oauthExpiry) return oauthToken;

    const response = await fetch(`${BASE_URL}/tokens/v3/oauth`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret,
        scope: "accounts statements payments",
      }),
    });

    if (!response.ok) {
      throw new Error(`OAuth ошибка ${response.status}: ${response.statusText}`);
    }

    const data = (await response.json()) as { access_token: string; expires_in: number };
    oauthToken = data.access_token;
    oauthExpiry = Date.now() + (data.expires_in - 60) * 1000; // refresh 60s early
    return oauthToken;
  }

  throw new Error(
    "Требуется SBER_TOKEN (Bearer) или SBER_CLIENT_ID + SBER_CLIENT_SECRET (OAuth)",
  );
}

export async function sberFetch(
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<unknown> {
  const method = options.method || "GET";

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT);

    try {
      const token = await getToken();
      const headers: Record<string, string> = {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      };
      const init: RequestInit = { method, headers, signal: controller.signal };

      if (options.body) {
        headers["Content-Type"] = "application/json";
        init.body = JSON.stringify(options.body);
      }

      const response = await fetch(`${BASE_URL}${path}`, init);
      clearTimeout(timer);

      if (response.ok) return response.json();

      if ((response.status === 429 || response.status >= 500) && attempt < MAX_RETRIES) {
        const delay = Math.min(1000 * 2 ** (attempt - 1), 8000);
        console.error(
          `[sber-mcp] ${response.status}, повтор через ${delay}мс (${attempt}/${MAX_RETRIES})`,
        );
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }

      throw new Error(`Сбербанк HTTP ${response.status}: ${response.statusText}`);
    } catch (error) {
      clearTimeout(timer);
      if (error instanceof DOMException && error.name === "AbortError" && attempt < MAX_RETRIES) {
        console.error(`[sber-mcp] Таймаут, повтор (${attempt}/${MAX_RETRIES})`);
        continue;
      }
      throw error;
    }
  }
  throw new Error("Сбербанк API: все попытки исчерпаны");
}

/** Backward compat alias */
export const sberGet = (path: string) => sberFetch(path);
