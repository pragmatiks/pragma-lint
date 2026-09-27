/**
 * The `css-z-index` rule: stylesheet declarations may not set a z-index above the cap or one that
 * cannot be verified statically.
 *
 * @packageDocumentation
 */
import type { CSSRuleDefinition } from "@eslint/css";

import { exceedsZIndexCap, Z_INDEX_MESSAGE } from "../concepts/z-index.js";
import { createCssDeclarationRule } from "../css-declaration-rule.js";
import type { DesignSystemView } from "../design-system.js";

/**
 * The `css-z-index` rule type.
 */
type CssZIndexRule = CSSRuleDefinition<{
  RuleOptions: [];
  MessageIds: "exceeds";
}>;

/**
 * Builds `css-z-index`: stylesheet declarations may not set a z-index above the cap or one that
 * cannot be verified statically. Each finding names the declaration's text.
 *
 * @param view - The project design system that resolves theme variables.
 * @returns The rule.
 */
export function createCssZIndexRule(view: DesignSystemView): CssZIndexRule {
  return createCssDeclarationRule({
    description: "Cap z-index values.",
    messageId: "exceeds",
    message: Z_INDEX_MESSAGE,
    matches: (declaration) => exceedsZIndexCap(declaration, view),
    describe: (declaration) => declaration.text,
  });
}
