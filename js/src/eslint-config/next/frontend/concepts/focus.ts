/**
 * The focus concept: which class tokens and CSS declarations change the focus indicator, and the
 * P1 class pattern and C1 CSS pattern that may.
 *
 * @packageDocumentation
 */
import {
  type AtrulePlain,
  type CssNodePlain,
  lexer,
  property as describeProperty,
  type RulePlain,
  type ValuePlain,
} from "@eslint/css-tree";

import {
  CSS_WIDE_KEYWORDS,
  type Declaration,
  focusVariant,
  listCssChildren,
  listValueNodes,
  referencedVariable,
} from "../css-declarations.js";
import type { ClassCandidate, DesignSystemView } from "../design-system.js";
import { isProjectThemeColor } from "./color.js";

/**
 * A part of the P1 pattern a focus-scoped token can fill.
 */
type P1Role =
  | "outline-hidden"
  | "ring-width"
  | "ring-color"
  | "offset-width"
  | "zero-offset-width"
  | "offset-color";

/**
 * A Tailwind ring utility (`ring` or `ring-offset`) with the variables its width and color set.
 */
interface RingFamily {
  /** The Tailwind utility root. */
  readonly utility: string;
  /** The variable a width token of the family sets. */
  readonly widthVariable: string;
  /** Finds the P1 role a parse of a width token fills, or `undefined` for a width outside P1. */
  readonly widthRole: (candidate: ClassCandidate) => P1Role | undefined;
  /** The variable a color token of the family sets. */
  readonly colorVariable: string;
  /** The P1 role a project token color fills. */
  readonly colorRole: P1Role;
}

/**
 * The outcome of checking one class group against the P1 focus pattern.
 */
export interface FocusGroupVerdict {
  /** The tokens that can change the focus indicator. */
  readonly scoped: readonly string[];
  /** The scoped tokens that fill no P1 part. */
  readonly offending: readonly string[];
  /** The labels of P1 parts that are missing or repeated. */
  readonly outOfRange: readonly string[];
}

const FOCUS_SELECTOR = /(?<!\\):focus/;
const SHADOW_VARIABLES = new Set(["--tw-shadow", "--tw-inset-shadow"]);
const OUTLINE_WIDTH_KEYWORDS = new Set(["thin", "medium", "thick"]);
const EARLY_LAYERS = new Set(["theme", "base", "components"]);
const RING_SHADOW_VARIABLES = ["--tw-ring-offset-shadow", "--tw-ring-shadow"];
const UNPAIRED_OFFSET_LABEL =
  "a ring offset color only alongside focus-visible:ring-offset-<n> (required when above 0)";
const ROLE_LIMITS: Readonly<
  Record<P1Role, { minimum: number; maximum: number; label: string }>
> = {
  "outline-hidden": {
    minimum: 1,
    maximum: 1,
    label: "focus-visible:outline-hidden",
  },
  "ring-width": {
    minimum: 1,
    maximum: 1,
    label: "focus-visible:ring or focus-visible:ring-<n>",
  },
  "ring-color": { minimum: 0, maximum: 1, label: "one ring color" },
  "offset-width": { minimum: 0, maximum: 1, label: "one ring offset" },
  "zero-offset-width": { minimum: 0, maximum: 1, label: "one ring offset" },
  "offset-color": { minimum: 0, maximum: 1, label: "one ring offset color" },
};
const RING_FAMILIES: readonly RingFamily[] = [
  {
    utility: "ring-offset",
    widthVariable: "--tw-ring-offset-width",
    widthRole: offsetWidthRole,
    colorVariable: "--tw-ring-offset-color",
    colorRole: "offset-color",
  },
  {
    utility: "ring",
    widthVariable: "--tw-ring-shadow",
    widthRole: ringWidthRole,
    colorVariable: "--tw-ring-color",
    colorRole: "ring-color",
  },
];

/**
 * Tells whether a selector targets a focus state.
 *
 * @param selector - Selector text, possibly containing escaped class names.
 * @returns `true` for `:focus`, `:focus-visible` and `:focus-within`, outside escaped class names.
 */
export function isFocusSelector(selector: string): boolean {
  return FOCUS_SELECTOR.test(selector);
}

/**
 * Tells whether a CSS property always affects the focus indicator, wherever it is written.
 *
 * @param property - A CSS property name, vendor-prefixed or not.
 * @returns `true` for `outline*`, `forced-color-adjust`, `all` and ring variables.
 */
export function isFocusIndicatorProperty(property: string): boolean {
  const name = describeProperty(property).basename;
  return (
    name.startsWith("outline") ||
    name.startsWith("--tw-ring-") ||
    name.startsWith("--tw-inset-ring-") ||
    name === "forced-color-adjust" ||
    name === "all"
  );
}

/**
 * Tells whether a CSS property is `box-shadow` or a vendor alias of it.
 *
 * @param property - A CSS property name.
 * @returns `true` for `box-shadow` and aliases such as `-webkit-box-shadow`.
 */
export function isBoxShadowProperty(property: string): boolean {
  return describeProperty(property).basename === "box-shadow";
}

/**
 * Tells whether a shadow value composes the Tailwind ring offset and ring.
 *
 * @param declaration - A `box-shadow` declaration.
 * @returns `true` when the value references both ring shadow variables.
 */
function composesRing(declaration: Declaration): boolean {
  const variables = new Set(
    listValueNodes(declaration.value).flatMap((node) => {
      const name = referencedVariable(node);
      return name === undefined ? [] : [name];
    }),
  );
  return RING_SHADOW_VARIABLES.every((variable) => variables.has(variable));
}

/**
 * Tells whether a shadow variable is set to something that can be a shadow.
 *
 * @param declaration - A `--tw-shadow` or `--tw-inset-shadow` declaration.
 * @returns `false` for `none` and CSS-wide keywords; `true` for `var()` and valid shadows.
 */
function isShadowValue(declaration: Declaration): boolean {
  const text = declaration.text.trim().toLowerCase();
  if (text === "none" || CSS_WIDE_KEYWORDS.has(text)) {
    return false;
  }
  return (
    text.includes("var(") ||
    lexer.matchProperty("box-shadow", declaration.value).error === null
  );
}

/**
 * Tells whether a declaration clears one of the shadow variables the Tailwind ring composes with.
 *
 * @param declaration - Any declaration.
 * @returns `true` when `--tw-shadow` or `--tw-inset-shadow` is set to something other than a shadow,
 *   such as `none`, which removes the ring.
 */
export function isShadowVariableReset(declaration: Declaration): boolean {
  return (
    SHADOW_VARIABLES.has(declaration.property) && !isShadowValue(declaration)
  );
}

/**
 * Tells whether a compiled class declaration can change the focus indicator.
 *
 * @param declaration - A declaration a class token compiles to.
 * @returns `true` under a focus selector, for indicator properties and `--tw-outline-style`, for
 *   shadows that do not compose the ring, and for shadow-variable resets.
 */
function isScopedClassDeclaration(declaration: Declaration): boolean {
  return (
    declaration.selectors.some((selector) => isFocusSelector(selector)) ||
    isFocusIndicatorProperty(declaration.property) ||
    declaration.property === "--tw-outline-style" ||
    (isBoxShadowProperty(declaration.property) && !composesRing(declaration)) ||
    isShadowVariableReset(declaration)
  );
}

/**
 * Tells whether a class token can change the focus indicator, so it must be part of P1.
 *
 * @param token - One class token.
 * @param view - The project design system.
 * @returns `true` when the token is in the focus scope.
 */
export function isFocusScopedToken(
  token: string,
  view: DesignSystemView,
): boolean {
  const declarations = view.declarationsOf(token);
  if (!declarations) {
    return false;
  }
  return (
    declarations.some((declaration) => isScopedClassDeclaration(declaration)) ||
    view
      .candidatesOf(token)
      .some(
        (candidate) =>
          candidate.arbitraryProperty &&
          SHADOW_VARIABLES.has(candidate.utility),
      )
  );
}

/**
 * Reads the custom property a node references through `var()` without a fallback.
 *
 * @param node - A plain css-tree node.
 * @returns The custom property name, or `undefined` for anything else.
 */
function plainVariableOfNode(
  node: CssNodePlain | undefined,
): string | undefined {
  const name =
    node?.type === "Function" && node.children.length === 1
      ? referencedVariable(node)
      : undefined;
  return name?.startsWith("--") ? name : undefined;
}

/**
 * Reads the custom property a whole value references through `var()` without a fallback.
 *
 * @param value - A parsed declaration value.
 * @returns The custom property name when the value is only that `var()`; `undefined` otherwise.
 */
function plainVariableOfValue(
  value: ValuePlain | undefined,
): string | undefined {
  const [only, ...rest] = value?.children ?? [];
  return rest.length === 0 ? plainVariableOfNode(only) : undefined;
}

/**
 * Tells whether a token sets a color variable to a project theme color.
 *
 * @param declarations - The token's compiled declarations.
 * @param property - The color variable, such as `--tw-ring-color`.
 * @param view - The project design system.
 * @returns `true` when the variable is set to a plain `var()` the project defines.
 */
function isTokenColor(
  declarations: readonly Declaration[],
  property: string,
  view: DesignSystemView,
): boolean {
  const variable = plainVariableOfValue(
    declarations.find((declaration) => declaration.property === property)
      ?.value,
  );
  return variable !== undefined && !view.isDefaultThemeVariable(variable);
}

/**
 * Tells whether a value is a whole number no smaller than a minimum.
 *
 * @param value - A named value such as `2`.
 * @param minimum - The smallest allowed number.
 * @returns `true` for a whole number at or above `minimum`.
 */
function isWholeNumberAtLeast(
  value: string | undefined,
  minimum: number,
): boolean {
  return value !== undefined && /^\d+$/.test(value) && Number(value) >= minimum;
}

/**
 * Finds the P1 role a `ring` width parse fills.
 *
 * @param candidate - One parse of a `ring` width token.
 * @returns `ring-width` for `ring` and `ring-<n>` with a whole `n` of at least 1; `undefined`
 *   otherwise.
 */
function ringWidthRole(candidate: ClassCandidate): P1Role | undefined {
  const isRingWidth =
    candidate.valueKind === "none" ||
    (candidate.valueKind === "named" &&
      isWholeNumberAtLeast(candidate.value, 1));
  return isRingWidth ? "ring-width" : undefined;
}

/**
 * Finds the P1 role a `ring-offset` width parse fills.
 *
 * @param candidate - One parse of a `ring-offset` width token.
 * @returns `zero-offset-width` for `ring-offset-0`, which draws no offset band, `offset-width` for
 *   `ring-offset-<n>` with a whole `n` of at least 1, and `undefined` otherwise.
 */
function offsetWidthRole(candidate: ClassCandidate): P1Role | undefined {
  if (
    candidate.valueKind !== "named" ||
    !isWholeNumberAtLeast(candidate.value, 0)
  ) {
    return undefined;
  }
  return Number(candidate.value) === 0 ? "zero-offset-width" : "offset-width";
}

/**
 * Finds the P1 role a `ring` or `ring-offset` token fills.
 *
 * @param token - One focus-scoped class token.
 * @param view - The project design system.
 * @returns The width role for a valid width, the color role for a project token color, or
 *   `undefined`.
 */
function ringRole(token: string, view: DesignSystemView): P1Role | undefined {
  const declarations = view.declarationsOf(token) ?? [];
  const setsVariable = (variable: string) =>
    declarations.some((declaration) => declaration.property === variable);
  const family = RING_FAMILIES.find(
    (ringFamily) =>
      setsVariable(ringFamily.widthVariable) ||
      setsVariable(ringFamily.colorVariable),
  );
  const candidate = view
    .candidatesOf(token)
    .find((parse) => parse.utility === family?.utility);
  if (!family || !candidate) {
    return undefined;
  }
  if (setsVariable(family.widthVariable)) {
    return family.widthRole(candidate);
  }
  const isColor =
    candidate.modifierKind === "none" &&
    (isTokenColor(declarations, family.colorVariable, view) ||
      isProjectThemeColor(candidate, view));
  return isColor ? family.colorRole : undefined;
}

/**
 * Finds the P1 role a focus-scoped token fills.
 *
 * @param token - One focus-scoped class token.
 * @param view - The project design system.
 * @returns The role, or `undefined` when the token has another variant, `!`, or fills no role.
 */
function p1Role(token: string, view: DesignSystemView): P1Role | undefined {
  const candidates = view.candidatesOf(token);
  const wellFormed = candidates.every(
    (candidate) =>
      !candidate.important &&
      candidate.variants.length === 1 &&
      candidate.variants[0] === "focus-visible",
  );
  if (!wellFormed || candidates.length === 0) {
    return undefined;
  }
  const outlineHidden = candidates.every(
    (candidate) =>
      (candidate.utility === "outline-hidden" &&
        candidate.valueKind === "none") ||
      (candidate.utility === "outline" &&
        candidate.valueKind === "named" &&
        candidate.value === "hidden"),
  );
  if (outlineHidden) {
    return "outline-hidden";
  }
  return ringRole(token, view);
}

/**
 * Lists the P1 parts a class group has too few or too many of.
 *
 * @param counts - How many tokens fill each role.
 * @returns The labels of out-of-range roles, with one ring offset allowed across zero and non-zero
 *   widths, plus the unpaired-offset label when a non-zero offset width has no offset color or an
 *   offset color has no offset width.
 */
function listOutOfRangeLabels(counts: ReadonlyMap<P1Role, number>): string[] {
  const offsetWidths = counts.get("offset-width") ?? 0;
  const zeroOffsetWidths = counts.get("zero-offset-width") ?? 0;
  const offsetColors = counts.get("offset-color") ?? 0;
  const labels = new Set(
    Object.entries(ROLE_LIMITS)
      .filter(([role, limit]) => {
        const count = counts.get(role as P1Role) ?? 0;
        return count < limit.minimum || count > limit.maximum;
      })
      .map(([, limit]) => limit.label),
  );
  if (offsetWidths + zeroOffsetWidths > 1) {
    labels.add(ROLE_LIMITS["offset-width"].label);
  }
  if (
    offsetColors < offsetWidths ||
    offsetColors > offsetWidths + zeroOffsetWidths
  ) {
    labels.add(UNPAIRED_OFFSET_LABEL);
  }
  return [...labels];
}

/**
 * Checks one class group against P1, the only allowed class focus pattern.
 *
 * P1: every in-scope token has exactly the `focus-visible` variant and no `!`; the group has one
 * `outline-hidden`, one `ring`/`ring-<n≥1>`, and optionally one project token ring color, one
 * `ring-offset-<n>` and one project token offset color; an offset above 0 needs the offset color,
 * `ring-offset-0` allows it, and no offset forbids it.
 *
 * @param tokens - The class tokens of one string or template literal.
 * @param view - The project design system.
 * @returns The in-scope tokens, the tokens outside P1, and the labels of P1 parts that are missing
 *   or repeated.
 */
export function evaluateFocusGroup(
  tokens: readonly string[],
  view: DesignSystemView,
): FocusGroupVerdict {
  const scoped = tokens.filter((token) => isFocusScopedToken(token, view));
  if (scoped.length === 0) {
    return { scoped, offending: [], outOfRange: [] };
  }
  const counts = new Map<P1Role, number>();
  const offending: string[] = [];
  for (const token of scoped) {
    const role = p1Role(token, view);
    if (role === undefined) {
      offending.push(token);
    } else {
      counts.set(role, (counts.get(role) ?? 0) + 1);
    }
  }
  return { scoped, offending, outOfRange: listOutOfRangeLabels(counts) };
}

/**
 * Tells whether a project CSS declaration outside a focus rule can change the focus indicator.
 *
 * @param declaration - A declaration from a project stylesheet.
 * @returns `true` for indicator properties, shadow-variable resets, `!important` shadows, and
 *   shadows that do not compose the ring offset and ring and would beat the utilities layer
 *   (unlayered, a layer after `theme`, `base` and `components`, or inside keyframes).
 */
export function isFocusScopedCssDeclaration(declaration: Declaration): boolean {
  if (
    isFocusIndicatorProperty(declaration.property) ||
    isShadowVariableReset(declaration)
  ) {
    return true;
  }
  if (!isBoxShadowProperty(declaration.property)) {
    return false;
  }
  if (declaration.important) {
    return true;
  }
  const firstLayer = declaration.layer?.split(".")[0];
  const beatsUtilities =
    firstLayer === undefined ||
    !EARLY_LAYERS.has(firstLayer) ||
    declaration.inKeyframes;
  return beatsUtilities && !composesRing(declaration);
}

/**
 * Tells whether a selector ends in `:focus-visible`.
 *
 * @param selector - One selector of a selector list.
 * @returns `true` when its last component is `:focus-visible`.
 */
function endsWithFocusVisible(selector: CssNodePlain): boolean {
  const last = listCssChildren(selector).at(-1);
  return last?.type === "PseudoClassSelector" && last.name === "focus-visible";
}

/**
 * Tells whether a node is a non-zero outline width.
 *
 * @param width - The first node of an `outline` value.
 * @returns `true` for a positive length or `thin`, `medium` or `thick`.
 */
function isNonZeroWidth(width: CssNodePlain | undefined): boolean {
  if (!width || lexer.matchType("line-width", width).error !== null) {
    return false;
  }
  if (width.type === "Dimension") {
    return Number(width.value) > 0;
  }
  return width.type === "Identifier" && OUTLINE_WIDTH_KEYWORDS.has(width.name);
}

/**
 * Tells whether an `outline` value is `<non-zero width> solid var(--token)`.
 *
 * @param value - An `outline` value.
 * @returns `true` for the C1 outline.
 */
function isC1Outline(value: ValuePlain): boolean {
  const [width, style, color, ...rest] = value.children;
  const solid = style?.type === "Identifier" && style.name === "solid";
  return (
    rest.length === 0 &&
    solid &&
    isNonZeroWidth(width) &&
    plainVariableOfNode(color) !== undefined
  );
}

/**
 * Tells whether a focus rule's declarations are exactly the C1 set.
 *
 * @param declarations - The declarations of one focus rule.
 * @returns `true` for one C1 `outline`, at most one `outline-offset`, nothing else, and no
 *   `!important`.
 */
function isC1Declarations(declarations: readonly Declaration[]): boolean {
  const counts = new Map<string, number>();
  for (const { property } of declarations) {
    counts.set(property, (counts.get(property) ?? 0) + 1);
  }
  const outlines = declarations.filter(
    (declaration) => declaration.property === "outline",
  );
  const otherProperties = [...counts.keys()].filter(
    (property) => property !== "outline" && property !== "outline-offset",
  );
  return (
    counts.get("outline") === 1 &&
    (counts.get("outline-offset") ?? 0) <= 1 &&
    otherProperties.length === 0 &&
    declarations.every((declaration) => !declaration.important) &&
    outlines.every((declaration) => isC1Outline(declaration.value))
  );
}

/**
 * Tells whether every selector a focus block applies to ends in `:focus-visible`.
 *
 * @param block - A rule, or an `@variant focus*` block.
 * @returns `true` for a rule whose every selector ends in `:focus-visible`, and for an
 *   `@variant focus-visible` block.
 */
function allSelectorsEndWithFocusVisible(
  block: RulePlain | AtrulePlain,
): boolean {
  if (block.type === "Atrule") {
    return focusVariant(block) === "focus-visible";
  }
  return (
    block.prelude.type === "SelectorList" &&
    block.prelude.children.every((selector) => endsWithFocusVisible(selector))
  );
}

/**
 * Checks one focus block against C1, the only allowed CSS focus pattern.
 *
 * C1: every selector in the list ends in `:focus-visible` (an `@variant focus-visible` block
 * counts as one), and the declarations are exactly `outline: <non-zero line width> solid
 * var(--token)` plus an optional `outline-offset`, none `!important`.
 *
 * @param block - The rule whose selector targets focus, or an `@variant focus*` block.
 * @param declarations - The declarations whose block is `block`.
 * @returns `true` when the block is C1.
 */
export function matchesC1(
  block: RulePlain | AtrulePlain,
  declarations: readonly Declaration[],
): boolean {
  return (
    allSelectorsEndWithFocusVisible(block) && isC1Declarations(declarations)
  );
}
