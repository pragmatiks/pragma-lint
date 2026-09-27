/**
 * The color concept: color literals in arbitrary values, and references to Tailwind's default
 * palette.
 *
 * @packageDocumentation
 */
import {
  type CssNode,
  type CssNodePlain,
  lexer,
  type ValuePlain,
} from "@eslint/css-tree";

import {
  type Declaration,
  firstIdentifierArgument,
  isVariableReference,
  listCssChildren,
  listValueNodes,
  parseValue,
  splitOnCommas,
} from "../css-declarations.js";
import type { ClassCandidate, DesignSystemView } from "../design-system.js";

/**
 * Report message for a default-palette color, with `source` and `variable` placeholders.
 */
export const DEFAULT_PALETTE_MESSAGE =
  "{{source}} uses {{variable}} from Tailwind's default palette; use a project color token.";

const COLOR_FUNCTIONS = new Set([
  "rgb",
  "rgba",
  "hsl",
  "hsla",
  "hwb",
  "lab",
  "lch",
  "oklab",
  "oklch",
  "color",
]);
const KEYWORD_COLORS = new Set(["transparent", "currentcolor"]);
const THEME_COLOR = /^--color-/;
const THEME_FUNCTIONS = new Set(["var", "theme", "--theme"]);

/**
 * Tells whether a node is `transparent` or `currentcolor`.
 *
 * @param node - A plain css-tree node.
 * @returns `true` for either keyword, in any letter case.
 */
function isKeywordColor(node: CssNodePlain | undefined): boolean {
  return (
    node?.type === "Identifier" && KEYWORD_COLORS.has(node.name.toLowerCase())
  );
}

/**
 * Tells whether a node is a named color literal such as `red`.
 *
 * @param node - A plain css-tree node.
 * @returns `true` for named colors other than `transparent` and `currentcolor`.
 */
function isNamedColor(node: CssNodePlain): boolean {
  return (
    node.type === "Identifier" &&
    !isKeywordColor(node) &&
    lexer.matchType("named-color", node).error === null
  );
}

/**
 * Lists a function's arguments without separators.
 *
 * @param node - A plain css-tree node.
 * @returns The non-operator children of a function; empty for other nodes.
 */
function functionArguments(node: CssNodePlain): CssNodePlain[] {
  return node.type === "Function"
    ? node.children.filter((child) => child.type !== "Operator")
    : [];
}

/**
 * Tells whether a color function takes all its channels from tokens.
 *
 * @param node - A color function such as `oklch(...)`.
 * @returns `true` when every channel is `var()`, or for relative syntax, when the origin is
 *   `var()` and every channel is a keyword or `var()`.
 */
function hasTokenChannels(node: CssNodePlain): boolean {
  const name = node.type === "Function" ? node.name.toLowerCase() : "";
  const [first, ...rest] = functionArguments(node);
  if (first?.type === "Identifier" && first.name.toLowerCase() === "from") {
    const [origin, ...channels] = rest;
    const skipped = name === "color" ? channels.slice(1) : channels;
    return (
      isVariableReference(origin) &&
      skipped.every(
        (channel) =>
          channel.type === "Identifier" || isVariableReference(channel),
      )
    );
  }
  const channels =
    name === "color" && first?.type === "Identifier" ? rest : [first, ...rest];
  return channels.every((channel) => isVariableReference(channel));
}

/**
 * Tells whether every color operand of a `color-mix()` is a token.
 *
 * @param node - A `color-mix()` function.
 * @returns `true` when every operand after the interpolation method is made of percentages,
 *   `var()`, `transparent` or `currentcolor`.
 */
function hasTokenOperands(node: CssNodePlain): boolean {
  const [, ...operands] = splitOnCommas(
    node.type === "Function" ? node.children : [],
  );
  return operands.every((operand) =>
    operand.every(
      (part) =>
        part.type === "Percentage" ||
        isVariableReference(part) ||
        isKeywordColor(part),
    ),
  );
}

/**
 * Tells whether a node contains a color literal.
 *
 * @param node - A plain css-tree node.
 * @returns `true` for hex and named colors, color functions with a literal channel, `color-mix()`
 *   with a literal operand, and any of these nested in a `var()` fallback or another function.
 */
function containsLiteral(node: CssNodePlain): boolean {
  if (node.type === "Hash" || isNamedColor(node)) {
    return true;
  }
  if (
    node.type !== "Function" &&
    node.type !== "Value" &&
    node.type !== "Parentheses"
  ) {
    return false;
  }
  const name = node.type === "Function" ? node.name.toLowerCase() : "";
  if (name === "var") {
    return splitOnCommas(node.children)
      .slice(1)
      .some((fallback) => fallback.some((part) => containsLiteral(part)));
  }
  if (COLOR_FUNCTIONS.has(name)) {
    return !hasTokenChannels(node);
  }
  if (name === "color-mix") {
    return !hasTokenOperands(node);
  }
  return node.children.some((child) => containsLiteral(child));
}

/**
 * Tells whether an authored arbitrary value writes a color literal instead of a token.
 *
 * Flags hex colors, named colors other than `transparent` and `currentcolor`, and color
 * functions with any literal channel or alpha, including inside `var()` fallbacks. Relative color
 * syntax passes only with a `var()` origin and keyword or `var()` channels; `color-mix` passes
 * when every color operand is `var()`, `transparent` or `currentcolor`. Strings and URLs are never
 * colors.
 *
 * @param text - An arbitrary value or modifier as written inside `[...]`.
 * @returns `true` when the value contains a color literal.
 */
export function containsColorLiteral(text: string): boolean {
  return containsLiteral(parseValue(text));
}

/**
 * Replaces each `var()` that has a fallback with that fallback, at any depth.
 *
 * @param node - A plain css-tree node.
 * @returns The node with fallbacks in place of `var()` calls, as a list because a fallback can be
 *   several nodes; a `var()` without a fallback stays as it is.
 */
function substituteVariableFallbacks(node: CssNodePlain): CssNodePlain[] {
  if (isVariableReference(node)) {
    const comma = node.children.findIndex(
      (child) => child.type === "Operator" && child.value === ",",
    );
    return comma === -1
      ? [node]
      : node.children
          .slice(comma + 1)
          .flatMap((child) => substituteVariableFallbacks(child));
  }
  const children = listCssChildren(node);
  if (children.length === 0) {
    return [node];
  }
  const substituted = children.flatMap((child) =>
    substituteVariableFallbacks(child),
  );
  return [{ ...node, children: substituted } as CssNodePlain];
}

/**
 * Tells whether a declaration can set a color, so a color literal in it is a color choice.
 *
 * Each `var()` with a fallback is judged as its fallback. Custom properties can hold anything,
 * and values the CSS grammar still cannot match (such as a `var()` without a fallback) are
 * assumed to set one.
 *
 * @param declaration - A compiled class declaration.
 * @returns `true` for custom properties, unmatchable values, and values with a node in a `<color>`
 *   position; `false` for, say, `grid-area: red`, `grid-area: var(--area, red)` or
 *   `animation: red 1s`.
 */
export function canSetColor(declaration: Declaration): boolean {
  if (declaration.property.startsWith("--")) {
    return true;
  }
  const [value = declaration.value] = substituteVariableFallbacks(
    declaration.value,
  );
  const match = lexer.matchProperty(declaration.property, value);
  if (match.error !== null) {
    return true;
  }
  return listValueNodes(value).some((node) =>
    match.isType(node as unknown as CssNode, "color"),
  );
}

/**
 * Builds the theme color variable a parse's value names.
 *
 * @param candidate - One parse of a class token.
 * @returns `--color-<value>`.
 */
function themeColorVariable(candidate: ClassCandidate): string {
  return `--color-${candidate.value ?? ""}`;
}

/**
 * Reads the theme value of the project color a parse names.
 *
 * @param candidate - One parse of a class token.
 * @param view - The project design system.
 * @returns The theme value of a named value whose `--color-*` variable the project defines,
 *   including an `@theme inline` color that aliases a default-palette color; `undefined` for any
 *   other parse.
 */
function projectThemeValue(
  candidate: ClassCandidate,
  view: DesignSystemView,
): string | undefined {
  const variable = themeColorVariable(candidate);
  return candidate.valueKind === "named" &&
    !view.isDefaultThemeVariable(variable)
    ? view.themeValue(variable)
    : undefined;
}

/**
 * Tells whether a parse names a color the project theme defines.
 *
 * @param candidate - One parse of a class token.
 * @param view - The project design system.
 * @returns `true` for a named value whose `--color-*` variable the project defines, including an
 *   `@theme inline` color that aliases a default-palette color.
 */
export function isProjectThemeColor(
  candidate: ClassCandidate,
  view: DesignSystemView,
): boolean {
  return projectThemeValue(candidate, view) !== undefined;
}

/**
 * Lists the Tailwind default-palette colors behind the project theme color a parse names.
 *
 * @param candidate - One parse of a class token.
 * @param view - The project design system.
 * @returns The default-palette `--color-*` names the project color's theme value references, such
 *   as `--color-red-500` for an `@theme inline` alias of it; empty when the parse names no project
 *   color.
 */
export function listAliasedPaletteColors(
  candidate: ClassCandidate,
  view: DesignSystemView,
): string[] {
  const value = projectThemeValue(candidate, view);
  return value === undefined
    ? []
    : listDefaultPaletteColors(parseValue(value), view);
}

/**
 * Lists the Tailwind default-palette color variables a value references.
 *
 * @param value - A parsed declaration value.
 * @param view - The project design system.
 * @returns The `--color-*` names, referenced through `var()`, `theme()` or `--theme()`, that come
 *   from Tailwind's default theme, not the project.
 */
export function listDefaultPaletteColors(
  value: ValuePlain,
  view: DesignSystemView,
): string[] {
  return listValueNodes(value).flatMap((node) => {
    const isThemeReference =
      node.type === "Function" && THEME_FUNCTIONS.has(node.name.toLowerCase());
    const name = isThemeReference ? firstIdentifierArgument(node) : undefined;
    const isDefaultColor =
      name !== undefined &&
      THEME_COLOR.test(name) &&
      view.isDefaultThemeVariable(name);
    return isDefaultColor ? [name] : [];
  });
}
