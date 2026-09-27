/**
 * Parses CSS from class tokens, inline styles and project stylesheets into one declaration shape,
 * and provides the value helpers the frontend concepts share.
 *
 * @packageDocumentation
 */
import {
  type AtrulePlain,
  type CssNodePlain,
  type DeclarationPlain,
  type FunctionNodePlain,
  generate,
  lexer,
  parse,
  type RulePlain,
  type StyleSheetPlain,
  toPlainObject,
  type ValuePlain,
} from "@eslint/css-tree";

/**
 * One CSS declaration from a compiled class token, an inline style leaf or a project stylesheet.
 */
export interface Declaration {
  /** The property name, lowercased unless it is a custom property. */
  readonly property: string;
  /** The parsed value. */
  readonly value: ValuePlain;
  /** The value text. */
  readonly text: string;
  /** Whether the declaration is `!important`. */
  readonly important: boolean;
  /** The enclosing rule preludes, outermost first. */
  readonly selectors: readonly string[];
  /** The dotted `@layer` path, or `undefined` outside any layer. */
  readonly layer: string | undefined;
  /** Whether the declaration sits inside `@keyframes`. */
  readonly inKeyframes: boolean;
  /** Whether the declaration sits inside `@theme`. */
  readonly inTheme: boolean;
  /**
   * The nearest enclosing rule or `@variant focus*` block, or `undefined` for inline declarations
   * and top-level ones.
   */
  readonly block: RulePlain | AtrulePlain | undefined;
  /** The source declaration node, or `undefined` for inline declarations. */
  readonly node: CssNodePlain | undefined;
}

/**
 * The context a stylesheet walk carries down to the declarations it reaches.
 */
interface DeclarationContext {
  readonly selectors: readonly string[];
  readonly layer: string | undefined;
  readonly inKeyframes: boolean;
  readonly inTheme: boolean;
  readonly block: RulePlain | AtrulePlain | undefined;
}

/**
 * The CSS-wide keywords, such as `inherit` and `unset`.
 */
export const CSS_WIDE_KEYWORDS: ReadonlySet<string> = new Set(
  lexer.cssWideKeywords,
);

const TOP_CONTEXT: DeclarationContext = {
  selectors: [],
  layer: undefined,
  inKeyframes: false,
  inTheme: false,
  block: undefined,
};
const FOCUS_VARIANTS = new Set(["focus", "focus-visible", "focus-within"]);
const stylesheetDeclarations = new WeakMap<
  StyleSheetPlain,
  readonly Declaration[]
>();

/**
 * Parses a CSS value, including custom property values, into a plain css-tree node.
 *
 * @param text - The value text without the property name.
 * @returns The parsed value; a value css-tree cannot parse, such as a custom property holding a
 *   `{}` block, comes back as a single `Raw` node, which no concept treats as a finding.
 */
export function parseValue(text: string): ValuePlain {
  let parsed: CssNodePlain;
  try {
    parsed = toPlainObject(
      parse(text, { context: "value", parseCustomProperty: true }),
    );
  } catch {
    return { type: "Value", children: [{ type: "Raw", value: text }] };
  }
  if (parsed.type === "Value") {
    return parsed;
  }
  return { type: "Value", children: [parsed] };
}

/**
 * Lowercases a property name unless it is a custom property.
 *
 * @param property - A property name as written.
 * @returns The normalized name.
 */
function normalizeProperty(property: string): string {
  return property.startsWith("--") ? property : property.toLowerCase();
}

/**
 * Builds a declaration from a stylesheet node and its context.
 *
 * @param node - A declaration node.
 * @param context - The enclosing context.
 * @returns The declaration with its value re-parsed.
 */
function buildDeclaration(
  node: DeclarationPlain,
  context: DeclarationContext,
): Declaration {
  const text =
    node.value.type === "Raw" ? node.value.value.trim() : generate(node.value);
  return {
    property: normalizeProperty(node.property),
    value: parseValue(text),
    text,
    important: Boolean(node.important),
    ...context,
    node,
  };
}

/**
 * Reads the layer name an `@layer` at-rule opens.
 *
 * @param node - An `@layer` at-rule.
 * @returns The layer name, or an empty string for an anonymous layer.
 */
function layerName(node: AtrulePlain): string {
  if (!node.prelude) {
    return "";
  }
  if (node.prelude.type === "Raw") {
    return node.prelude.value.trim();
  }
  const [first] = node.prelude.children;
  return first?.type === "Layer" ? first.name : generate(node.prelude);
}

/**
 * Reads the focus variant an `@variant` at-rule applies.
 *
 * @param node - Any at-rule.
 * @returns `focus`, `focus-visible` or `focus-within` for such an `@variant`; `undefined` otherwise.
 */
export function focusVariant(node: AtrulePlain): string | undefined {
  if (node.name.toLowerCase() !== "variant" || !node.prelude) {
    return undefined;
  }
  const variant = generate(node.prelude).trim();
  return FOCUS_VARIANTS.has(variant) ? variant : undefined;
}

/**
 * Computes the context inside an at-rule block.
 *
 * @param node - An at-rule with a block.
 * @param context - The context around the at-rule.
 * @returns The context with the layer, keyframes, `@theme` or focus variant the at-rule adds; a
 *   focus variant also becomes the declarations' block.
 */
function atruleContext(
  node: AtrulePlain,
  context: DeclarationContext,
): DeclarationContext {
  const name = node.name.toLowerCase();
  if (name === "layer") {
    const nested = layerName(node);
    return {
      ...context,
      layer:
        context.layer === undefined ? nested : `${context.layer}.${nested}`,
    };
  }
  if (name.endsWith("keyframes")) {
    return { ...context, inKeyframes: true };
  }
  if (name === "theme") {
    return { ...context, inTheme: true };
  }
  const variant = focusVariant(node);
  if (variant === undefined) {
    return context;
  }
  return {
    ...context,
    selectors: [...context.selectors, `&:${variant}`],
    block: node,
  };
}

/**
 * Appends the declarations of a list of stylesheet nodes, recursing into rules and at-rules.
 *
 * @param nodes - The nodes to walk.
 * @param context - The context of the nodes.
 * @param output - The list to append to.
 * @returns `output`.
 */
function collectDeclarations(
  nodes: readonly CssNodePlain[],
  context: DeclarationContext,
  output: Declaration[],
): Declaration[] {
  for (const node of nodes) {
    if (node.type === "Declaration") {
      output.push(buildDeclaration(node, context));
    } else if (node.type === "Rule") {
      const selectors = [...context.selectors, generate(node.prelude)];
      collectDeclarations(
        node.block.children,
        { ...context, selectors, block: node },
        output,
      );
    } else if (node.type === "Atrule" && node.block) {
      collectDeclarations(
        node.block.children,
        atruleContext(node, context),
        output,
      );
    }
  }
  return output;
}

/**
 * Lists every declaration in a stylesheet with its enclosing block, selectors, layer, keyframes and
 * `@theme` context.
 *
 * Selectors and at-rules are not interpreted, so nested and flattened output shapes produce the
 * same declarations, with two exceptions: `@variant focus`, `@variant focus-visible` and
 * `@variant focus-within` add `&:<variant>` to the selectors and become the block of the
 * declarations inside them, and `@property` descriptors are listed like declarations. Values are
 * re-parsed with custom-property parsing, so `var()` fallbacks are parsed rather than left raw.
 * Repeated calls for the same stylesheet return the same list.
 *
 * @param stylesheet - A plain css-tree stylesheet, such as the AST `@eslint/css` provides.
 * @returns The declarations in source order.
 */
export function collectStylesheetDeclarations(
  stylesheet: StyleSheetPlain,
): readonly Declaration[] {
  const cached = stylesheetDeclarations.get(stylesheet);
  if (cached) {
    return cached;
  }
  const declarations = collectDeclarations(
    stylesheet.children,
    TOP_CONTEXT,
    [],
  );
  stylesheetDeclarations.set(stylesheet, declarations);
  return declarations;
}

/**
 * Parses CSS text and lists its declarations.
 *
 * @param css - Stylesheet text, such as the output Tailwind compiles for one class token.
 * @returns The declarations in source order.
 */
export function parseStylesheetDeclarations(
  css: string,
): readonly Declaration[] {
  const stylesheet = toPlainObject(
    parse(css, { parseCustomProperty: true }),
  ) as StyleSheetPlain;
  return collectStylesheetDeclarations(stylesheet);
}

/**
 * Parses an inline style leaf as a declaration.
 *
 * @param leaf - The CSS property name in kebab case and the value text, as a style leaf holds them.
 * @returns The declaration, outside any selector, layer, keyframes or `@theme`; `undefined` when
 *   the value is not statically known.
 */
export function parseStyleLeaf(leaf: {
  readonly property: string;
  readonly text: string | undefined;
}): Declaration | undefined {
  const { property, text } = leaf;
  if (text === undefined) {
    return undefined;
  }
  return {
    property: normalizeProperty(property),
    value: parseValue(text),
    text,
    important: false,
    ...TOP_CONTEXT,
    node: undefined,
  };
}

/**
 * Lists a value node and every node nested inside it, depth first.
 *
 * @param node - A plain css-tree node, usually a `Value`.
 * @returns The node followed by all of its descendants.
 */
export function listValueNodes(node: CssNodePlain): CssNodePlain[] {
  return [
    node,
    ...listCssChildren(node).flatMap((child) => listValueNodes(child)),
  ];
}

/**
 * Lists the direct children of a css-tree node.
 *
 * @param node - A plain css-tree node.
 * @returns The children, or an empty list for a leaf node.
 */
export function listCssChildren(node: CssNodePlain): CssNodePlain[] {
  return "children" in node && Array.isArray(node.children)
    ? (node.children as CssNodePlain[])
    : [];
}

/**
 * Splits a node list at its top-level commas.
 *
 * @param nodes - The children of a value or function.
 * @returns One list per comma-separated segment; a single empty list for no nodes.
 */
export function splitOnCommas(
  nodes: readonly CssNodePlain[],
): CssNodePlain[][] {
  const segments: CssNodePlain[][] = [[]];
  for (const node of nodes) {
    if (node.type === "Operator" && node.value === ",") {
      segments.push([]);
    } else {
      segments.at(-1)?.push(node);
    }
  }
  return segments;
}

/**
 * Tells whether a node is a `var()` call, in any letter case.
 *
 * @param node - A plain css-tree node.
 * @returns `true` for a `var()` function.
 */
export function isVariableReference(
  node: CssNodePlain | undefined,
): node is FunctionNodePlain {
  return node?.type === "Function" && node.name.toLowerCase() === "var";
}

/**
 * Reads the identifier a CSS function takes as its first argument.
 *
 * @param node - A plain css-tree node.
 * @returns The identifier name, such as `--color-red-500` in `var(--color-red-500)`, or
 *   `undefined` when the node is not a function or its first argument is not an identifier.
 */
export function firstIdentifierArgument(
  node: CssNodePlain | undefined,
): string | undefined {
  const [first] = node?.type === "Function" ? node.children : [];
  return first?.type === "Identifier" ? first.name : undefined;
}

/**
 * Reads the custom property a `var()` call references.
 *
 * @param node - A plain css-tree node.
 * @returns The referenced name, or `undefined` when the node is not a `var()` call.
 */
export function referencedVariable(
  node: CssNodePlain | undefined,
): string | undefined {
  return isVariableReference(node) ? firstIdentifierArgument(node) : undefined;
}
