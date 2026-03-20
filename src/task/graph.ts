import { pkm } from "@io/core/graph/schema/pkm";

import { createHttpGraphClient } from "../graph/index.js";

export async function run() {
  const client = await createHttpGraphClient(pkm);
  const topics = await client.graph.topic.query({
    select: {
      content: true,
      id: true,
      name: true,
    },
  });

  console.log(topics);
}
