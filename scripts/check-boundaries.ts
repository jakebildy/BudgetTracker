// Fails when code crosses a boundary described in AGENTS.md. Run by `npm run check`.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

type Rule = {
  description: string;
  appliesTo: (file: string) => boolean;
  isViolation: (file: string, source: string, imports: string[]) => boolean;
};

const ROOT = path.resolve(import.meta.dirname, "..");

const rules: Rule[] = [
  {
    description: "shared/ depends only on zod, never on client or server code",
    appliesTo: (file) => file.startsWith("shared/src/") && !file.includes(".test."),
    isViolation: (_file, _source, imports) =>
      imports.some((specifier) => !specifier.startsWith("./") && specifier !== "zod"),
  },
  {
    description: "HTTP routes call services, never repositories",
    appliesTo: (file) => file.startsWith("server/src/http/"),
    isViolation: (_file, _source, imports) =>
      imports.some((specifier) => specifier.includes("repositories/")),
  },
  {
    description: "only the Anthropic client adapter imports the Anthropic SDK",
    appliesTo: (file) => file.startsWith("server/") && !file.endsWith("server/src/llm/anthropicClient.ts"),
    isViolation: (_file, _source, imports) =>
      imports.some((specifier) => specifier.startsWith("@anthropic-ai/")),
  },
  {
    description: "the client never imports server code",
    appliesTo: (file) => file.startsWith("client/src/"),
    isViolation: (_file, _source, imports) =>
      imports.some((specifier) => specifier.includes("server/") || specifier.startsWith("@budget/server")),
  },
  {
    description: "client components never call fetch; requests go through client/src/api",
    appliesTo: (file) => file.startsWith("client/src/") && !file.startsWith("client/src/api/"),
    isViolation: (file, source) => !file.includes(".test.") && /\bfetch\(/.test(source),
  },
];

function sourceFiles(directory: string): string[] {
  return readdirSync(path.join(ROOT, directory), { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile() && /\.(ts|tsx)$/.test(entry.name))
    .map((entry) => path.relative(ROOT, path.join(entry.parentPath, entry.name)))
    .filter((file) => !file.includes("node_modules"));
}

function importsOf(source: string): string[] {
  const pattern = /(?:from\s+|import\s*\(\s*|import\s+)["']([^"']+)["']/g;
  return [...source.matchAll(pattern)].map((match) => match[1] ?? "");
}

const files = ["shared/src", "server/src", "server/test", "server/evals", "client/src"].flatMap(sourceFiles);
const violations: string[] = [];

for (const file of files) {
  const source = readFileSync(path.join(ROOT, file), "utf8");
  const imports = importsOf(source);
  for (const rule of rules) {
    if (rule.appliesTo(file) && rule.isViolation(file, source, imports)) {
      violations.push(`${file}: ${rule.description}`);
    }
  }
}

if (violations.length > 0) {
  console.error(`Boundary violations:\n${violations.map((line) => `  - ${line}`).join("\n")}`);
  process.exit(1);
}
console.log(`Boundaries OK (${files.length} files, ${rules.length} rules).`);
