import { describe, expect, it } from "bun:test";

import { bootstrap, createStore, createTypeClient, core } from "@io/graph";
import { act, create, type ReactTestInstance } from "react-test-renderer";

import { app } from "../graph/app.js";
import { EnvVarSettingsSurface } from "./env-vars.js";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

function findByProp(
  renderer: ReturnType<typeof create>,
  prop: string,
  value: string,
): ReactTestInstance {
  return renderer.root.find((node) => node.props[prop] === value);
}

function collectText(node: ReactTestInstance): string {
  return node.children
    .map((child) => (typeof child === "string" ? child : collectText(child)))
    .join(" ");
}

function createRuntime() {
  const store = createStore();
  bootstrap(store, core);
  bootstrap(store, app);
  const graph = createTypeClient(store, app);
  return {
    graph,
    sync: {
      async sync() {},
    },
  };
}

describe("env-var settings surface", () => {
  it("creates a new env var through the mutation flow and refreshes the list without rendering plaintext metadata", async () => {
    const runtime = createRuntime();
    const submitted: Array<{
      readonly id?: string;
      readonly name: string;
      readonly description?: string;
      readonly secretValue?: string;
    }> = [];

    let renderer: ReturnType<typeof create> | undefined;
    await act(async () => {
      renderer = create(
        <EnvVarSettingsSurface
          runtime={runtime}
          submitEnvVar={async (input) => {
            submitted.push(input);
            const secretId = runtime.graph.secretRef.create({
              name: `${input.name} secret`,
              version: 1,
              lastRotatedAt: new Date("2026-03-13T00:00:00.000Z"),
            });
            const envVarId = runtime.graph.envVar.create({
              name: input.name,
              description: input.description,
              secret: secretId,
            });
            return {
              envVarId,
              created: true,
              rotated: true,
              secretVersion: 1,
            };
          }}
        />,
      );
    });

    const newButton = findByProp(renderer!, "data-env-var-new", "button");
    const nameInput = findByProp(renderer!, "data-env-var-input", "name");
    const descriptionInput = findByProp(renderer!, "data-env-var-input", "description");
    const secretInput = findByProp(renderer!, "data-env-var-input", "secret");
    const form = renderer!.root.findByType("form");

    await act(async () => {
      newButton.props.onClick();
      nameInput.props.onChange({ target: { value: "OPENAI_API_KEY" } });
      descriptionInput.props.onChange({ target: { value: "Primary model credential" } });
      secretInput.props.onChange({ target: { value: "sk-test-secret" } });
    });

    await act(async () => {
      form.props.onSubmit({ preventDefault() {} });
    });

    expect(submitted).toEqual([
      {
        name: "OPENAI_API_KEY",
        description: "Primary model credential",
        secretValue: "sk-test-secret",
      },
    ]);
    expect(collectText(renderer!.root)).toContain("OPENAI_API_KEY");
    expect(collectText(renderer!.root)).toContain("Created OPENAI_API_KEY.");
    expect(collectText(renderer!.root)).not.toContain("sk-test-secret");

    act(() => {
      renderer?.unmount();
    });
  });

  it("keeps the secret field blank while editing and omits empty rotations from the mutation payload", async () => {
    const runtime = createRuntime();
    const secretId = runtime.graph.secretRef.create({
      name: "SLACK_BOT_TOKEN secret",
      version: 3,
      lastRotatedAt: new Date("2026-03-10T10:00:00.000Z"),
    });
    const envVarId = runtime.graph.envVar.create({
      name: "SLACK_BOT_TOKEN",
      description: "Workspace notifications",
      secret: secretId,
    });
    runtime.sync.sync = async () => {
      runtime.graph.envVar.update(envVarId, {
        name: "SLACK_BOT_TOKEN",
        description: "Updated notifications integration",
      });
    };

    const submitted: Array<{
      readonly id?: string;
      readonly name: string;
      readonly description?: string;
      readonly secretValue?: string;
    }> = [];

    let renderer: ReturnType<typeof create> | undefined;
    await act(async () => {
      renderer = create(
        <EnvVarSettingsSurface
          runtime={runtime}
          submitEnvVar={async (input) => {
            submitted.push(input);
            return {
              envVarId,
              created: false,
              rotated: false,
              secretVersion: 3,
            };
          }}
        />,
      );
    });

    const secretInput = findByProp(renderer!, "data-env-var-input", "secret");
    const descriptionInput = findByProp(renderer!, "data-env-var-input", "description");
    const form = renderer!.root.findByType("form");

    expect(secretInput.props.value).toBe("");

    await act(async () => {
      descriptionInput.props.onChange({ target: { value: "Updated notifications integration" } });
    });

    await act(async () => {
      form.props.onSubmit({ preventDefault() {} });
    });

    expect(submitted).toEqual([
      {
        id: envVarId,
        name: "SLACK_BOT_TOKEN",
        description: "Updated notifications integration",
        secretValue: undefined,
      },
    ]);
    expect(collectText(renderer!.root)).toContain("Saved SLACK_BOT_TOKEN.");
    expect(collectText(renderer!.root)).toContain("v3");

    act(() => {
      renderer?.unmount();
    });
  });
});
