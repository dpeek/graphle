import { $ } from "bun";

export async function run(paths: string[]) {
  const targets = paths.length > 0 ? paths : ["src", "lib"];

  try {
    await $`tsgo --noEmit`;
    await $`oxfmt ${targets}`;
    await $`oxlint --fix ${targets}`;
    await $`bun test ${targets}`;
  } catch (err: any) {
    console.log(err.stderr?.toString?.() ?? String(err));
    process.exit(err.exitCode ?? 1);
  }
}
