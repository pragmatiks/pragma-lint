/**
 * The `viewport-units` rule: class tokens and inline styles may not use the `vh` unit.
 *
 * @packageDocumentation
 */
import type { Rule } from "eslint";

import { usesVhUnit, VH_UNIT_MESSAGE } from "../concepts/viewport.js";
import { createDeclarationRule } from "../declaration-rule.js";
import type { DesignSystemView } from "../design-system.js";

/**
 * Builds `viewport-units`: class tokens and inline styles may not use the `vh` unit.
 *
 * @param view - The project design system.
 * @returns The rule.
 */
export function createViewportUnitsRule(
  view: DesignSystemView,
): Rule.RuleModule {
  return createDeclarationRule(view, {
    description: "Disallow vh units.",
    messageId: "vhUnit",
    message: VH_UNIT_MESSAGE,
    matches: usesVhUnit,
  });
}
