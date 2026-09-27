/**
 * Checks `z-index` declarations against the project cap.
 *
 * @packageDocumentation
 */
import type { CssNodePlain, ValuePlain } from "@eslint/css-tree";

import {
  type Declaration,
  firstIdentifierArgument,
  isVariableReference,
  listCssChildren,
  parseValue,
} from "../css-declarations.js";
import type { DesignSystemView } from "../design-system.js";

/**
 * The highest z-index a declaration may set.
 */
export const Z_INDEX_CAP = 50;

/**
 * Report message for a z-index finding, with a `source` placeholder.
 */
export const Z_INDEX_MESSAGE = `z-index must be at most ${String(Z_INDEX_CAP)}, negative, auto, or a var() whose theme value or fallback is; {{source}} is not. To fix it, use the scale up to ${String(Z_INDEX_CAP)} or a named layer such as z-(--layer).`;

/**
 * How many nested `var()` resolutions a value may take before it counts as unverifiable.
 */
const MAX_VARIABLE_DEPTH = 4;

/**
 * Lists the arguments of a `calc()` call.
 *
 * @param node - A plain css-tree node.
 * @returns The `calc()` children, or an empty list for any other node.
 */
function calcArguments(node: CssNodePlain): CssNodePlain[] {
  return node.type === "Function" && node.name.toLowerCase() === "calc"
    ? node.children
    : [];
}

/**
 * Computes the product of a `calc(a * b)` call over two plain numbers.
 *
 * @param node - A plain css-tree node.
 * @returns The product, or `undefined` for any other node.
 */
function computeProduct(node: CssNodePlain): number | undefined {
  const [left, operator, right, ...rest] = calcArguments(node);
  const isMultiplication =
    operator?.type === "Operator" && operator.value === "*";
  if (
    rest.length > 0 ||
    !isMultiplication ||
    left?.type !== "Number" ||
    right?.type !== "Number"
  ) {
    return undefined;
  }
  return Number(left.value) * Number(right.value);
}

/**
 * Resolves a `var()` call through the theme, then through its fallback.
 *
 * @param node - A `var()` function node.
 * @param view - The project design system that resolves theme variables.
 * @returns The parsed theme value, else the fallback value, else `undefined`.
 */
function resolveVariable(
  node: CssNodePlain,
  view: DesignSystemView,
): ValuePlain | undefined {
  const name = firstIdentifierArgument(node);
  const themeValue = name === undefined ? undefined : view.themeValue(name);
  if (themeValue !== undefined) {
    return parseValue(themeValue);
  }
  const fallback = listCssChildren(node).at(2);
  return fallback?.type === "Value" ? fallback : undefined;
}

/**
 * Tells whether a single-node value is within the cap, resolving `var()` up to a depth.
 *
 * @param value - A declaration value.
 * @param view - The project design system that resolves theme variables.
 * @param depth - How many more `var()` resolutions may follow.
 * @returns `true` when the value passes the cap.
 */
function isAllowedValue(
  value: ValuePlain,
  view: DesignSystemView,
  depth: number,
): boolean {
  const [node, ...rest] = value.children;
  if (rest.length > 0 || !node) {
    return false;
  }
  if (node.type === "Number") {
    return Number(node.value) <= Z_INDEX_CAP;
  }
  if (node.type === "Identifier") {
    return node.name.toLowerCase() === "auto";
  }
  if (isVariableReference(node)) {
    const resolved = resolveVariable(node, view);
    return (
      resolved === undefined ||
      (depth > 0 && isAllowedValue(resolved, view, depth - 1))
    );
  }
  const product = computeProduct(node);
  return product !== undefined && product <= Z_INDEX_CAP;
}

/**
 * Tells whether a `z-index` declaration breaks the cap.
 *
 * Numbers up to the cap (negative numbers included), `auto`, and `calc(a * b)` whose product is at
 * most the cap pass. A `var()` is resolved through the theme, or through its fallback when the
 * theme does not define it, and the result is checked the same way; a `var()` with neither passes.
 * Anything else fails.
 *
 * @param declaration - Any declaration; other properties never break the cap.
 * @param view - The project design system that resolves theme variables.
 * @returns `true` when the declaration sets a z-index above the cap or an unverifiable one.
 */
export function exceedsZIndexCap(
  declaration: Declaration,
  view: DesignSystemView,
): boolean {
  return (
    declaration.property === "z-index" &&
    !isAllowedValue(declaration.value, view, MAX_VARIABLE_DEPTH)
  );
}
