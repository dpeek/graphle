import { createAppAuthority } from "./authority.js";
import { createAppServerRoutes } from "./server-app.js";

const authority = await createAppAuthority();

Bun.serve({
  routes: createAppServerRoutes(authority),
});
