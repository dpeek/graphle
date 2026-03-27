import type { PredicateFieldEditorCapability, PredicateFieldViewCapability } from "@io/graph-react";
import {
  genericWebFieldEditorCapabilities as genericBrowserFieldEditorCapabilities,
  genericWebFieldViewCapabilities as genericBrowserFieldViewCapabilities,
} from "@io/graph-react-dom";

import { DurationFieldEditor, durationFieldViewCapability } from "./fields/duration.js";
import { MoneyFieldEditor, moneyFieldViewCapability } from "./fields/money.js";
import { QuantityFieldEditor, quantityFieldViewCapability } from "./fields/quantity.js";
import { RangeFieldEditor, rangeFieldViewCapability } from "./fields/range.js";
import { RateFieldEditor, rateFieldViewCapability } from "./fields/rate.js";
import {
  EntityReferenceComboboxEditor,
  entityReferenceListViewCapability,
} from "./fields/reference.js";

/** Built-in browser field view capabilities for the current DOM adapter. */
export const genericWebFieldViewCapabilities = [
  ...genericBrowserFieldViewCapabilities,
  durationFieldViewCapability,
  quantityFieldViewCapability,
  rangeFieldViewCapability,
  rateFieldViewCapability,
  moneyFieldViewCapability,
  entityReferenceListViewCapability,
] satisfies readonly PredicateFieldViewCapability<any, any>[];

/** Built-in browser field editor capabilities for the built-in core module. */
export const genericWebFieldEditorCapabilities = [
  ...genericBrowserFieldEditorCapabilities,
  { kind: "number/duration", Component: DurationFieldEditor },
  { kind: "number/quantity", Component: QuantityFieldEditor },
  { kind: "number/range", Component: RangeFieldEditor },
  { kind: "number/rate", Component: RateFieldEditor },
  { kind: "money/amount", Component: MoneyFieldEditor },
  { kind: "entity-reference-combobox", Component: EntityReferenceComboboxEditor },
] satisfies readonly PredicateFieldEditorCapability<any, any>[];
