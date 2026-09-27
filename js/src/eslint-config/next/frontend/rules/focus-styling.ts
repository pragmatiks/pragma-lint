/**
 * The `focus-styling` rule: only the P1 class pattern may change the focus indicator in JavaScript
 * and TypeScript files.
 *
 * @packageDocumentation
 */
import type { Rule } from "eslint";

import {
  type AstNode,
  childNodes,
  findJsxAttribute,
  jsxAttributeValue,
} from "../ast.js";
import {
  collectFrontendModel,
  type ElementHandler,
  type FrontendModel,
  listBranches,
  listStaticTexts,
  type MotionKey,
  type StyleAssignment,
  type StyleLeaf,
} from "../collect.js";
import {
  evaluateFocusGroup,
  type FocusGroupVerdict,
  isBoxShadowProperty,
  isFocusIndicatorProperty,
  isShadowVariableReset,
} from "../concepts/focus.js";
import { parseStyleLeaf } from "../css-declarations.js";
import type { DesignSystemView } from "../design-system.js";
import { createUniqueReporter, type Reporter } from "../report.js";

/**
 * An inline style or motion key.
 */
type StyleKey = StyleLeaf | MotionKey;

/**
 * A class group with its focus verdict.
 */
interface EvaluatedGroup {
  /** The class group literal. */
  readonly node: AstNode;
  /** The verdict on its tokens. */
  readonly verdict: FocusGroupVerdict;
}

const FOCUS_HANDLER_ATTRIBUTES = new Set([
  "onFocus",
  "onBlur",
  "onFocusCapture",
  "onBlurCapture",
]);
const P1_DESCRIPTION =
  "focus-visible:outline-hidden focus-visible:ring-2 (plus an optional project ring color, ring-offset-<n> and project offset color)";

/**
 * Describes what breaks the P1 pattern in a class group.
 *
 * @param verdict - The class group's verdict.
 * @returns The tokens outside P1 and the P1 parts that are missing or repeated, joined by `; `.
 */
function describeVerdict(verdict: FocusGroupVerdict): string {
  const parts: string[] = [];
  if (verdict.offending.length > 0) {
    parts.push(`not P1: ${verdict.offending.join(" ")}`);
  }
  if (verdict.outOfRange.length > 0) {
    parts.push(`missing or repeated: ${verdict.outOfRange.join(", ")}`);
  }
  return parts.join("; ");
}

/**
 * Tells whether a handler is a focus or blur handler that writes `.style`.
 *
 * @param handler - An element handler.
 * @returns `true` for such a handler.
 */
function isStylingFocusHandler(handler: ElementHandler): boolean {
  return (
    FOCUS_HANDLER_ATTRIBUTES.has(handler.attributeName) &&
    handler.styleAssignments.length > 0
  );
}

/**
 * Lists the inline style and motion keys of a file.
 *
 * @param model - The file's frontend model.
 * @returns The style leaves followed by the motion keys.
 */
function listStyleKeys(model: FrontendModel): StyleKey[] {
  return [...model.styleLeaves, ...model.motionKeys];
}

/**
 * Tells whether a style key resets `--tw-shadow` or `--tw-inset-shadow`.
 *
 * @param key - An inline style or motion key.
 * @returns `true` for a key whose static value resets a shadow variable.
 */
function resetsShadowVariable(key: StyleKey): boolean {
  const declaration = parseStyleLeaf(key);
  return declaration !== undefined && isShadowVariableReset(declaration);
}

/**
 * Lists the variant labels an element's `whileFocus` names.
 *
 * @param element - A JSX opening element, or `undefined` outside JSX.
 * @returns The labels of every static string or array of static strings the value can take behind
 *   `as`, `satisfies`, `!`, ternaries and `&&`, or an empty list for no `whileFocus`.
 */
function listWhileFocusLabels(element: AstNode | undefined): string[] {
  const attribute = element && findJsxAttribute(element, "whileFocus");
  const value = attribute && jsxAttributeValue(attribute);
  return listBranches(value).flatMap((branch) =>
    branch.type === "ArrayExpression"
      ? childNodes(branch, "elements").flatMap((item) => listStaticTexts(item))
      : listStaticTexts(branch),
  );
}

/**
 * Tells whether a style key is a key of a `whileFocus` motion object.
 *
 * @param key - An inline style or motion key.
 * @returns `true` for a key of an inline `whileFocus` object, or of a `variants` entry whose label
 *   the element's `whileFocus` names, other than the `transition` timing config.
 */
function isWhileFocusKey(key: StyleKey): boolean {
  if (!("attributeName" in key) || key.property === "transition") {
    return false;
  }
  return (
    key.attributeName === "whileFocus" ||
    (key.variantLabel !== undefined &&
      listWhileFocusLabels(key.element).includes(key.variantLabel))
  );
}

/**
 * Tells whether a style key changes the focus indicator.
 *
 * @param key - An inline style or motion key.
 * @returns `true` for an indicator property, a shadow variable reset, or any `whileFocus` key.
 */
function isIndicatorKey(key: StyleKey): boolean {
  return (
    isFocusIndicatorProperty(key.property) ||
    resetsShadowVariable(key) ||
    isWhileFocusKey(key)
  );
}

/**
 * Evaluates every class group of a file against the P1 pattern.
 *
 * @param model - The file's frontend model.
 * @param view - The project design system.
 * @returns One entry per class group, in source order.
 */
function evaluateClassGroups(
  model: FrontendModel,
  view: DesignSystemView,
): EvaluatedGroup[] {
  return model.classGroups.map((group) => ({
    node: group.node,
    verdict: evaluateFocusGroup(group.tokens, view),
  }));
}

/**
 * Selects the class groups that hold focus-scoped tokens.
 *
 * @param groups - The evaluated class groups.
 * @returns The literals of the focus-scoped groups.
 */
function selectFocusScopedNodes(
  groups: readonly EvaluatedGroup[],
): Set<AstNode> {
  return new Set(
    groups
      .filter((group) => group.verdict.scoped.length > 0)
      .map((group) => group.node),
  );
}

/**
 * Collects the elements whose focus indicator is styled by a class, an inline key or a focus
 * handler.
 *
 * @param model - The file's frontend model.
 * @param scopedNodes - The literals of the focus-scoped class groups.
 * @returns The JSX opening elements.
 */
function collectFocusStyledElements(
  model: FrontendModel,
  scopedNodes: ReadonlySet<AstNode>,
): Set<AstNode> {
  const elements = new Set<AstNode>();
  for (const group of model.classGroups) {
    if (group.element && scopedNodes.has(group.node)) {
      elements.add(group.element);
    }
  }
  for (const key of listStyleKeys(model)) {
    if (key.element && isIndicatorKey(key)) {
      elements.add(key.element);
    }
  }
  for (const handler of model.handlers) {
    if (isStylingFocusHandler(handler)) {
      elements.add(handler.element);
    }
  }
  return elements;
}

/**
 * Tells whether a handler styles the focus indicator.
 *
 * @param handler - An element handler.
 * @param focusStyled - The focus-styled elements.
 * @returns `true` for a focus handler, or a handler on a focus-styled element that writes
 *   `.style.boxShadow`.
 */
function isScopedHandler(
  handler: ElementHandler,
  focusStyled: ReadonlySet<AstNode>,
): boolean {
  const writesShadow = handler.styleAssignments.some((assignment) =>
    isBoxShadowProperty(assignment.property),
  );
  return (
    isStylingFocusHandler(handler) ||
    (focusStyled.has(handler.element) && writesShadow)
  );
}

/**
 * Selects the handlers that style the focus indicator, once per set of style writes.
 *
 * @param model - The file's frontend model.
 * @param focusStyled - The focus-styled elements.
 * @returns The scoped handlers in source order, without a handler whose style writes all belong to
 *   handlers listed before it, such as a second element sharing the same handler function.
 */
function selectScopedHandlers(
  model: FrontendModel,
  focusStyled: ReadonlySet<AstNode>,
): ElementHandler[] {
  const covered = new Set<StyleAssignment>();
  return model.handlers.filter((handler) => {
    if (
      !isScopedHandler(handler, focusStyled) ||
      handler.styleAssignments.every((assignment) => covered.has(assignment))
    ) {
      return false;
    }
    for (const assignment of handler.styleAssignments) {
      covered.add(assignment);
    }
    return true;
  });
}

/**
 * Reports each class group that breaks the P1 pattern.
 *
 * @param report - The reporter.
 * @param groups - The evaluated class groups.
 */
function reportClassGroups(
  report: Reporter,
  groups: readonly EvaluatedGroup[],
): void {
  for (const { node, verdict } of groups) {
    if (verdict.offending.length > 0 || verdict.outOfRange.length > 0) {
      report({
        node,
        messageId: "classGroup",
        data: { problems: describeVerdict(verdict) },
      });
    }
  }
}

/**
 * Reports `whileFocus` keys, inline indicator keys, and `boxShadow` keys on focus-styled elements.
 *
 * @param report - The reporter.
 * @param model - The file's frontend model.
 * @param focusStyled - The focus-styled elements.
 */
function reportStyleKeys(
  report: Reporter,
  model: FrontendModel,
  focusStyled: ReadonlySet<AstNode>,
): void {
  for (const key of listStyleKeys(model)) {
    const isOnFocusStyledElement =
      key.element !== undefined && focusStyled.has(key.element);
    if (
      isIndicatorKey(key) ||
      (isBoxShadowProperty(key.property) && isOnFocusStyledElement)
    ) {
      report({
        node: key.node,
        messageId: isWhileFocusKey(key) ? "whileFocus" : "inlineStyle",
        data: { property: key.property },
      });
    }
  }
}

/**
 * Reports each scoped handler on its attribute.
 *
 * @param report - The reporter.
 * @param handlers - The scoped handlers.
 */
function reportHandlers(
  report: Reporter,
  handlers: readonly ElementHandler[],
): void {
  for (const handler of handlers) {
    report({
      node: handler.attribute,
      messageId: "handler",
      data: { attribute: handler.attributeName },
    });
  }
}

/**
 * Reports `.style` writes to indicator properties outside the reported handlers.
 *
 * @param report - The reporter.
 * @param model - The file's frontend model.
 * @param reportedHandlers - The handlers already reported.
 */
function reportAssignments(
  report: Reporter,
  model: FrontendModel,
  reportedHandlers: readonly ElementHandler[],
): void {
  const covered = new Set(
    reportedHandlers.flatMap((handler) => handler.styleAssignments),
  );
  for (const assignment of model.styleAssignments) {
    if (
      isFocusIndicatorProperty(assignment.property) &&
      !covered.has(assignment)
    ) {
      report({
        node: assignment.node,
        messageId: "assignment",
        data: { property: assignment.property },
      });
    }
  }
}

/**
 * Builds `focus-styling`: everything in a JavaScript or TypeScript file that can change the focus
 * indicator must be the P1 class pattern.
 *
 * In scope: class tokens with focus selectors, outline (`--tw-outline-style` included), ring,
 * `forced-color-adjust`, `all`, resets of `--tw-shadow`/`--tw-inset-shadow` (arbitrary properties
 * included) or a shadow that cannot compose the ring; inline style and motion-prop keys for
 * outline, ring (`--tw-ring-*` and `--tw-inset-ring-*` included), `forcedColorAdjust` and `all`,
 * and resets of `--tw-shadow`/`--tw-inset-shadow`; every key of `whileFocus` other than
 * `transition`, including the keys of a `variants` entry that a static `whileFocus` label or label
 * array names; `boxShadow` keys on focus-styled elements; `.style` writes to those indicator properties; focus and blur handlers
 * (capture phase included) that write `.style.*`; and any handler on a focus-styled element that
 * writes `.style.boxShadow`.
 *
 * Not followed: a `variants` object held in a variable, a variant written as a function, and
 * `whileFocus` labels an element inherits from a parent motion element.
 *
 * @param view - The project design system.
 * @returns The rule.
 */
export function createFocusStylingRule(
  view: DesignSystemView,
): Rule.RuleModule {
  return {
    meta: {
      type: "problem",
      docs: { description: "Allow only the P1 focus pattern." },
      messages: {
        classGroup: `Focus styling in this class string must be exactly ${P1_DESCRIPTION}; {{problems}}.`,
        inlineStyle: `Inline {{property}} changes the focus indicator; use ${P1_DESCRIPTION}.`,
        whileFocus: `whileFocus styles the focused state with {{property}}; focus styling must be exactly ${P1_DESCRIPTION}.`,
        handler: `This {{attribute}} handler styles the focus indicator imperatively; use ${P1_DESCRIPTION}.`,
        assignment: `.style writes to {{property}} change the focus indicator; use ${P1_DESCRIPTION}.`,
      },
      schema: [],
    },
    create(context) {
      return {
        "Program:exit"() {
          const report = createUniqueReporter(context);
          const model = collectFrontendModel(context.sourceCode);
          const groups = evaluateClassGroups(model, view);
          const scopedNodes = selectFocusScopedNodes(groups);
          const focusStyled = collectFocusStyledElements(model, scopedNodes);
          const scopedHandlers = selectScopedHandlers(model, focusStyled);
          reportClassGroups(report, groups);
          reportStyleKeys(report, model, focusStyled);
          reportHandlers(report, scopedHandlers);
          reportAssignments(report, model, scopedHandlers);
        },
      };
    },
  };
}
