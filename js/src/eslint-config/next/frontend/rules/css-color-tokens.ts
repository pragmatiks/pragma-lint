/**
 * The `css-color-tokens` rule: stylesheet declarations may not use Tailwind's default palette.
 *
 * @packageDocumentation
 */
import type { CSSRuleDefinition } from "@eslint/css";

import {
  DEFAULT_PALETTE_MESSAGE,
  listDefaultPaletteColors,
} from "../concepts/color.js";
import {
  collectStylesheetDeclarations,
  type Declaration,
} from "../css-declarations.js";
import type { DesignSystemView } from "../design-system.js";

/**
 * The `css-color-tokens` rule type.
 */
type CssColorTokensRule = CSSRuleDefinition<{
  RuleOptions: [];
  MessageIds: "defaultPalette";
}>;

/**
 * Tells whether a declaration defines a custom property inside `@theme`.
 *
 * @param declaration - One stylesheet declaration.
 * @returns `true` for a `--*` declaration inside `@theme`.
 */
function isThemeDefinition(declaration: Declaration): boolean {
  return declaration.inTheme && declaration.property.startsWith("--");
}

/**
 * Builds `css-color-tokens`: stylesheet declarations may not use Tailwind's default palette.
 *
 * Variables defined inside `@theme` are project tokens, so they may alias default palette colors.
 *
 * @param view - The project design system.
 * @returns The rule.
 */
export function createCssColorTokensRule(
  view: DesignSystemView,
): CssColorTokensRule {
  return {
    meta: {
      type: "problem",
      docs: { description: "Use project color tokens." },
      messages: { defaultPalette: DEFAULT_PALETTE_MESSAGE },
      schema: [],
    },
    create(context) {
      return {
        StyleSheet(node) {
          for (const declaration of collectStylesheetDeclarations(node)) {
            if (isThemeDefinition(declaration)) {
              continue;
            }
            const variables = new Set(
              listDefaultPaletteColors(declaration.value, view),
            );
            for (const variable of variables) {
              context.report({
                node: declaration.node ?? node,
                messageId: "defaultPalette",
                data: { source: declaration.property, variable },
              });
            }
          }
        },
      };
    },
  };
}
