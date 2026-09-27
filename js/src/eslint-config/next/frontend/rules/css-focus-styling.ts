/**
 * The `css-focus-styling` rule: only the C1 pattern may change the focus indicator in stylesheets.
 *
 * @packageDocumentation
 */
import type { CSSRuleDefinition } from "@eslint/css";
import type { AtrulePlain, RulePlain } from "@eslint/css-tree";

import {
  isFocusScopedCssDeclaration,
  isFocusSelector,
  matchesC1,
} from "../concepts/focus.js";
import {
  collectStylesheetDeclarations,
  type Declaration,
} from "../css-declarations.js";

/**
 * The `css-focus-styling` rule type.
 */
type CssFocusStylingRule = CSSRuleDefinition<{
  RuleOptions: [];
  MessageIds: "focusRule" | "focusDeclaration";
}>;

/**
 * Groups the declarations of focus blocks by their block.
 *
 * @param declarations - Every declaration of a stylesheet.
 * @returns The declarations under a focus selector, keyed by their nearest rule or
 *   `@variant focus*` block, in source order.
 */
function groupFocusBlocks(
  declarations: readonly Declaration[],
): Map<RulePlain | AtrulePlain, Declaration[]> {
  const groups = new Map<RulePlain | AtrulePlain, Declaration[]>();
  for (const declaration of declarations) {
    const block = declaration.block;
    if (
      !block ||
      !declaration.selectors.some((selector) => isFocusSelector(selector))
    ) {
      continue;
    }
    const group = groups.get(block) ?? [];
    group.push(declaration);
    groups.set(block, group);
  }
  return groups;
}

/**
 * `css-focus-styling`: everything in a stylesheet that can change the focus indicator must be C1.
 *
 * A rule whose selector targets focus, and an `@variant focus*` block, must be C1 as a whole
 * (`focusRule`). Outside such rules, `outline*`, `forced-color-adjust`, `all`,
 * `--tw-ring-*`, `--tw-inset-ring-*`, resets of `--tw-shadow`/`--tw-inset-shadow`, `!important`
 * box shadows, and box shadows that do not compose the ring offset and ring and beat the utilities
 * layer are flagged (`focusDeclaration`).
 */
export const cssFocusStylingRule: CssFocusStylingRule = {
  meta: {
    type: "problem",
    docs: { description: "Allow only the C1 focus pattern." },
    messages: {
      focusRule:
        "A focus rule must be exactly C1: every selector ends in :focus-visible (or the rule is an @variant focus-visible block), and the only declarations are outline: <non-zero width> solid var(--token) and an optional outline-offset, without !important.",
      focusDeclaration:
        "{{property}} outside a C1 focus rule can hide or override the focus indicator; move focus styling into a C1 rule, and put a decorative box-shadow in @layer components or use filter: drop-shadow().",
    },
    schema: [],
  },
  create(context) {
    return {
      StyleSheet(node) {
        const declarations = collectStylesheetDeclarations(node);
        const focusBlocks = groupFocusBlocks(declarations);
        for (const [block, blockDeclarations] of focusBlocks) {
          if (!matchesC1(block, blockDeclarations)) {
            context.report({ node: block, messageId: "focusRule" });
          }
        }
        const grouped = new Set([...focusBlocks.values()].flat());
        for (const declaration of declarations) {
          if (
            declaration.node &&
            !grouped.has(declaration) &&
            isFocusScopedCssDeclaration(declaration)
          ) {
            context.report({
              node: declaration.node,
              messageId: "focusDeclaration",
              data: { property: declaration.property },
            });
          }
        }
      },
    };
  },
};
