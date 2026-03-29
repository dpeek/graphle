declare module "better-sqlite3" {
  // `auth.ts` uses better-sqlite3 only as an opaque CLI-time sqlite driver so
  // Better Auth can infer migrations outside the Worker runtime.
  const Database: any;

  export default Database;
}
