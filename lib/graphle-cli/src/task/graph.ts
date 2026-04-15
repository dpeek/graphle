import { createHttpGraphClient } from "../../../graphle-client/src";
import { core, coreGraphBootstrapOptions } from "../../../graphle-module-core/src";
import { workflow } from "../../../graphle-module-workflow/src";

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
