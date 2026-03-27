import { describe, expect, it } from "bun:test";

import {
  fieldSecretMetadataVisibility,
  fieldVisibility,
  fieldWritePolicy,
  isSecretBackedField,
} from "@io/graph-kernel";

import {
  defineDefaultEnumTypeModule,
  defineEnum,
  defineSecretField,
  defineType,
  defineValidatedStringTypeModule,
  existingEntityReferenceField,
  existingEntityReferenceFieldMeta,
  readDefinitionIconId,
} from "./index.js";

const secretHandle = defineType({
  values: { key: "probe:secretHandle", name: "Secret Handle" },
  fields: {},
});

const status = defineEnum({
  values: { key: "probe:status", name: "Status" },
  options: {
    draft: { name: "Draft" },
    published: { name: "Published" },
  },
});

const statusTypeModule = defineDefaultEnumTypeModule(status);

const emailTypeModule = defineValidatedStringTypeModule({
  values: { key: "probe:email", name: "Email" },
  parse: (raw: string) => raw.trim().toLowerCase(),
  filter: {
    defaultOperator: "equals",
    operators: {
      equals: {
        label: "Equals",
        operand: {
          kind: "string",
          placeholder: "team@example.com",
        },
        parse: (raw: string) => raw.trim().toLowerCase(),
        format: (operand: string) => operand,
        test: (value: string, operand: string) => value === operand,
      },
      domain: {
        label: "Domain",
        operand: {
          kind: "string",
          placeholder: "example.com",
        },
        parse: (raw: string) => raw.trim().toLowerCase(),
        format: (operand: string) => operand,
        test: (value: string, operand: string) => value.endsWith(`@${operand}`),
      },
    },
  },
  placeholder: "team@example.com",
  inputType: "email",
  inputMode: "email",
  autocomplete: "email",
});

const replicatedSecretField = defineSecretField({
  range: secretHandle,
  cardinality: "one?",
});

const hiddenSecretField = defineSecretField({
  range: secretHandle,
  cardinality: "one?",
  authority: {
    visibility: "authority-only",
    write: "authority-only",
  },
});

const explicitSecretMetadataField = defineSecretField({
  range: secretHandle,
  cardinality: "one?",
  authority: {
    visibility: "authority-only",
  },
  metadataVisibility: "replicated",
  revealCapability: "secret:reveal",
  rotateCapability: "secret:rotate",
});

describe("@io/graph-module", () => {
  it("authors secret-backed fields without reimplementing kernel authority rules", () => {
    expect(fieldVisibility(replicatedSecretField)).toBe("replicated");
    expect(fieldWritePolicy(replicatedSecretField)).toBe("server-command");
    expect(fieldSecretMetadataVisibility(replicatedSecretField)).toBe("replicated");
    expect(isSecretBackedField(replicatedSecretField)).toBe(true);

    expect(fieldVisibility(hiddenSecretField)).toBe("authority-only");
    expect(fieldWritePolicy(hiddenSecretField)).toBe("authority-only");
    expect(fieldSecretMetadataVisibility(hiddenSecretField)).toBe("authority-only");

    expect(fieldVisibility(explicitSecretMetadataField)).toBe("authority-only");
    expect(fieldWritePolicy(explicitSecretMetadataField)).toBe("server-command");
    expect(fieldSecretMetadataVisibility(explicitSecretMetadataField)).toBe("replicated");
    expect(explicitSecretMetadataField.authority.secret).toEqual({
      kind: "sealed-handle",
      metadataVisibility: "replicated",
      revealCapability: "secret:reveal",
      rotateCapability: "secret:rotate",
    });
  });

  it("authors existing-entity reference policies as reusable field metadata", () => {
    expect(
      existingEntityReferenceFieldMeta({
        label: "Related items",
        create: true,
        excludeSubject: true,
        editorKind: "entity-reference-combobox",
        collection: "unordered",
      }),
    ).toEqual({
      label: "Related items",
      reference: {
        selection: "existing-only",
        create: true,
        excludeSubject: true,
      },
      editor: {
        kind: "entity-reference-combobox",
      },
      collection: {
        kind: "unordered",
      },
    });

    const field = existingEntityReferenceField(secretHandle, {
      cardinality: "many",
      label: "Related nodes",
      create: true,
    });

    expect(field.range).toBe(secretHandle);
    expect(field).toMatchObject({
      cardinality: "many",
      meta: {
        label: "Related nodes",
        reference: {
          selection: "existing-only",
          create: true,
        },
      },
    });
  });

  it("ships generic enum-module defaults outside the built-in core module tree", () => {
    const field = statusTypeModule.field({
      cardinality: "one",
      meta: {
        display: {
          kind: "badge",
        },
      },
      filter: {
        operators: ["is"] as const,
      },
    });

    expect(statusTypeModule.type).toBe(status);
    expect(field.meta.display.kind).toBe("badge");
    expect(field.meta.editor.kind).toBe("select");
    expect(field.filter.defaultOperator).toBe("is");
    expect(Object.keys(field.filter.operators)).toEqual(["is"]);
  });

  it("ships generic validated-string helpers outside the built-in core module tree", () => {
    const field = emailTypeModule.field({
      cardinality: "one",
      filter: {
        operators: ["equals"] as const,
      },
    });

    expect(emailTypeModule.type.values.key).toBe("probe:email");
    expect(field.meta.editor.inputType).toBe("email");
    expect(field.meta.editor.inputMode).toBe("email");
    expect(field.meta.editor.autocomplete).toBe("email");
    expect(field.meta.editor.parse?.(" TEAM@ACME.COM ")).toBe("team@acme.com");
    expect(field.filter.defaultOperator).toBe("equals");
    expect(Object.keys(field.filter.operators)).toEqual(["equals"]);
  });

  it("re-exports icon-ref reading for definition-time callers", () => {
    expect(readDefinitionIconId("seed:icon:domain")).toBe("seed:icon:domain");
    expect(readDefinitionIconId({ id: "seed:icon:domain" })).toBe("seed:icon:domain");
    expect(readDefinitionIconId({ id: "" })).toBeUndefined();
    expect(readDefinitionIconId(undefined)).toBeUndefined();
  });
});
