/**
 * Parser-independent access to JavaScript and JSX AST nodes for the frontend rules.
 *
 * @packageDocumentation
 */
import type { Rule, Scope } from "eslint";

/**
 * A JavaScript AST node as the frontend rules read it, independent of the parser in use.
 */
export interface AstNode {
  readonly type: string;
  readonly parent?: AstNode;
  readonly range?: readonly [number, number];
  readonly [field: string]: unknown;
}

/**
 * AST node types of function declarations and expressions.
 */
export const FUNCTION_TYPES: ReadonlySet<string> = new Set([
  "ArrowFunctionExpression",
  "FunctionExpression",
  "FunctionDeclaration",
]);

/**
 * Presents an AST node as the node type ESLint's APIs expect.
 *
 * @param node - An AST node of the file being linted.
 * @returns The same node, typed for ESLint.
 */
export function toRuleNode(node: AstNode): Rule.Node {
  return node as unknown as Rule.Node;
}

/**
 * Presents a node from ESLint's APIs as the node type the frontend rules read.
 *
 * @param node - A node ESLint hands over, such as a visitor argument, a scope definition node or
 *   the program root.
 * @returns The same node, typed as an `AstNode`.
 */
export function toAstNode(node: Pick<Rule.Node, "type">): AstNode {
  return node as unknown as AstNode;
}

/**
 * Reads a child node off an AST node.
 *
 * @param node - The parent node.
 * @param name - The field name, such as `expression`.
 * @returns The child node, or `undefined` when the field is missing or not a node.
 */
export function childNode(
  node: AstNode | undefined,
  name: string,
): AstNode | undefined {
  const value = node?.[name];
  return value && typeof value === "object" && "type" in value
    ? (value as AstNode)
    : undefined;
}

/**
 * Reads a list of child nodes off an AST node.
 *
 * @param node - The parent node.
 * @param name - The field name, such as `attributes`.
 * @returns The child nodes, or an empty list when the field is not an array.
 */
export function childNodes(node: AstNode | undefined, name: string): AstNode[] {
  const value = node?.[name];
  return Array.isArray(value) ? (value as AstNode[]) : [];
}

/**
 * Reads a string field off an AST node.
 *
 * @param node - The node.
 * @param name - The field name, such as `name`.
 * @returns The string, or `undefined` when the field is missing or not a string.
 */
export function childString(
  node: AstNode | undefined,
  name: string,
): string | undefined {
  const value = node?.[name];
  return typeof value === "string" ? value : undefined;
}

/**
 * Tells whether a template element value carries cooked text.
 *
 * @param value - The `value` field of a `TemplateElement`.
 * @returns `true` when the value has a string `cooked` field.
 */
function hasCookedText(value: unknown): value is { cooked: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    "cooked" in value &&
    typeof value.cooked === "string"
  );
}

/**
 * Reads the cooked text of a template element.
 *
 * @param quasi - A `TemplateElement`.
 * @returns The cooked text, or an empty string when there is none.
 */
export function cookedText(quasi: AstNode | undefined): string {
  const value = quasi?.value;
  return hasCookedText(value) ? value.cooked : "";
}

/**
 * Reads the static name of an object property key.
 *
 * @param property - A `Property`.
 * @returns The non-computed identifier key or any string-literal key (computed included), or
 *   `undefined` otherwise.
 */
export function keyName(property: AstNode): string | undefined {
  const key = childNode(property, "key");
  if (!property.computed && key?.type === "Identifier") {
    return childString(key, "name");
  }
  return key?.type === "Literal" ? childString(key, "value") : undefined;
}

/**
 * Reads the name of a JSX attribute.
 *
 * @param attribute - A `JSXAttribute`.
 * @returns The plain attribute name, or `undefined` for a namespaced name.
 */
export function attributeName(attribute: AstNode): string | undefined {
  return childString(childNode(attribute, "name"), "name");
}

/**
 * Reads the expression inside a JSX attribute's `{}`.
 *
 * @param attribute - A `JSXAttribute`.
 * @returns The expression, or `undefined` when the value is not an expression container.
 */
export function attributeExpression(attribute: AstNode): AstNode | undefined {
  const value = childNode(attribute, "value");
  return value?.type === "JSXExpressionContainer"
    ? childNode(value, "expression")
    : undefined;
}

/**
 * Reads the tag name of a JSX opening element.
 *
 * @param opening - A `JSXOpeningElement`.
 * @returns The name of a plain identifier tag such as `input` or `Label`; `undefined` for member
 *   and namespaced tags.
 */
export function jsxElementName(opening: AstNode): string | undefined {
  const name = childNode(opening, "name");
  return name?.type === "JSXIdentifier" ? childString(name, "name") : undefined;
}

/**
 * Finds a named attribute on a JSX opening element.
 *
 * @param opening - A `JSXOpeningElement`.
 * @param name - The attribute name, such as `htmlFor`.
 * @returns The `JSXAttribute`, or `undefined` when the element does not set it by name.
 */
export function findJsxAttribute(
  opening: AstNode,
  name: string,
): AstNode | undefined {
  return childNodes(opening, "attributes").find(
    (attribute) =>
      attribute.type === "JSXAttribute" && attributeName(attribute) === name,
  );
}

/**
 * Reads the value of a JSX attribute.
 *
 * @param attribute - A `JSXAttribute`.
 * @returns The expression inside `{}`, the string literal, or `undefined` for a valueless attribute.
 */
export function jsxAttributeValue(attribute: AstNode): AstNode | undefined {
  return attributeExpression(attribute) ?? childNode(attribute, "value");
}

/**
 * Reads the text of a string or number literal, or of a template literal without `${}`.
 *
 * @param value - Any expression.
 * @returns The literal text, or `undefined` when the value is not a static literal.
 */
export function staticText(value: AstNode | undefined): string | undefined {
  if (
    value?.type === "Literal" &&
    (typeof value.value === "string" || typeof value.value === "number")
  ) {
    return String(value.value);
  }
  if (
    value?.type === "TemplateLiteral" &&
    childNodes(value, "expressions").length === 0
  ) {
    return cookedText(childNodes(value, "quasis")[0]);
  }
  return undefined;
}

/**
 * Looks a name up through a scope and its enclosing scopes.
 *
 * @param scope - The innermost scope to search.
 * @param name - The variable name.
 * @returns The variable the name refers to (configured globals included, with no definitions), or
 *   `undefined` for undeclared names.
 */
export function findVariable(
  scope: Scope.Scope | null,
  name: string,
): Scope.Variable | undefined {
  for (let current = scope; current; current = current.upper) {
    const variable = current.set.get(name);
    if (variable) {
      return variable;
    }
  }
  return undefined;
}

/**
 * Tells whether one node lies within another's source range.
 *
 * @param outer - The enclosing candidate.
 * @param inner - The node to locate.
 * @returns `true` when `inner`'s range is inside `outer`'s, or equal to it.
 */
export function containsNode(outer: AstNode, inner: AstNode): boolean {
  const [outerStart, outerEnd] = outer.range ?? [0, -1];
  const [innerStart, innerEnd] = inner.range ?? [0, -1];
  return innerStart >= outerStart && innerEnd <= outerEnd;
}
