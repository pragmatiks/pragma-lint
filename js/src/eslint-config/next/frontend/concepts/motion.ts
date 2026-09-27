/**
 * The motion concept: transitions and animations that animate every property or a layout
 * property.
 *
 * @packageDocumentation
 */
import {
  type CssNodePlain,
  lexer,
  property as describeProperty,
  type ValuePlain,
} from "@eslint/css-tree";

import {
  CSS_WIDE_KEYWORDS,
  type Declaration,
  isVariableReference,
  parseValue,
  referencedVariable,
  splitOnCommas,
} from "../css-declarations.js";
import type { DesignSystemView } from "../design-system.js";

/**
 * Why one transition layer, property or animated property is not allowed.
 *
 * `all` and `implicitAll` animate every property, `layout` animates a property that reflows the
 * page, and `unverifiable` means the property is unknown, the layer does not parse as a
 * transition, or the property hides behind `var()`.
 */
export interface MotionFinding {
  /** The reason the motion is not allowed. */
  readonly kind: "all" | "implicitAll" | "layout" | "unverifiable";
  /** The offending property, or `undefined` when it is not known. */
  readonly property: string | undefined;
}

/**
 * One motion diagnostic at a node of any AST.
 */
export interface MotionReport<Node> {
  /** The node to report at. */
  readonly node: Node;
  /** The finding kind, used as the message ID. */
  readonly messageId: MotionFinding["kind"];
  /** The `source` and `property` placeholder values. */
  readonly data: Readonly<Record<string, string>>;
}

/**
 * Report messages for motion findings, keyed by finding kind, with `source` and `property`
 * placeholders.
 */
export const MOTION_MESSAGES: Readonly<Record<MotionFinding["kind"], string>> =
  {
    all: "{{source}} transitions all properties; list the properties it animates, such as transform, opacity or filter.",
    implicitAll:
      "{{source}} has a transition layer without a property, which animates all properties; name the property.",
    layout:
      "{{source}} animates the layout property {{property}}; animate transform, opacity or filter instead.",
    unverifiable:
      "{{source}} animates a property that cannot be verified statically; name a known property.",
  };

/**
 * Properties whose change reflows layout. Animating them is flagged.
 */
export const LAYOUT_PROPERTIES: ReadonlySet<string> = new Set([
  "width",
  "height",
  "min-width",
  "min-height",
  "max-width",
  "max-height",
  "block-size",
  "inline-size",
  "min-block-size",
  "min-inline-size",
  "max-block-size",
  "max-inline-size",
  "aspect-ratio",
  "contain-intrinsic-size",
  "contain-intrinsic-width",
  "contain-intrinsic-height",
  "contain-intrinsic-block-size",
  "contain-intrinsic-inline-size",
  "inset",
  "inset-block",
  "inset-block-start",
  "inset-block-end",
  "inset-inline",
  "inset-inline-start",
  "inset-inline-end",
  "top",
  "right",
  "bottom",
  "left",
  "margin",
  "margin-top",
  "margin-right",
  "margin-bottom",
  "margin-left",
  "margin-block",
  "margin-block-start",
  "margin-block-end",
  "margin-inline",
  "margin-inline-start",
  "margin-inline-end",
  "margin-trim",
  "padding",
  "padding-top",
  "padding-right",
  "padding-bottom",
  "padding-left",
  "padding-block",
  "padding-block-start",
  "padding-block-end",
  "padding-inline",
  "padding-inline-start",
  "padding-inline-end",
  "border",
  "border-width",
  "border-top",
  "border-right",
  "border-bottom",
  "border-left",
  "border-top-width",
  "border-right-width",
  "border-bottom-width",
  "border-left-width",
  "border-block",
  "border-block-width",
  "border-block-start",
  "border-block-start-width",
  "border-block-end",
  "border-block-end-width",
  "border-inline",
  "border-inline-width",
  "border-inline-start",
  "border-inline-start-width",
  "border-inline-end",
  "border-inline-end-width",
  "border-spacing",
  "gap",
  "row-gap",
  "column-gap",
  "grid-gap",
  "grid-row-gap",
  "grid-column-gap",
  "grid",
  "grid-area",
  "grid-auto-columns",
  "grid-auto-flow",
  "grid-auto-rows",
  "grid-column",
  "grid-column-start",
  "grid-column-end",
  "grid-row",
  "grid-row-start",
  "grid-row-end",
  "grid-template",
  "grid-template-areas",
  "grid-template-columns",
  "grid-template-rows",
  "flex",
  "flex-basis",
  "flex-direction",
  "flex-flow",
  "flex-grow",
  "flex-line-count",
  "flex-shrink",
  "flex-wrap",
  "order",
  "columns",
  "column-count",
  "column-fill",
  "column-height",
  "column-span",
  "column-width",
  "column-wrap",
  "font",
  "font-family",
  "font-feature-settings",
  "font-kerning",
  "font-language-override",
  "font-optical-sizing",
  "font-size",
  "font-size-adjust",
  "font-stretch",
  "font-style",
  "font-synthesis",
  "font-synthesis-position",
  "font-synthesis-small-caps",
  "font-synthesis-style",
  "font-synthesis-weight",
  "font-variant",
  "font-variant-alternates",
  "font-variant-caps",
  "font-variant-east-asian",
  "font-variant-emoji",
  "font-variant-ligatures",
  "font-variant-numeric",
  "font-variant-position",
  "font-variation-settings",
  "font-weight",
  "font-width",
  "line-height",
  "letter-spacing",
  "word-spacing",
  "text-indent",
  "tab-size",
  "vertical-align",
  "scrollbar-width",
  "zoom",
]);

const TRANSITION_KEYWORDS = new Set([
  "ease",
  "ease-in",
  "ease-out",
  "ease-in-out",
  "linear",
  "step-start",
  "step-end",
  "normal",
  "allow-discrete",
]);
const THEME_ANIMATION = /^--animate-/;

/**
 * Tells whether animating a property reflows layout.
 *
 * @param property - A CSS property name, vendor prefix allowed.
 * @returns `true` for properties in `LAYOUT_PROPERTIES`.
 */
export function isLayoutProperty(property: string): boolean {
  return LAYOUT_PROPERTIES.has(describeProperty(property).basename);
}

/**
 * Classifies one transitioned property name.
 *
 * @param name - A property name as written.
 * @returns An `all`, `unverifiable` or `layout` finding, or `undefined` for `none`, custom
 *   properties, CSS-wide keywords and non-layout properties.
 */
function classifyPropertyName(name: string): MotionFinding | undefined {
  const lower = name.toLowerCase();
  if (
    name.startsWith("--") ||
    lower === "none" ||
    CSS_WIDE_KEYWORDS.has(lower)
  ) {
    return undefined;
  }
  if (lower === "all") {
    return { kind: "all", property: lower };
  }
  if (lexer.checkPropertyName(lower) !== undefined) {
    return { kind: "unverifiable", property: lower };
  }
  return isLayoutProperty(lower)
    ? { kind: "layout", property: lower }
    : undefined;
}

/**
 * Classifies one layer of a `transition` shorthand.
 *
 * @param layer - The nodes of one comma-separated layer.
 * @returns A finding for the layer's property, `implicitAll` when it names none, or
 *   `unverifiable` when it does not parse or its property is behind `var()`.
 */
function classifyTransitionLayer(
  layer: readonly CssNodePlain[],
): MotionFinding | undefined {
  const rest = layer.filter((node) => !isVariableReference(node));
  const stripped = rest.length !== layer.length;
  if (
    rest.length > 0 &&
    lexer.matchProperty("transition", { type: "Value", children: rest }).error
  ) {
    return { kind: "unverifiable", property: undefined };
  }
  const names = rest.flatMap((node) =>
    node.type === "Identifier" &&
    !TRANSITION_KEYWORDS.has(node.name.toLowerCase())
      ? [node.name]
      : [],
  );
  const [name] = names;
  if (name === undefined) {
    return stripped
      ? { kind: "unverifiable", property: undefined }
      : { kind: "implicitAll", property: undefined };
  }
  return classifyPropertyName(name);
}

/**
 * Classifies one item of a `transition-property` list.
 *
 * @param item - The nodes of one comma-separated item.
 * @returns A finding for the property, or `unverifiable` when the item is not one identifier.
 */
function classifyPropertyItem(
  item: readonly CssNodePlain[],
): MotionFinding | undefined {
  const [only, ...rest] = item;
  if (rest.length > 0 || only?.type !== "Identifier") {
    return { kind: "unverifiable", property: undefined };
  }
  return classifyPropertyName(only.name);
}

/**
 * Tells whether a whole value is one CSS-wide keyword.
 *
 * @param value - A parsed declaration value.
 * @returns `true` for a value such as `inherit`.
 */
function isCssWideKeywordValue(value: ValuePlain): boolean {
  const [only, ...rest] = value.children;
  return (
    rest.length === 0 &&
    only?.type === "Identifier" &&
    CSS_WIDE_KEYWORDS.has(only.name.toLowerCase())
  );
}

/**
 * Tells whether a finding exists.
 *
 * @param finding - A finding or `undefined`.
 * @returns `true` when `finding` is defined.
 */
function isPresent(
  finding: MotionFinding | undefined,
): finding is MotionFinding {
  return finding !== undefined;
}

/**
 * Checks a `transition` or `transition-property` declaration.
 *
 * Flags layers and items that animate all properties, a layout property, or a property that
 * cannot be verified. `none`, custom properties and a whole-value CSS-wide keyword pass.
 *
 * @param declaration - Any declaration; other properties yield no findings.
 * @returns One finding per offending layer or list item.
 */
export function evaluateTransition(declaration: Declaration): MotionFinding[] {
  const basename = describeProperty(declaration.property).basename;
  if (
    (basename !== "transition" && basename !== "transition-property") ||
    isCssWideKeywordValue(declaration.value)
  ) {
    return [];
  }
  const layers = splitOnCommas(declaration.value.children);
  const classify =
    basename === "transition" ? classifyTransitionLayer : classifyPropertyItem;
  return layers
    .map((layer) => classify(layer))
    .filter((finding) => isPresent(finding));
}

/**
 * Checks a declaration written inside `@keyframes`.
 *
 * @param declaration - A declaration from a project stylesheet.
 * @returns A `layout` finding when a keyframe animates a layout property.
 */
export function evaluateKeyframeDeclaration(
  declaration: Declaration,
): MotionFinding[] {
  return declaration.inKeyframes && isLayoutProperty(declaration.property)
    ? [{ kind: "layout", property: declaration.property }]
    : [];
}

/**
 * Resolves the `var(--animate-*)` references of an animation value through the theme.
 *
 * @param value - An `animation` or `animation-name` value.
 * @param view - The project design system.
 * @returns The parsed theme values of the references the theme defines.
 */
function resolveThemeAnimationValues(
  value: ValuePlain,
  view: DesignSystemView,
): ValuePlain[] {
  return value.children.flatMap((node) => {
    const name = referencedVariable(node);
    if (name === undefined || !THEME_ANIMATION.test(name)) {
      return [];
    }
    const resolved = view.themeValue(name);
    return resolved === undefined ? [] : [parseValue(resolved)];
  });
}

/**
 * Checks an `animation` or `animation-name` declaration against the theme keyframes it names.
 *
 * Names may be identifiers or quoted strings, and `var(--animate-*)` is resolved through the
 * theme. Names the theme does not define are skipped; keyframes in project stylesheets are
 * checked where they are defined.
 *
 * @param declaration - Any declaration; other properties yield no findings.
 * @param view - The project design system.
 * @returns One `layout` finding per layout property the named keyframes animate.
 */
export function evaluateAnimation(
  declaration: Declaration,
  view: DesignSystemView,
): MotionFinding[] {
  const basename = describeProperty(declaration.property).basename;
  if (basename !== "animation" && basename !== "animation-name") {
    return [];
  }
  const values = [
    declaration.value,
    ...resolveThemeAnimationValues(declaration.value, view),
  ];
  const properties = values
    .flatMap((value) => value.children)
    .flatMap((node) => {
      const name = animationName(node);
      return name === undefined ? [] : (view.keyframeProperties(name) ?? []);
    });
  return [...new Set(properties)]
    .filter((property) => isLayoutProperty(property))
    .map((property) => ({ kind: "layout", property }));
}

/**
 * Reads the keyframes name a node of an animation value can be.
 *
 * @param node - A top-level node of an animation value.
 * @returns The identifier or string text, or `undefined` for other nodes.
 */
function animationName(node: CssNodePlain): string | undefined {
  if (node.type === "Identifier") {
    return node.name;
  }
  return node.type === "String" ? node.value : undefined;
}

/**
 * Checks a motion prop key such as `animate={{ height: 0 }}`.
 *
 * @param property - The key mapped to its CSS property name.
 * @returns A `layout` finding when the key is a layout property.
 */
export function evaluateMotionKey(property: string): MotionFinding[] {
  return isLayoutProperty(property) ? [{ kind: "layout", property }] : [];
}

/**
 * Reports each motion finding at one node, naming the source that caused it.
 *
 * @param report - The function that emits one diagnostic.
 * @param node - The node to report at.
 * @param source - The class token, style key or property the findings belong to.
 * @param findings - The findings to report.
 */
export function reportMotionFindings<Node>(
  report: (motionReport: MotionReport<Node>) => void,
  node: Node,
  source: string,
  findings: readonly MotionFinding[],
): void {
  for (const finding of findings) {
    report({
      node,
      messageId: finding.kind,
      data: { source, property: finding.property ?? "" },
    });
  }
}
