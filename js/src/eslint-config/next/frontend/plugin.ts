/**
 * Assembles the frontend rules into the `pragmatiks` ESLint plugin.
 *
 * @packageDocumentation
 */
import type { ESLint } from "eslint";

import type { DesignSystemView } from "./design-system.js";
import { createAnimatedPropertiesRule } from "./rules/animated-properties.js";
import { createColorTokensRule } from "./rules/color-tokens.js";
import { createCssAnimatedPropertiesRule } from "./rules/css-animated-properties.js";
import { createCssColorTokensRule } from "./rules/css-color-tokens.js";
import { cssFocusStylingRule } from "./rules/css-focus-styling.js";
import { cssNoApplyRule } from "./rules/css-no-apply.js";
import { cssParsedFullyRule } from "./rules/css-parsed-fully.js";
import { cssViewportUnitsRule } from "./rules/css-viewport-units.js";
import { createCssZIndexRule } from "./rules/css-z-index.js";
import { createFocusStylingRule } from "./rules/focus-styling.js";
import { formControlHasLabelRule } from "./rules/form-control-has-label.js";
import { noEmbeddedStyleRule } from "./rules/no-embedded-style.js";
import { createViewportUnitsRule } from "./rules/viewport-units.js";
import { createZIndexRule } from "./rules/z-index.js";

/**
 * Plugin rules keyed by rule ID.
 */
type PluginRules = NonNullable<ESLint.Plugin["rules"]>;

/**
 * The frontend rules keyed by rule ID, split by the files they run on.
 */
export interface FrontendRules {
  /** The rules for JavaScript and TypeScript files. */
  readonly javascript: PluginRules;
  /** The rules for CSS files. */
  readonly css: PluginRules;
}

/**
 * Builds every frontend rule around one project's design system.
 *
 * @param view - The project design system every Tailwind-aware rule reads.
 * @returns The rules for JavaScript and TypeScript files and the rules for CSS files.
 */
export function createFrontendRules(view: DesignSystemView): FrontendRules {
  return {
    javascript: {
      "form-control-has-label": formControlHasLabelRule,
      "focus-styling": createFocusStylingRule(view),
      "animated-properties": createAnimatedPropertiesRule(view),
      "viewport-units": createViewportUnitsRule(view),
      "z-index": createZIndexRule(view),
      "color-tokens": createColorTokensRule(view),
      "no-embedded-style": noEmbeddedStyleRule,
    },
    css: {
      "css-focus-styling": cssFocusStylingRule,
      "css-animated-properties": createCssAnimatedPropertiesRule(view),
      "css-viewport-units": cssViewportUnitsRule,
      "css-z-index": createCssZIndexRule(view),
      "css-color-tokens": createCssColorTokensRule(view),
      "css-no-apply": cssNoApplyRule,
      "css-parsed-fully": cssParsedFullyRule,
    } as unknown as PluginRules,
  };
}

/**
 * Builds the `pragmatiks` frontend plugin.
 *
 * @param rules - The frontend rules the plugin registers.
 * @returns The plugin with every JavaScript and CSS rule.
 */
export function createFrontendPlugin(rules: FrontendRules): ESLint.Plugin {
  return {
    meta: { name: "@pragmatiks/lint/eslint-config/next" },
    rules: { ...rules.javascript, ...rules.css },
  };
}
