import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { extname, resolve } from "node:path";

const repositoryRoot = resolve(process.cwd(), "..");
const tracked = execFileSync("git", ["ls-files"], {
  cwd: repositoryRoot,
  encoding: "utf8"
}).split("\n").map((file) => file.trim()).filter(Boolean);

const forbiddenTrackedFiles = tracked.filter((file) =>
  /(^|\/)\.env(?:\.|$)/.test(file) && !file.endsWith(".env.example")
);

const textExtensions = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json", ".yml", ".yaml", ".md", ".sql"
]);

const secretPatterns = [
  { name: "Stripe live secret", pattern: /\bsk_live_[A-Za-z0-9]{16,}\b/g },
  { name: "GitHub personal token", pattern: /\bgh[pousr]_[A-Za-z0-9]{30,}\b/g },
  { name: "Slack bot token", pattern: /\bxoxb-[A-Za-z0-9-]{20,}\b/g },
  { name: "Telegram bot token", pattern: /\b\d{8,}:[A-Za-z0-9_-]{25,}\b/g },
  { name: "JWT-like secret", pattern: /\beyJhbGciOiJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\b/g }
];

const forbiddenSourcePatterns = [
  {
    name: "hardcoded Telegram setup secret",
    pattern: /TELEGRAM_SETUP_SECRET\s*=\s*["'][^"']+["']/g
  },
  {
    name: "secret exposed through NEXT_PUBLIC",
    pattern: /NEXT_PUBLIC_[A-Z0-9_]*(?:SECRET|TOKEN|PASSWORD|SERVICE_ROLE|PRIVATE_KEY)/g
  },
  {
    name: "secret accepted through generic query parameter",
    pattern: /searchParams\.get\(["']secret["']\)/g
  }
];

const findings = [];
if (forbiddenTrackedFiles.length) {
  findings.push(`Tracked environment files: ${forbiddenTrackedFiles.join(", ")}`);
}

for (const file of tracked) {
  if (!textExtensions.has(extname(file))) continue;
  const absolute = resolve(repositoryRoot, file);
  let content;
  try {
    content = readFileSync(absolute, "utf8");
  } catch {
    continue;
  }

  for (const check of [...secretPatterns, ...forbiddenSourcePatterns]) {
    check.pattern.lastIndex = 0;
    if (check.pattern.test(content)) findings.push(`${check.name}: ${file}`);
  }
}

if (findings.length) {
  console.error("Safety lint failed:");
  for (const finding of [...new Set(findings)]) console.error(`- ${finding}`);
  process.exit(1);
}

console.log(`Safety lint passed (${tracked.length} tracked files inspected).`);
