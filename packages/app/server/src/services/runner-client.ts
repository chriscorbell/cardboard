import { env } from "../env.js";

export interface StartSessionRequest {
  sessionId: string;
  boardSlug: string;
  provider: "claude" | "codex";
  image: string | null;
  repoUrl: string | null;
  branch: string | null;
  token: string;
  wallClockMinutes: number;
  prompt: string;
}

export interface RunnerInventoryItem {
  containerId: string;
  sessionId: string;
  state: string;
  status: string;
}

export interface RunnerClient {
  readonly mode: "http" | "noop";
  start(req: StartSessionRequest): Promise<{ containerId: string }>;
  stop(containerId: string): Promise<void>;
  inventory(): Promise<RunnerInventoryItem[]>;
}

class HttpRunner implements RunnerClient {
  readonly mode = "http" as const;
  constructor(
    private baseUrl: string,
    private token: string,
  ) {}
  private headers() {
    return { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json" };
  }
  async start(req: StartSessionRequest): Promise<{ containerId: string }> {
    const res = await fetch(`${this.baseUrl}/sessions`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(req),
    });
    if (!res.ok) throw new Error(`runner start failed: ${res.status} ${await res.text()}`);
    return (await res.json()) as { containerId: string };
  }
  async stop(containerId: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/sessions/${encodeURIComponent(containerId)}`, {
      method: "DELETE",
      headers: this.headers(),
    });
    if (!res.ok && res.status !== 404) throw new Error(`runner stop failed: ${res.status}`);
  }
  async inventory(): Promise<RunnerInventoryItem[]> {
    const res = await fetch(`${this.baseUrl}/sessions`, { headers: this.headers() });
    if (!res.ok) throw new Error(`runner inventory failed: ${res.status}`);
    return (await res.json()) as RunnerInventoryItem[];
  }
}

// Used when no runner is configured: the Session is recorded and shown, but nothing runs.
class NoopRunner implements RunnerClient {
  readonly mode = "noop" as const;
  async start(req: StartSessionRequest): Promise<{ containerId: string }> {
    return { containerId: `noop-${req.sessionId}` };
  }
  async stop(): Promise<void> {}
  async inventory(): Promise<RunnerInventoryItem[]> {
    return [];
  }
}

export const runner: RunnerClient = env.runnerUrl
  ? new HttpRunner(env.runnerUrl.replace(/\/$/, ""), env.runnerToken)
  : new NoopRunner();
