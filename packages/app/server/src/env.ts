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

const dataDir = path.resolve(str("CARDBOARD_DATA_DIR", "./data"));
const publicUrl = str("CARDBOARD_PUBLIC_URL", "http://localhost:5173").replace(/\/$/, "");

// Preview hostnames hang off the app's own parent domain: `kardboard.cc` gives `kardboard.cc`.
function defaultPreviewDomain(): string {
  try {
    const labels = new URL(publicUrl).hostname.split(".");
    return labels.length > 2 ? labels.slice(1).join(".") : labels.join(".");
  } catch {
    return "";
  }
}

export const env = {
  port: Number(str("PORT", "3070")),
  dataDir,
  publicUrl,
  redirectHosts: str("CARDBOARD_REDIRECT_HOSTS").split(",").map((host) => host.trim().toLowerCase()).filter(Boolean),
  authMode: (str("CARDBOARD_AUTH", "dev") === "clerk" ? "clerk" : "dev") as "dev" | "clerk",
  clerkSecretKey: str("CLERK_SECRET_KEY"),
  clerkPublishableKey: str("CLERK_PUBLISHABLE_KEY") || str("VITE_CLERK_PUBLISHABLE_KEY"),
  resendApiKey: str("RESEND_API_KEY"),
  emailFrom: str("CARDBOARD_EMAIL_FROM", "Milo <milo@example.com>"),
  runnerUrl: str("CARDBOARD_RUNNER_URL"),
  runnerToken: str("CARDBOARD_RUNNER_TOKEN"),
  // Only for reading which Providers are out of usage. Session traffic never passes through the app.
  egressUrl: str("CARDBOARD_EGRESS_URL").replace(/\/$/, ""),
  // Signs Preview cookies. The preview router verifies with the same secret; nothing else holds it.
  previewSecret: str("CARDBOARD_PREVIEW_SECRET"),
  previewDomain: str("CARDBOARD_PREVIEW_DOMAIN", defaultPreviewDomain()),
  // `{card}` is the Card's short id, `{domain}` the parent domain. A first-level hostname
  // fits a standard wildcard certificate, alongside the app's explicit hostname.
  previewHostPattern: str("CARDBOARD_PREVIEW_HOST_PATTERN", "{card}.{domain}"),
  previewScheme: str("CARDBOARD_PREVIEW_SCHEME", "https"),
  previewCookieMinutes: Number(str("CARDBOARD_PREVIEW_COOKIE_MINUTES", "240")),
  previewIdleDays: Number(str("CARDBOARD_PREVIEW_IDLE_DAYS", "7")),
  githubSessionsApp: githubApp("GITHUB_SESSIONS_APP"),
  githubMergeApp: githubApp("GITHUB_MERGE_APP"),
  triggerCoalesceMs: Number(str("CARDBOARD_TRIGGER_COALESCE_MS", "60000")),
  // Snapshots live beside the database on the data bind mount. Set the hour to -1 to take none.
  backupDir: path.resolve(str("CARDBOARD_BACKUP_DIR", path.join(dataDir, "backups"))),
  backupHour: Number(str("CARDBOARD_BACKUP_HOUR", "4")),
  backupKeep: Number(str("CARDBOARD_BACKUP_KEEP", "14")),
  isProduction: process.env.NODE_ENV === "production",
};
