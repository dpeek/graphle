export async function runTask([cmd, ...args]: string[]) {
  const module = await import(`../task/${cmd}.js`);
  return await module.run(args);
}
