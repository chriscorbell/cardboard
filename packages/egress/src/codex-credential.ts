// The Codex half of ADR 0002. Codex signs in as a ChatGPT subscriber rather than with an API key,
// so the credential is a sign-in file holding a short-lived access token and a refresh token. When
// the egress proxy holds that file, a Session container carries no Codex credential at all: it
// sends its requests here and this module supplies the access token and the account id.
//
// Observed against codex-cli 0.154.0: Codex sends `authorization: Bearer <access_token>` and
// `chatgpt-account-id: <id>` on every call to the provider, and reads the account id out of the
// `https://api.openai.com/auth` claim of the token when the sign-in file does not name one.

import fs from "node:fs";
import path from "node:path";

export const AUTH_CLAIM = "https://api.openai.com/auth";

/** The Codex CLI's public OAuth client. Override when the sign-in file came from another client. */
export const DEFAULT_CLIENT_ID = "app_EMoamEEZ73f0CkXaXp7hrann";
export const DEFAULT_TOKEN_URL = "https://auth.openai.com/oauth/token";

/** Refresh this long before the access token actually expires. */
const REFRESH_SKEW_SECONDS = 300;

export type CodexTokens = {
  id_token?: string | null;
  access_token?: string | null;
  refresh_token?: string | null;
  account_id?: string | null;
};

export type CodexAuthFile = {
  OPENAI_API_KEY?: string | null;
  tokens?: CodexTokens | null;
  last_refresh?: string | null;
};

export type CodexHeaders = { authorization: string; accountId: string | null };

/** The payload of a JWT, or null when it is not a JWT this can read. */
export function decodeJwt(token: string | null | undefined): Record<string, unknown> | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    return JSON.parse(Buffer.from(parts[1]!, "base64url").toString("utf8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Seconds since the epoch at which the token expires, or null when it does not say. */
export function expiryOf(token: string | null | undefined): number | null {
  const exp = decodeJwt(token)?.["exp"];
  return typeof exp === "number" ? exp : null;
}

/**
 * The ChatGPT account the tokens belong to. The sign-in file's own field wins; otherwise read the
 * claim Codex reads. Returns null when neither is present, which leaves the header off entirely.
 */
export function accountIdFrom(tokens: CodexTokens | null | undefined): string | null {
  if (!tokens) return null;
  if (tokens.account_id) return tokens.account_id;
  for (const token of [tokens.id_token, tokens.access_token]) {
    const claim = decodeJwt(token)?.[AUTH_CLAIM];
    if (claim && typeof claim === "object") {
      const id = (claim as Record<string, unknown>)["chatgpt_account_id"];
      if (typeof id === "string" && id) return id;
    }
  }
  return null;
}

/** True when the access token is missing, unreadable, or inside the refresh window. */
export function needsRefresh(tokens: CodexTokens | null | undefined, nowSeconds: number): boolean {
  if (!tokens?.access_token) return true;
  const exp = expiryOf(tokens.access_token);
  // A token that does not carry an expiry is used as-is; only the upstream can judge it.
  if (exp === null) return false;
  return exp - REFRESH_SKEW_SECONDS <= nowSeconds;
}

export function readAuthFile(file: string): CodexAuthFile {
  return JSON.parse(fs.readFileSync(file, "utf8")) as CodexAuthFile;
}

/** Replace the sign-in file in one step, so a crash mid-write cannot leave it truncated. */
export function writeAuthFile(file: string, auth: CodexAuthFile): void {
  const tmp = path.join(path.dirname(file), `.${path.basename(file)}.${process.pid}.tmp`);
  fs.writeFileSync(tmp, `${JSON.stringify(auth, null, 2)}\n`, { mode: 0o600 });
  fs.renameSync(tmp, file);
}

export type CodexCredentialOptions = {
  clientId?: string;
  tokenUrl?: string;
  fetchImpl?: typeof fetch;
  now?: () => number;
  onRefresh?: (auth: CodexAuthFile) => void;
};

/**
 * Holds the Codex sign-in file and hands out the headers a proxied request needs, refreshing the
 * access token when it is close to expiry. Refreshes are single-flight: concurrent Sessions share
 * one in-flight refresh rather than racing each other to spend the refresh token.
 */
export class CodexCredential {
  readonly #file: string;
  readonly #clientId: string;
  readonly #tokenUrl: string;
  readonly #fetch: typeof fetch;
  readonly #now: () => number;
  readonly #onRefresh: ((auth: CodexAuthFile) => void) | undefined;
  #auth: CodexAuthFile | null = null;
  #inFlight: Promise<CodexTokens> | null = null;

  constructor(file: string, options: CodexCredentialOptions = {}) {
    this.#file = file;
    this.#clientId = options.clientId || DEFAULT_CLIENT_ID;
    this.#tokenUrl = options.tokenUrl || DEFAULT_TOKEN_URL;
    this.#fetch = options.fetchImpl ?? fetch;
    this.#now = options.now ?? (() => Math.floor(Date.now() / 1000));
    this.#onRefresh = options.onRefresh;
  }

  /** Re-reads the file when it has not been read yet; the Admin may replace it under a running proxy. */
  #load(): CodexAuthFile {
    if (!this.#auth) this.#auth = readAuthFile(this.#file);
    return this.#auth;
  }

  async headers(): Promise<CodexHeaders> {
    let tokens = this.#load().tokens ?? null;
    if (needsRefresh(tokens, this.#now())) tokens = await this.#refresh();
    if (!tokens?.access_token) throw new Error("codex sign-in file has no access token");
    return { authorization: `Bearer ${tokens.access_token}`, accountId: accountIdFrom(tokens) };
  }

  #refresh(): Promise<CodexTokens> {
    // Reloading here picks up a file the Admin refreshed out of band, which is cheaper than
    // spending our refresh token and is the common case after the proxy has been idle.
    this.#auth = readAuthFile(this.#file);
    const onDisk = this.#auth.tokens ?? null;
    if (!needsRefresh(onDisk, this.#now())) return Promise.resolve(onDisk!);
    this.#inFlight ??= this.#exchange().finally(() => {
      this.#inFlight = null;
    });
    return this.#inFlight;
  }

  async #exchange(): Promise<CodexTokens> {
    const current = this.#load().tokens ?? null;
    const refreshToken = current?.refresh_token;
    if (!refreshToken) throw new Error("codex sign-in file has no refresh token");

    const res = await this.#fetch(this.#tokenUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        client_id: this.#clientId,
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        scope: "openid profile email",
      }),
    });
    if (!res.ok) {
      throw new Error(`codex token refresh failed: ${res.status} ${(await res.text().catch(() => "")).slice(0, 200)}`);
    }
    const body = (await res.json()) as { id_token?: string; access_token?: string; refresh_token?: string };
    if (!body.access_token) throw new Error("codex token refresh returned no access token");

    const tokens: CodexTokens = {
      ...current,
      id_token: body.id_token ?? current?.id_token ?? null,
      access_token: body.access_token,
      // The endpoint may rotate the refresh token; keeping the old one would strand the sign-in.
      refresh_token: body.refresh_token ?? refreshToken,
    };
    const auth: CodexAuthFile = { ...this.#load(), tokens, last_refresh: new Date(this.#now() * 1000).toISOString() };
    this.#auth = auth;
    // Persist so a proxy restart does not have to spend the refresh token again.
    try {
      writeAuthFile(this.#file, auth);
    } catch (err) {
      console.error("[egress] could not write the refreshed codex sign-in file", (err as Error).message);
    }
    this.#onRefresh?.(auth);
    return tokens;
  }
}
