import fs from "node:fs";
import path from "node:path";

// Load packages/app/.env when present (dev). In production the compose file supplies the environment.
for (const candidate of [path.resolve(process.cwd(), ".env"), path.resolve(process.cwd(), "../.env")]) {
  if (fs.existsSync(candidate)) {
    process.loadEnvFile(candidate);
    break;
  }
}

function str(name: string, fallback = ""): string {
  const v = process.env[name];
  return v === undefined || v === "" ? fallback : v;
}

// Private keys arrive base64-encoded so a PEM survives an env file.
function githubApp(prefix: string) {
  const b64 = str(`${prefix}_PRIVATE_KEY_B64`);
  return {
    id: str(`${prefix}_ID`),
    slug: str(`${prefix}_SLUG`, prefix === "GITHUB_SESSIONS_APP" ? "cardboard-sessions" : "cardboard"),
    privateKey: b64 ? Buffer.from(b64, "base64").toString("utf8") : "",
  };
}

export const env = {
  port: Number(str("PORT", "3070")),
  dataDir: path.resolve(str("CARDBOARD_DATA_DIR", "./data")),
  publicUrl: str("CARDBOARD_PUBLIC_URL", "http://localhost:5173").replace(/\/$/, ""),
  authMode: (str("CARDBOARD_AUTH", "dev") === "clerk" ? "clerk" : "dev") as "dev" | "clerk",
  clerkSecretKey: str("CLERK_SECRET_KEY"),
  clerkPublishableKey: str("CLERK_PUBLISHABLE_KEY") || str("VITE_CLERK_PUBLISHABLE_KEY"),
  resendApiKey: str("RESEND_API_KEY"),
  emailFrom: str("CARDBOARD_EMAIL_FROM", "Milo <milo@cardboard.xode.cc>"),
  runnerUrl: str("CARDBOARD_RUNNER_URL"),
  runnerToken: str("CARDBOARD_RUNNER_TOKEN"),
  githubSessionsApp: githubApp("GITHUB_SESSIONS_APP"),
  githubMergeApp: githubApp("GITHUB_MERGE_APP"),
  triggerCoalesceMs: Number(str("CARDBOARD_TRIGGER_COALESCE_MS", "60000")),
  isProduction: process.env.NODE_ENV === "production",
};
