import { expect, test } from "bun:test";

type RootPackageJson = {
  exports: Record<string, string>;
};

type SolutionTsConfig = {
  references?: Array<{ path: string }>;
};

test("root package exposes the flat-source public subpaths before source moves", async () => {
  const packageJson = (await Bun.file(new URL("./package.json", import.meta.url)).json()) as RootPackageJson;

  expect(packageJson.exports).toMatchObject({
    "./agent": "./agent/src/index.ts",
    "./app": "./app/src/index.ts",
    "./cli": "./cli/src/index.ts",
    "./config": "./config/src/index.ts",
    "./graph": "./graph/src/index.ts",
    "./graph/react": "./graph/src/react/index.ts",
    "./graph/react-dom": "./graph/src/react-dom/index.ts",
    "./graph/react-opentui": "./graph/src/react-opentui/index.ts",
    "./graph/schema": "./graph/src/schema/index.ts",
    "./graph/schema/*": "./graph/src/schema/*/index.ts",
    "./graph/taxonomy/*": "./graph/src/taxonomy/*.ts",
    "./lib": "./lib/src/index.ts",
    "./lib/config": "./lib/src/config.ts",
    "./tsconfig/base": "./tsconfig.base.json",
  });
});

test("root solution tsconfig references each domain project", async () => {
  const tsconfig = (await Bun.file(new URL("./tsconfig.json", import.meta.url)).json()) as SolutionTsConfig;

  expect(tsconfig.references).toEqual([
    { path: "./tsconfig.lib.json" },
    { path: "./tsconfig.graph.json" },
    { path: "./tsconfig.app.json" },
    { path: "./tsconfig.agent.json" },
    { path: "./tsconfig.cli.json" },
  ]);
});
