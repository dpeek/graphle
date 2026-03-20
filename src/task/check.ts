import { $ } from "bun";

export async function run([path]: string[]) {
  try {
    await $`tsgo --noEmit`;
    await $`oxfmt ${path}`;
    await $`oxlint --fix ${path}`;
    await $`bun test ${path}`;
  } catch (err: any) {
    console.log(err.stderr?.toString?.() ?? String(err));
    process.exit(err.exitCode ?? 1);
  }
}
