/**
 * The `z-index` rule: class tokens and inline styles may not set a z-index above the cap or one
 * that cannot be verified statically.
 *
 * @packageDocumentation
 */
import type { Rule } from "eslint";

import { exceedsZIndexCap, Z_INDEX_MESSAGE } from "../concepts/z-index.js";
import { createDeclarationRule } from "../declaration-rule.js";
import type { DesignSystemView } from "../design-system.js";

/**
 * Builds `z-index`: class tokens and inline styles may not set a z-index above the cap or one that
 * cannot be verified statically.
 *
 * @param view - The project design system.
 * @returns The rule.
 */
export function createZIndexRule(view: DesignSystemView): Rule.RuleModule {
  return createDeclarationRule(view, {
    description: "Cap z-index values.",
    messageId: "exceeds",
    message: Z_INDEX_MESSAGE,
    matches: (declaration) => exceedsZIndexCap(declaration, view),
  });
}
