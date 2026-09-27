/**
 * The `css-viewport-units` rule: stylesheet declarations may not use the `vh` unit.
 *
 * @packageDocumentation
 */
import type { CSSRuleDefinition } from "@eslint/css";

import { usesVhUnit, VH_UNIT_MESSAGE } from "../concepts/viewport.js";
import { createCssDeclarationRule } from "../css-declaration-rule.js";

/**
 * The `css-viewport-units` rule type.
 */
type CssViewportUnitsRule = CSSRuleDefinition<{
  RuleOptions: [];
  MessageIds: "vhUnit";
}>;

/**
 * `css-viewport-units`: stylesheet declarations may not use the `vh` unit, `var()` fallbacks
 * included. Each finding names the declaration's property.
 */
export const cssViewportUnitsRule: CssViewportUnitsRule =
  createCssDeclarationRule({
    description: "Disallow vh units.",
    messageId: "vhUnit",
    message: VH_UNIT_MESSAGE,
    matches: usesVhUnit,
    describe: (declaration) => declaration.property,
  });
