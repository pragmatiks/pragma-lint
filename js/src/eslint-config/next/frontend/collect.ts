/**
 * Collects the class groups, inline styles, motion keys, style assignments and element handlers of
 * one JavaScript or TypeScript file for the frontend rules.
 *
 * @packageDocumentation
 */
import type { Scope, SourceCode } from "eslint";

import {
  type AstNode,
  attributeExpression,
  attributeName,
  childNode,
  childNodes,
  childString,
  containsNode,
  cookedText,
  findVariable,
  FUNCTION_TYPES,
  keyName,
  staticText,
  toAstNode,
  toRuleNode,
} from "./ast.js";

/**
 * Whitespace-separated class tokens from one string or template literal.
 */
export interface ClassGroup {
  /** The string or template literal. */
  readonly node: AstNode;
  /** The class tokens in source order. */
  readonly tokens: readonly string[];
  /** The JSX opening element whose attribute holds the literal, or `undefined` outside JSX. */
  readonly element: AstNode | undefined;
}

/**
 * One key of an inline `style` object, once per statically known value.
 */
export interface StyleLeaf {
  /** The object property. */
  readonly node: AstNode;
  /** The kebab-case CSS property name. */
  readonly property: string;
  /** The value text, or `undefined` when no branch of the value is statically known. */
  readonly text: string | undefined;
  /** The JSX opening element that carries the `style` attribute. */
  readonly element: AstNode | undefined;
}

/**
 * One key of an inline motion object (`initial`, `animate`, `exit`, `while*`, or a `variants`
 * entry), once per statically known value.
 */
export interface MotionKey {
  /** The object property. */
  readonly node: AstNode;
  /** The kebab-case CSS property name. */
  readonly property: string;
  /** The value text, or `undefined` when no branch of the value is statically known. */
  readonly text: string | undefined;
  /** The JSX opening element that carries the motion attribute. */
  readonly element: AstNode | undefined;
  /** The motion attribute name, such as `whileFocus`, or `variants` for a `variants` entry. */
  readonly attributeName: string;
  /** The label of the `variants` entry that holds the key, or `undefined` outside `variants`. */
  readonly variantLabel: string | undefined;
}

/**
 * An assignment to `<expression>.style.<property>`.
 */
export interface StyleAssignment {
  /** The assignment expression. */
  readonly node: AstNode;
  /** The kebab-case CSS property name. */
  readonly property: string;
}

/**
 * An `on*` JSX attribute whose handler function is known in this module.
 */
export interface ElementHandler {
  /** The JSX opening element that carries the attribute. */
  readonly element: AstNode;
  /** The attribute name, such as `onFocus`. */
  readonly attributeName: string;
  /** The `JSXAttribute`. */
  readonly attribute: AstNode;
  /**
   * The style assignments inside the function the attribute resolves to; a handler function whose
   * body is a single call to a named function also covers that function's style assignments,
   * followed transitively.
   */
  readonly styleAssignments: readonly StyleAssignment[];
}

/**
 * Everything the frontend JS rules read from one file.
 */
export interface FrontendModel {
  /** Every class group in the file. */
  readonly classGroups: readonly ClassGroup[];
  /** Every inline style leaf in the file. */
  readonly styleLeaves: readonly StyleLeaf[];
  /** Every inline motion key in the file. */
  readonly motionKeys: readonly MotionKey[];
  /** Every style assignment in the file. */
  readonly styleAssignments: readonly StyleAssignment[];
  /** Every element handler whose function is known in the file. */
  readonly handlers: readonly ElementHandler[];
}

/**
 * An element handler before the walk ends and its style assignments are known.
 */
interface PendingHandler extends Omit<ElementHandler, "styleAssignments"> {
  /** The function the attribute resolves to, then each named function it only delegates to. */
  readonly handlerFunctions: readonly AstNode[];
}

/**
 * The model while the walk fills it; handlers get their style assignments once the walk ends.
 */
interface MutableModel {
  classGroups: ClassGroup[];
  styleLeaves: StyleLeaf[];
  motionKeys: MotionKey[];
  styleAssignments: StyleAssignment[];
  pendingHandlers: PendingHandler[];
}

/**
 * A statically named key of an object literal.
 */
interface ObjectKey {
  /** The `Property` node. */
  readonly property: AstNode;
  /** The key name. */
  readonly key: string;
}

/**
 * The keys of one motion object, with the `variants` label it sits under.
 */
interface MotionKeyGroup {
  /** The keys of the motion object. */
  readonly keys: readonly ObjectKey[];
  /** The label of the `variants` entry, or `undefined` outside `variants`. */
  readonly variantLabel: string | undefined;
}

const MOTION_ATTRIBUTE = /^(?:initial|animate|exit|variants|while[A-Z]\w*)$/;
const EVENT_ATTRIBUTE = /^on[A-Z]/;
const CLASS_ATTRIBUTE = /class(?:name)?s?$/i;
const EXPRESSION_WRAPPERS = new Set([
  "TSAsExpression",
  "TSSatisfiesExpression",
  "TSNonNullExpression",
  "ParenthesizedExpression",
]);
const CLASS_SOURCE_BOUNDARIES = new Set([
  "CallExpression",
  "TaggedTemplateExpression",
  "JSXElement",
  "JSXFragment",
  ...FUNCTION_TYPES,
]);
const SOURCE_PARENTS = new Set([
  "ImportDeclaration",
  "ExportNamedDeclaration",
  "ExportAllDeclaration",
  "ImportExpression",
]);
const TEMPLATE_BOUNDARY = "\u0000";
const models = new WeakMap<object, FrontendModel>();

/**
 * Maps a React style key to its CSS property name.
 *
 * @param key - A camelCase key such as `zIndex` or `WebkitTransition`, or a custom property.
 * @returns The kebab-case CSS name, with vendor prefixes restored.
 */
export function computeCssPropertyName(key: string): string {
  if (key.startsWith("--")) {
    return key;
  }
  const kebab = key.replaceAll(
    /[A-Z]/g,
    (letter) => `-${letter.toLowerCase()}`,
  );
  return kebab.startsWith("ms-") ? `-${kebab}` : kebab;
}

/**
 * Tells whether a property belongs to an object literal passed straight to a call, such as
 * `cn({ "outline-none": on })`.
 *
 * @param parent - The parent of a literal.
 * @returns `true` when the parent is such a property.
 */
function isClassHelperKey(parent: AstNode): boolean {
  const object = parent.parent;
  const call = object?.parent;
  return (
    parent.type === "Property" &&
    object?.type === "ObjectExpression" &&
    call?.type === "CallExpression" &&
    childNodes(call, "arguments").includes(object)
  );
}

/**
 * Tells whether a literal is the value of a JSX attribute that does not hold classes, with no call,
 * JSX element or function between them.
 *
 * @param node - A string or template literal.
 * @returns `true` when the literal sits in such an attribute.
 */
function isNonClassAttributeValue(node: AstNode): boolean {
  for (let current = node.parent; current; current = current.parent) {
    if (current.type === "JSXAttribute") {
      return !CLASS_ATTRIBUTE.test(attributeName(current) ?? "");
    }
    if (CLASS_SOURCE_BOUNDARIES.has(current.type)) {
      return false;
    }
  }
  return false;
}

/**
 * Tells whether a literal is not a class group: a module source, a directive, a property key, a
 * literal type, or a non-class attribute value.
 *
 * @param node - A string or template literal.
 * @returns `true` when the literal is excluded.
 */
function isExcludedLiteral(node: AstNode): boolean {
  const parent = node.parent;
  if (!parent) {
    return true;
  }
  return (
    (SOURCE_PARENTS.has(parent.type) && parent.source === node) ||
    (parent.type === "ExpressionStatement" &&
      typeof parent.directive === "string") ||
    (parent.key === node && !parent.computed && !isClassHelperKey(parent)) ||
    parent.type === "TSLiteralType" ||
    isNonClassAttributeValue(node)
  );
}

/**
 * Finds the JSX opening element whose attribute holds a node.
 *
 * @param node - Any node.
 * @returns The opening element, or `undefined` outside a JSX attribute.
 */
function enclosingElement(node: AstNode): AstNode | undefined {
  for (let current = node.parent; current; current = current.parent) {
    if (current.type === "JSXAttribute") {
      return current.parent;
    }
  }
  return undefined;
}

/**
 * Splits a template literal into class tokens, dropping tokens that touch a `${}`.
 *
 * @param node - A `TemplateLiteral`.
 * @returns The static tokens in source order.
 */
function templateTokens(node: AstNode): string[] {
  const text = childNodes(node, "quasis")
    .map((quasi) => cookedText(quasi))
    .join(TEMPLATE_BOUNDARY);
  return text
    .split(/\s+/)
    .filter((token) => token !== "" && !token.includes(TEMPLATE_BOUNDARY));
}

/**
 * Adds a literal to the model as a class group unless it is excluded or holds no tokens.
 *
 * @param node - A string or template literal.
 * @param model - The model to fill.
 */
function collectClassGroup(node: AstNode, model: MutableModel): void {
  if (isExcludedLiteral(node)) {
    return;
  }
  const tokens =
    node.type === "Literal"
      ? String(node.value).split(/\s+/).filter(Boolean)
      : templateTokens(node);
  if (tokens.length > 0) {
    model.classGroups.push({ node, tokens, element: enclosingElement(node) });
  }
}

/**
 * Strips `as`, `satisfies`, non-null and parenthesis wrappers off an expression.
 *
 * @param node - Any expression.
 * @returns The innermost wrapped expression.
 */
function unwrapExpression(node: AstNode | undefined): AstNode | undefined {
  let current = node;
  while (current && EXPRESSION_WRAPPERS.has(current.type)) {
    current = childNode(current, "expression");
  }
  return current;
}

/**
 * Lists the values an expression can take through `?:`, `&&` and `||`.
 *
 * @param node - Any expression.
 * @returns The unwrapped leaf expressions.
 */
export function listBranches(node: AstNode | undefined): AstNode[] {
  const expression = unwrapExpression(node);
  if (expression?.type === "ConditionalExpression") {
    return [
      ...listBranches(childNode(expression, "consequent")),
      ...listBranches(childNode(expression, "alternate")),
    ];
  }
  if (expression?.type === "LogicalExpression") {
    return [
      ...listBranches(childNode(expression, "left")),
      ...listBranches(childNode(expression, "right")),
    ];
  }
  return expression ? [expression] : [];
}

/**
 * Lists the statically named keys of every object literal an expression can take.
 *
 * @param expression - Any expression.
 * @returns The keys in source order.
 */
function listObjectKeys(expression: AstNode | undefined): ObjectKey[] {
  return listBranches(expression)
    .filter((branch) => branch.type === "ObjectExpression")
    .flatMap((object) => childNodes(object, "properties"))
    .flatMap((property) => {
      const key = property.type === "Property" ? keyName(property) : undefined;
      return key === undefined ? [] : [{ property, key }];
    });
}

/**
 * Lists the static texts an expression can take.
 *
 * @param value - Any expression.
 * @returns The literal texts of its branches.
 */
export function listStaticTexts(value: AstNode | undefined): string[] {
  return listBranches(value).flatMap((branch) => {
    const text = staticText(branch);
    return text === undefined ? [] : [text];
  });
}

/**
 * Lists one entry per key and statically known value of the given object keys.
 *
 * @param keys - The object keys.
 * @param element - The JSX opening element that carries the attribute holding the keys.
 * @returns One entry per key and static value text, or one entry with an `undefined` text for a
 *   key whose value has no static branch, in source order.
 */
function listKeyValues(
  keys: readonly ObjectKey[],
  element: AstNode | undefined,
): StyleLeaf[] {
  return keys.flatMap(({ property, key }) => {
    const texts = listStaticTexts(childNode(property, "value"));
    const values = texts.length > 0 ? texts : [undefined];
    return values.map((text) => ({
      node: property,
      property: computeCssPropertyName(key),
      text,
      element,
    }));
  });
}

/**
 * Adds one style leaf per key and statically known value of a `style` attribute.
 *
 * @param attribute - A `style` `JSXAttribute`.
 * @param model - The model to fill.
 */
function collectStyleLeaves(attribute: AstNode, model: MutableModel): void {
  const keys = listObjectKeys(attributeExpression(attribute));
  model.styleLeaves.push(...listKeyValues(keys, attribute.parent));
}

/**
 * Lists the key group of each entry of a `variants` object.
 *
 * @param entries - The keys of the `variants` object.
 * @returns One group per entry, holding the keys of the entry's object literal under its label.
 */
function listVariantGroups(entries: readonly ObjectKey[]): MotionKeyGroup[] {
  return entries.map(({ property, key }) => ({
    keys: listObjectKeys(childNode(property, "value")),
    variantLabel: key,
  }));
}

/**
 * Adds one motion key per key and statically known value of a motion attribute, or of each
 * `variants` entry.
 *
 * @param attribute - A motion `JSXAttribute`.
 * @param name - The attribute name.
 * @param model - The model to fill.
 */
function collectMotionKeys(
  attribute: AstNode,
  name: string,
  model: MutableModel,
): void {
  const keys = listObjectKeys(attributeExpression(attribute));
  const groups: MotionKeyGroup[] =
    name === "variants"
      ? listVariantGroups(keys)
      : [{ keys, variantLabel: undefined }];
  const motionKeys = groups.flatMap((group) =>
    listKeyValues(group.keys, attribute.parent).map((leaf) => ({
      ...leaf,
      attributeName: name,
      variantLabel: group.variantLabel,
    })),
  );
  model.motionKeys.push(...motionKeys);
}

/**
 * Tells whether a callee is `useCallback` or `<object>.useCallback`.
 *
 * @param callee - A call's callee.
 * @returns `true` for `useCallback`.
 */
function isUseCallback(callee: AstNode | undefined): boolean {
  if (callee?.type === "Identifier") {
    return callee.name === "useCallback";
  }
  return (
    callee?.type === "MemberExpression" &&
    childString(childNode(callee, "property"), "name") === "useCallback"
  );
}

/**
 * Reads the one expression a function body evaluates.
 *
 * @param body - A function's body.
 * @returns An expression body itself, the expression of a block holding one expression statement,
 *   or `undefined` for any other block.
 */
function bodyExpression(body: AstNode | undefined): AstNode | undefined {
  if (body?.type !== "BlockStatement") {
    return body;
  }
  const statements = childNodes(body, "body");
  const [only] = statements;
  return statements.length === 1 && only?.type === "ExpressionStatement"
    ? childNode(only, "expression")
    : undefined;
}

/**
 * Finds the named function a handler only delegates to.
 *
 * @param handler - A function node.
 * @returns The callee identifier when the body is a single call to a named function.
 */
function delegateCallee(handler: AstNode): AstNode | undefined {
  const call = bodyExpression(childNode(handler, "body"));
  const callee =
    call?.type === "CallExpression" ? childNode(call, "callee") : undefined;
  return callee?.type === "Identifier" ? callee : undefined;
}

/**
 * Reads the function or `const` initializer a variable definition binds.
 *
 * @param definition - The variable's first definition.
 * @returns The function declaration or `const` initializer, or `undefined` for other definitions.
 */
function definitionExpression(
  definition: Scope.Definition | undefined,
): AstNode | undefined {
  if (definition?.type === "FunctionName") {
    return toAstNode(definition.node);
  }
  return definition?.type === "Variable" && definition.parent.kind === "const"
    ? childNode(toAstNode(definition.node), "init")
    : undefined;
}

/**
 * Resolves a handler expression to the functions it runs.
 *
 * @param expression - The attribute expression.
 * @param sourceCode - The ESLint source code of the file.
 * @param seen - Expressions already visited, to stop on cycles.
 * @returns The function the expression resolves to, then each named function it only delegates
 *   to; empty when the handler is not known in this module.
 */
function resolveHandlerFunctions(
  expression: AstNode | undefined,
  sourceCode: SourceCode,
  seen: Set<AstNode>,
): AstNode[] {
  if (!expression || seen.has(expression)) {
    return [];
  }
  seen.add(expression);
  if (FUNCTION_TYPES.has(expression.type)) {
    const delegates = resolveHandlerFunctions(
      delegateCallee(expression),
      sourceCode,
      seen,
    );
    return [expression, ...delegates];
  }
  if (
    expression.type === "CallExpression" &&
    isUseCallback(childNode(expression, "callee"))
  ) {
    return resolveHandlerFunctions(
      childNodes(expression, "arguments")[0],
      sourceCode,
      seen,
    );
  }
  if (expression.type !== "Identifier") {
    return [];
  }
  const scope = sourceCode.getScope(toRuleNode(expression));
  const definition = findVariable(scope, String(expression.name))?.defs[0];
  return resolveHandlerFunctions(
    definitionExpression(definition),
    sourceCode,
    seen,
  );
}

/**
 * Tells whether a node is a `style` or motion JSX attribute, whose value the walk does not search
 * for class groups.
 *
 * @param node - Any node.
 * @returns `true` for such an attribute.
 */
function isOpaqueAttribute(node: AstNode): boolean {
  if (node.type !== "JSXAttribute") {
    return false;
  }
  const name = attributeName(node) ?? "";
  return name === "style" || MOTION_ATTRIBUTE.test(name);
}

/**
 * Adds a JSX attribute's style leaves, motion keys or handler to the model.
 *
 * @param attribute - A `JSXAttribute`.
 * @param model - The model to fill.
 * @param sourceCode - The ESLint source code of the file.
 */
function collectAttribute(
  attribute: AstNode,
  model: MutableModel,
  sourceCode: SourceCode,
): void {
  const name = attributeName(attribute) ?? "";
  if (name === "style") {
    collectStyleLeaves(attribute, model);
    return;
  }
  if (MOTION_ATTRIBUTE.test(name)) {
    collectMotionKeys(attribute, name, model);
    return;
  }
  if (!EVENT_ATTRIBUTE.test(name) || !attribute.parent) {
    return;
  }
  const handlerFunctions = resolveHandlerFunctions(
    attributeExpression(attribute),
    sourceCode,
    new Set(),
  );
  if (handlerFunctions.length > 0) {
    model.pendingHandlers.push({
      element: attribute.parent,
      attributeName: name,
      attribute,
      handlerFunctions,
    });
  }
}

/**
 * Adds an assignment to `<expression>.style.<property>` to the model.
 *
 * @param node - An `AssignmentExpression`.
 * @param model - The model to fill.
 */
function collectStyleAssignment(node: AstNode, model: MutableModel): void {
  const target = childNode(node, "left");
  const object = childNode(target, "object");
  const isStyle =
    target?.type === "MemberExpression" &&
    object?.type === "MemberExpression" &&
    !object.computed &&
    childString(childNode(object, "property"), "name") === "style";
  if (!isStyle || !target) {
    return;
  }
  const property = childNode(target, "property");
  const name = target.computed
    ? childString(property, "value")
    : childString(property, "name");
  if (name !== undefined) {
    model.styleAssignments.push({
      node,
      property: computeCssPropertyName(name),
    });
  }
}

/**
 * Adds whatever one node contributes to the model.
 *
 * @param node - Any node.
 * @param model - The model to fill.
 * @param sourceCode - The ESLint source code of the file.
 */
function collectNode(
  node: AstNode,
  model: MutableModel,
  sourceCode: SourceCode,
): void {
  if (node.type === "JSXAttribute") {
    collectAttribute(node, model, sourceCode);
  } else if (
    (node.type === "Literal" && typeof node.value === "string") ||
    node.type === "TemplateLiteral"
  ) {
    collectClassGroup(node, model);
  } else if (node.type === "AssignmentExpression") {
    collectStyleAssignment(node, model);
  }
}

/**
 * Walks a subtree depth first.
 *
 * @param node - The root of the subtree.
 * @param keys - The parser's visitor keys.
 * @param visit - Called on each node; returning `false` skips its children.
 */
function traverse(
  node: AstNode,
  keys: SourceCode.VisitorKeys,
  visit: (node: AstNode) => boolean,
): void {
  if (!visit(node)) {
    return;
  }
  for (const key of keys[node.type] ?? []) {
    const child = node[key];
    const children = Array.isArray(child) ? (child as unknown[]) : [child];
    for (const item of children) {
      if (item && typeof item === "object" && "type" in item) {
        traverse(item as AstNode, keys, visit);
      }
    }
  }
}

/**
 * Lists the style assignments inside any of the given functions.
 *
 * @param functions - Function nodes.
 * @param assignments - Every style assignment in the file.
 * @returns The contained assignments, in source order.
 */
function selectContainedAssignments(
  functions: readonly AstNode[],
  assignments: readonly StyleAssignment[],
): StyleAssignment[] {
  return assignments.filter((assignment) =>
    functions.some((container) => containsNode(container, assignment.node)),
  );
}

/**
 * Walks one file once and returns everything the frontend JS rules check.
 *
 * Class groups are every string literal and every template literal (tokens touching `${}` are
 * dropped), except import and export sources, directives, property keys, literal types, and
 * values of JSX attributes other than `class`/`className`-style ones, unless a call, tagged
 * template, JSX element or function sits between the attribute and the literal. String keys of an
 * object passed straight to a call, such as `cn({ "outline-none": on })`, are class groups.
 * Inline `style` objects and motion objects, including branches of `?:`/`&&`/`||` and
 * `as`/`satisfies` wrappers, give style leaves and motion keys instead of class groups. Handlers
 * resolve through names, `const` aliases and `useCallback`; a handler function whose body is a
 * single call to a named function also covers that function's style assignments, followed
 * transitively. Repeated calls for the same file return the same model.
 *
 * @param sourceCode - The ESLint source code of the file.
 * @returns The collected model.
 */
export function collectFrontendModel(sourceCode: SourceCode): FrontendModel {
  const cached = models.get(sourceCode.ast);
  if (cached) {
    return cached;
  }
  const model: MutableModel = {
    classGroups: [],
    styleLeaves: [],
    motionKeys: [],
    styleAssignments: [],
    pendingHandlers: [],
  };
  traverse(toAstNode(sourceCode.ast), sourceCode.visitorKeys, (node) => {
    collectNode(node, model, sourceCode);
    return !isOpaqueAttribute(node);
  });
  const { pendingHandlers, ...collected } = model;
  const handlers = pendingHandlers.map(({ handlerFunctions, ...handler }) => ({
    ...handler,
    styleAssignments: selectContainedAssignments(
      handlerFunctions,
      collected.styleAssignments,
    ),
  }));
  const result: FrontendModel = { ...collected, handlers };
  models.set(sourceCode.ast, result);
  return result;
}
