import { createHttpGraphClient } from "@dpeek/graphle-client";
import { core, coreGraphBootstrapOptions } from "@dpeek/graphle-module-core";
import { workflow } from "@dpeek/graphle-module-workflow";

export async function run() {
  const client = await createHttpGraphClient(workflow, {
    bootstrap: coreGraphBootstrapOptions,
    definitions: { ...core, ...workflow },
  });
  const documents = await client.graph.document.query({
    select: {
      description: true,
      id: true,
      name: true,
      slug: true,
    },
  });

  console.log(documents);
}
