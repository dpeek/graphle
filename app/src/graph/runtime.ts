import { app } from "./app"
import { bootstrap } from "./bootstrap"
import { createTypeClient } from "./client"
import { core } from "./core"
import { seedExampleGraph } from "./example-data"
import { createStore } from "./store"
import { createSyncedTypeClient, createTotalSyncPayload } from "./sync"

function createExampleAuthorityGraph() {
  const store = createStore()
  bootstrap(store, core)
  bootstrap(store, app)

  const graph = createTypeClient(store, app)
  const ids = seedExampleGraph(graph)

  return {
    store,
    ids,
  }
}

export function createExampleRuntime() {
  const authority = createExampleAuthorityGraph()
  const runtime = createSyncedTypeClient(app, {
    pull: () => createTotalSyncPayload(authority.store, { cursor: "example:initial" }),
  })

  runtime.sync.apply(createTotalSyncPayload(authority.store, { cursor: "example:initial" }))

  return {
    ...runtime,
    app,
    ids: authority.ids,
  }
}
