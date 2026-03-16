import { $ } from "bun";

export async function run() {
  try {
    await $`tsgo --noEmit`;
    await $`oxfmt`;
    await $`oxlint --fix`;
    await $`bun test`;
  } catch (err: any) {
    console.log(err.stderr.toString());
    process.exit(err.exitCode);
  }
}
