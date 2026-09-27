/**
 * The `form-control-has-label` rule: every form control needs an accessible name.
 *
 * @packageDocumentation
 */
import type { Rule, Scope, SourceCode } from "eslint";

import {
  type AstNode,
  childNode,
  childNodes,
  childString,
  containsNode,
  findJsxAttribute,
  findVariable,
  FUNCTION_TYPES,
  jsxAttributeValue,
  jsxElementName,
  staticText,
  toAstNode,
  toRuleNode,
} from "../ast.js";

/**
 * A `<label htmlFor>` and the component it renders in.
 */
interface LabelTarget {
  /** The component that renders the label, in the format {@link enclosingComponent} returns. */
  readonly component: AstNode;
  /** The id key of the label's `htmlFor`, in the format {@link idKey} returns. */
  readonly key: string;
}

/**
 * Elements that need a label.
 */
const CONTROLS = new Set(["input", "textarea", "select"]);

/**
 * Elements a `<label>` without `htmlFor` can label.
 */
const LABELABLE_ELEMENTS = new Set([
  "button",
  "input",
  "meter",
  "output",
  "progress",
  "select",
  "textarea",
]);

/**
 * Input types that need no label.
 */
const EXEMPT_INPUT_TYPES = new Set([
  "hidden",
  "submit",
  "reset",
  "button",
  "image",
]);

/**
 * Attributes that give a control an accessible name on their own.
 */
const LABEL_ATTRIBUTES = ["aria-label", "aria-labelledby"];

/**
 * Id expression types matched by their source text.
 */
const SOURCE_KEYED_TYPES = new Set([
  "MemberExpression",
  "ChainExpression",
  "TemplateLiteral",
]);

/**
 * Reads the static text of an attribute.
 *
 * @param opening - A `JSXOpeningElement`.
 * @param name - The attribute name.
 * @returns The text, or `undefined` when the attribute is missing or not static.
 */
function attributeText(opening: AstNode, name: string): string | undefined {
  const attribute = findJsxAttribute(opening, name);
  return attribute ? staticText(jsxAttributeValue(attribute)) : undefined;
}

/**
 * Tells whether an attribute value is known to be empty.
 *
 * @param value - The attribute value.
 * @returns `true` for no value, `null`, `undefined` or an empty static string.
 */
function isStaticallyAbsent(value: AstNode | undefined): boolean {
  return (
    value === undefined ||
    (value.type === "Literal" && value.value === null) ||
    (value.type === "Identifier" && value.name === "undefined") ||
    staticText(value) === ""
  );
}

/**
 * Tells whether an element has a non-absent `aria-label` or `aria-labelledby`.
 *
 * @param opening - A `JSXOpeningElement`.
 * @returns `true` when either attribute gives the element a name.
 */
function hasAriaName(opening: AstNode): boolean {
  return LABEL_ATTRIBUTES.some((name) => {
    const attribute = findJsxAttribute(opening, name);
    return (
      attribute !== undefined &&
      !isStaticallyAbsent(jsxAttributeValue(attribute))
    );
  });
}

/**
 * Tells whether a control is skipped: it spreads props, or it is an input of an exempt type.
 *
 * @param opening - A control's `JSXOpeningElement`.
 * @param name - The control's tag name.
 * @returns `true` when the rule does not check the control.
 */
function isExemptControl(opening: AstNode, name: string): boolean {
  const typeValue = attributeText(opening, "type");
  const spread = childNodes(opening, "attributes").some(
    (attribute) => attribute.type === "JSXSpreadAttribute",
  );
  return (
    spread ||
    (name === "input" &&
      typeValue !== undefined &&
      EXEMPT_INPUT_TYPES.has(typeValue))
  );
}

/**
 * Tells whether a `<label>` without `htmlFor` can label an element.
 *
 * @param opening - A `JSXOpeningElement`.
 * @returns `true` for labelable elements other than hidden inputs.
 */
function isLabelable(opening: AstNode): boolean {
  const name = jsxElementName(opening) ?? "";
  return (
    LABELABLE_ELEMENTS.has(name) &&
    !(name === "input" && attributeText(opening, "type") === "hidden")
  );
}

/**
 * Builds the key of a variable from its declaration.
 *
 * @param variable - A variable, or `undefined` or `null` for none.
 * @returns `variable:<offset>`, where offset is the start of the variable's declaration, or
 *   `undefined` for no variable or a variable without a declaration, such as a configured global.
 */
function declarationKey(
  variable: Scope.Variable | null | undefined,
): string | undefined {
  const range = variable?.identifiers[0]?.range;
  return range ? `variable:${String(range[0])}` : undefined;
}

/**
 * Builds the id key of an identifier from the variable it resolves to.
 *
 * @param identifier - An `Identifier` used as an id.
 * @param sourceCode - The file's source code.
 * @returns The key {@link declarationKey} builds for the variable, or `undefined` when the
 *   identifier resolves to no declared variable.
 */
function variableKey(
  identifier: AstNode,
  sourceCode: SourceCode,
): string | undefined {
  const scope = sourceCode.getScope(toRuleNode(identifier));
  return declarationKey(findVariable(scope, String(identifier.name)));
}

/**
 * Tells whether a reference can read a runtime value.
 *
 * @param reference - A reference.
 * @returns `false` for a TypeScript type-only reference, such as the type in `props as Field`;
 *   `true` for every other reference.
 */
function isValueReference(reference: Scope.Reference): boolean {
  return (
    !("isValueReference" in reference) || reference.isValueReference === true
  );
}

/**
 * Lists the value references a scope and its nested scopes make inside an expression.
 *
 * @param scope - The innermost scope holding the expression.
 * @param expression - The expression.
 * @returns The references whose identifier lies inside the expression, in scope order, without
 *   type-only references.
 */
function listContainedReferences(
  scope: Scope.Scope,
  expression: AstNode,
): Scope.Reference[] {
  const ownReferences = scope.references.filter(
    (reference) =>
      isValueReference(reference) &&
      containsNode(expression, toAstNode(reference.identifier)),
  );
  const nestedReferences = scope.childScopes
    .filter((child) => containsNode(expression, toAstNode(child.block)))
    .flatMap((child) => listContainedReferences(child, expression));
  return [...ownReferences, ...nestedReferences];
}

/**
 * Builds the key of a reference from the variable it resolves to.
 *
 * @param reference - A reference.
 * @returns The key {@link declarationKey} builds for the resolved variable, or `global:<name>` for
 *   a name that resolves to no declared variable.
 */
function referenceKey(reference: Scope.Reference): string {
  return (
    declarationKey(reference.resolved) ?? `global:${reference.identifier.name}`
  );
}

/**
 * Builds the id key of an expression from its source text and the variables it reads.
 *
 * @param expression - A member, optional-chain or template expression used as an id.
 * @param sourceCode - The file's source code.
 * @returns `source:<text>@<variables>`, where variables lists the key of every value the expression
 *   reads, so the same text over different variables, such as parameters of two callbacks, gives
 *   different keys even when both callbacks map the same array.
 */
function sourceKey(expression: AstNode, sourceCode: SourceCode): string {
  const node = toRuleNode(expression);
  const references = listContainedReferences(
    sourceCode.getScope(node),
    expression,
  );
  const variables = references.map((reference) => referenceKey(reference));
  return `source:${sourceCode.getText(node)}@${variables.join(",")}`;
}

/**
 * Builds the key two id attributes share when they refer to the same id.
 *
 * @param attribute - An `id` or `htmlFor` attribute.
 * @param sourceCode - The file's source code.
 * @returns `string:<text>` for non-empty static text, the key {@link variableKey} builds for an
 *   identifier, the key {@link sourceKey} builds for a member, optional-chain or template
 *   expression, and `undefined` for a missing attribute, an empty string or any other expression.
 */
function idKey(
  attribute: AstNode | undefined,
  sourceCode: SourceCode,
): string | undefined {
  const value = attribute ? jsxAttributeValue(attribute) : undefined;
  const text = staticText(value);
  if (text !== undefined) {
    return text === "" ? undefined : `string:${text}`;
  }
  if (value?.type === "Identifier") {
    return variableKey(value, sourceCode);
  }
  return value && SOURCE_KEYED_TYPES.has(value.type)
    ? sourceKey(value, sourceCode)
    : undefined;
}

/**
 * Reads the name a function declaration or a variable initialiser declares.
 *
 * @param node - A function node.
 * @returns The name of a function declaration; for a function that initialises a variable, its own
 *   name, else the variable's; `undefined` for any other function, such as a callback passed to a
 *   call, a property value or a class method.
 */
function functionName(node: AstNode): string | undefined {
  const parent = node.parent;
  const ownName = childString(childNode(node, "id"), "name");
  if (node.type === "FunctionDeclaration") {
    return ownName;
  }
  if (parent?.type !== "VariableDeclarator" || parent.init !== node) {
    return undefined;
  }
  return ownName ?? childString(childNode(parent, "id"), "name");
}

/**
 * Finds the component an element renders in.
 *
 * @param node - Any node.
 * @returns The nearest enclosing function declaration or variable initialiser whose name starts
 *   with a capital letter; else the outermost enclosing function, so callbacks nested in a component
 *   count as that component; else the program root outside any function.
 */
function enclosingComponent(node: AstNode): AstNode {
  let outermostFunction: AstNode | undefined;
  let current = node;
  while (current.parent) {
    if (FUNCTION_TYPES.has(current.type)) {
      if (/^[A-Z]/.test(functionName(current) ?? "")) {
        return current;
      }
      outermostFunction = current;
    }
    current = current.parent;
  }
  return outermostFunction ?? current;
}

/**
 * Tells whether a node is a `<label>` element.
 *
 * @param node - Any node.
 * @returns `true` for a `JSXElement` whose tag is `label`.
 */
function isLabelElement(node: AstNode): boolean {
  const opening = childNode(node, "openingElement");
  return (
    node.type === "JSXElement" &&
    opening !== undefined &&
    jsxElementName(opening) === "label"
  );
}

/**
 * Finds the nearest `<label>` element around an element.
 *
 * @param opening - A `JSXOpeningElement`.
 * @returns The enclosing label's `JSXElement`, or `undefined` when none encloses it.
 */
function enclosingLabel(opening: AstNode): AstNode | undefined {
  let current = opening.parent?.parent;
  while (current && !isLabelElement(current)) {
    current = current.parent;
  }
  return current;
}

/**
 * Tells whether two elements sit on opposite branches of the same conditional, so at most one of
 * them renders.
 *
 * @param first - An element.
 * @param second - Another element.
 * @returns `true` when the nearest conditional expression enclosing both holds one in its
 *   consequent and the other in its alternate.
 */
function areMutuallyExclusive(first: AstNode, second: AstNode): boolean {
  let current = first.parent;
  while (
    current &&
    !(current.type === "ConditionalExpression" && containsNode(current, second))
  ) {
    current = current.parent;
  }
  const consequent = childNode(current, "consequent");
  const alternate = childNode(current, "alternate");
  if (!consequent || !alternate) {
    return false;
  }
  return (
    (containsNode(consequent, first) && containsNode(alternate, second)) ||
    (containsNode(alternate, first) && containsNode(consequent, second))
  );
}

/**
 * Tells whether an enclosing `<label>` labels a control.
 *
 * @param opening - The control's `JSXOpeningElement`.
 * @param controlKey - The id key of the control's `id`.
 * @param openings - Every opening element in the file, in source order.
 * @param sourceCode - The file's source code.
 * @returns `true` when the label's `htmlFor` matches the control's id, or when the label has no
 *   `htmlFor` and the control is its first labelable element; an element on the other branch of a
 *   conditional never renders together with the control, so it does not count as earlier.
 */
function hasWrappingLabel(
  opening: AstNode,
  controlKey: string | undefined,
  openings: readonly AstNode[],
  sourceCode: SourceCode,
): boolean {
  const label = enclosingLabel(opening);
  const labelOpening = childNode(label, "openingElement");
  if (!label || !labelOpening) {
    return false;
  }
  const htmlFor = findJsxAttribute(labelOpening, "htmlFor");
  if (htmlFor !== undefined) {
    return (
      controlKey !== undefined && idKey(htmlFor, sourceCode) === controlKey
    );
  }
  const firstLabelable = openings.find(
    (candidate) =>
      containsNode(label, candidate) &&
      isLabelable(candidate) &&
      !areMutuallyExclusive(candidate, opening),
  );
  return firstLabelable === opening;
}

/**
 * Builds the label target of a `<label>` with a resolvable `htmlFor`.
 *
 * @param opening - A `JSXOpeningElement`.
 * @param sourceCode - The file's source code.
 * @returns The label's component and id key, or `undefined` for any other element.
 */
function buildLabelTarget(
  opening: AstNode,
  sourceCode: SourceCode,
): LabelTarget | undefined {
  if (jsxElementName(opening) !== "label") {
    return undefined;
  }
  const key = idKey(findJsxAttribute(opening, "htmlFor"), sourceCode);
  return key === undefined
    ? undefined
    : { component: enclosingComponent(opening), key };
}

/**
 * Tells whether an element is a control the rule checks that has no aria name.
 *
 * @param opening - A `JSXOpeningElement`.
 * @returns `true` for a non-exempt control without `aria-label` or `aria-labelledby`.
 */
function needsLabel(opening: AstNode): boolean {
  const name = jsxElementName(opening) ?? "";
  return (
    CONTROLS.has(name) &&
    !isExemptControl(opening, name) &&
    !hasAriaName(opening)
  );
}

/**
 * `form-control-has-label`: every `input`, `textarea` and `select` needs an accessible name.
 *
 * A control passes with a non-absent `aria-label` or `aria-labelledby`; as the first labelable
 * element inside a `<label>` without `htmlFor`, where elements on the other branch of a conditional
 * do not count; inside a `<label>` with a matching `htmlFor`; or next to a `<label htmlFor>` in the
 * same component whose id matches. The component is the nearest enclosing function declaration or
 * variable initialiser named with a capital letter (by its own name or its variable's), else the
 * outermost enclosing function, so callbacks, named ones included, count as their component. Ids
 * match when they are the same static string, the same variable (a `const`, a prop, a parameter or
 * a `useId()` result), or member, optional-chain or template expressions with the same source text
 * whose values resolve to the same variables. Controls with spread props are skipped, and so are
 * inputs of type hidden, submit, reset, button and image.
 *
 * Known false positives: a component defined inside another component is a separate component, so
 * it does not pair with a label its enclosing component renders; and separate callbacks over the
 * same data, such as a label list and an input list mapping one array, do not pair. Known false
 * negative: components nested in a factory function pair with each other's labels when they are
 * wrapped in a call such as `forwardRef` or `memo`, written as object property values, or written
 * as classes, since only function declarations and variable initialisers are component boundaries.
 */
export const formControlHasLabelRule: Rule.RuleModule = {
  meta: {
    type: "problem",
    docs: { description: "Require a label on form controls." },
    messages: {
      unlabelled:
        "Give this <{{element}}> a <label>, a matching <label htmlFor>, or an aria-label or aria-labelledby; a placeholder is not a label.",
    },
    schema: [],
  },
  create(context) {
    const sourceCode = context.sourceCode;
    const controls: AstNode[] = [];
    const labels: LabelTarget[] = [];
    const openings: AstNode[] = [];
    return {
      JSXOpeningElement(node: Rule.Node) {
        const opening = toAstNode(node);
        openings.push(opening);
        const label = buildLabelTarget(opening, sourceCode);
        if (label) {
          labels.push(label);
        }
        if (needsLabel(opening)) {
          controls.push(opening);
        }
      },
      "Program:exit"() {
        for (const control of controls) {
          const key = idKey(findJsxAttribute(control, "id"), sourceCode);
          const component = enclosingComponent(control);
          const sibling =
            key !== undefined &&
            labels.some(
              (label) => label.key === key && label.component === component,
            );
          if (
            !sibling &&
            !hasWrappingLabel(control, key, openings, sourceCode)
          ) {
            context.report({
              node: toRuleNode(control),
              messageId: "unlabelled",
              data: { element: jsxElementName(control) ?? "" },
            });
          }
        }
      },
    };
  },
};
