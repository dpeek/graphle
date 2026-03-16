import { $ } from "bun";

async function exec(command: string) {
  try {
    console.log(`Running ${command}`);
    const output = await $`${command}`.text();
    console.log(output);
  } catch (err: any) {
    console.log(`Failed with code ${err.exitCode}`);
    console.log(err.stdout.toString());
    console.log(err.stderr.toString());
    process.exit(err.exitCode);
  }
}

export async function run() {
  await exec("tsgo --noEmit");
  await exec("oxfmt");
  await exec("oxlint --fix");
  await exec("bun test");
}
