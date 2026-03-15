export async function runTask([cmd, ...args]: string[]) {
  const cwd = process.cwd();
  const module = await import(`${cwd}/task/${cmd}.js`);
  return await module.run(args);
}
