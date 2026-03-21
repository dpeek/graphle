import { describe, expect, it } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const srcRoot = join(repoRoot, "src");
const domainNames = new Set(["agent", "app", "cli", "config", "graph", "lib"]);
const importPattern =
  /\b(?:import|export)\s+(?:[^"'()]*?\s+from\s+)?["']([^"']+)["']|\bimport\(\s*["']([^"']+)["']\s*\)/g;
const forbiddenGraphPackageImports = [
  /^@io\/core\/graph\/graph\//,
  /^@io\/core\/graph\/schema(?:$|\/)/,
  /^@io\/core\/graph\/react(?:$|[-/])/,
  /^@io\/core\/graph\/adapters\/react(?:$|\/)/,
] as const;

function collectSourceFiles(dir: string): string[] {
  const entries = readdirSync(dir).sort();
  const files: string[] = [];

  for (const entry of entries) {
    const path = join(dir, entry);
    const stats = statSync(path);

    if (stats.isDirectory()) {
      files.push(...collectSourceFiles(path));
      continue;
    }

    if (!path.endsWith(".ts") && !path.endsWith(".tsx")) {
      continue;
    }
    if (path.endsWith(".d.ts")) {
      continue;
    }

    files.push(path);
  }

  return files;
}

function collectImportSpecifiers(source: string): string[] {
  const specifiers: string[] = [];

  for (const match of source.matchAll(importPattern)) {
    const specifier = match[1] ?? match[2];
    if (specifier !== undefined) {
      specifiers.push(specifier);
    }
  }

  return specifiers;
}

describe("flat source import boundaries", () => {
  it("forbids cross-domain relative imports inside src", () => {
    const violations: string[] = [];

    for (const file of collectSourceFiles(srcRoot)) {
      const source = readFileSync(file, "utf8");
      const domain = relative(srcRoot, file).split("/")[0];

      if (!domainNames.has(domain!)) {
        continue;
      }

      for (const specifier of collectImportSpecifiers(source)) {
        if (!specifier.startsWith(".")) {
          continue;
        }

        const target = resolve(dirname(file), specifier);
        const targetWithinSrc = relative(srcRoot, target);

        if (targetWithinSrc.startsWith("..")) {
          continue;
        }

        const targetDomain = targetWithinSrc.split("/")[0];
        if (targetDomain === domain || !domainNames.has(targetDomain!)) {
          continue;
        }

        violations.push(`${relative(repoRoot, file)} -> ${specifier} (${targetDomain})`);
      }
    }

    expect(violations).toEqual([]);
  });

  it("forbids retired graph shim package imports inside src", () => {
    const violations: string[] = [];

    for (const file of collectSourceFiles(srcRoot)) {
      const source = readFileSync(file, "utf8");

      for (const specifier of collectImportSpecifiers(source)) {
        if (specifier.startsWith(".")) {
          continue;
        }

        if (forbiddenGraphPackageImports.some((pattern) => pattern.test(specifier))) {
          violations.push(`${relative(repoRoot, file)} -> ${specifier}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
