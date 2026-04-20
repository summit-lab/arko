#!/usr/bin/env node
/**
 * Copies pre-commit hook from scripts/git-hooks/ to .git/hooks/
 * Idempotent. Safe to run multiple times.
 *
 * Uso: node scripts/install-hooks.mjs
 *   o: npm run hooks:install
 */

import { readFileSync, writeFileSync, chmodSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");
const gitHooksDir = join(repoRoot, ".git", "hooks");
const sourceHooksDir = join(repoRoot, "scripts", "git-hooks");

if (!existsSync(join(repoRoot, ".git"))) {
  console.error("✗ No es un repo git (no hay .git/)");
  process.exit(1);
}

if (!existsSync(gitHooksDir)) {
  mkdirSync(gitHooksDir, { recursive: true });
}

const hooks = ["pre-commit"];
let installed = 0;

for (const hook of hooks) {
  const src = join(sourceHooksDir, hook);
  const dst = join(gitHooksDir, hook);

  if (!existsSync(src)) {
    console.warn(`⚠  Falta ${src}`);
    continue;
  }

  const content = readFileSync(src, "utf8");
  writeFileSync(dst, content, { mode: 0o755 });
  chmodSync(dst, 0o755);
  console.log(`✓ Instalado: .git/hooks/${hook}`);
  installed++;
}

if (installed === 0) {
  console.warn("No se instaló ningún hook.");
  process.exit(1);
}

console.log(`\n${installed} hook${installed > 1 ? "s" : ""} instalado${installed > 1 ? "s" : ""}. Testeá con: git commit`);
