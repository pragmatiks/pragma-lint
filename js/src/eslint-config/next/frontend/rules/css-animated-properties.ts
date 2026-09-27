/**
 * The `css-animated-properties` rule: stylesheet transitions, keyframes and animations may animate
 * paint properties only.
 *
 * @packageDocumentation
 */
import type { CSSRuleDefinition } from "@eslint/css";
import type { CssNodePlain } from "@eslint/css-tree";

import {
  evaluateAnimation,
  evaluateKeyframeDeclaration,
  evaluateTransition,
  MOTION_MESSAGES,
  type MotionFinding,
  type MotionReport,
  reportMotionFindings,
} from "../concepts/motion.js";
import { collectStylesheetDeclarations } from "../css-declarations.js";
import type { DesignSystemView } from "../design-system.js";

/**
 * The `css-animated-properties` rule type, with one message ID per finding kind.
 */
type CssAnimatedPropertiesRule = CSSRuleDefinition<{
  RuleOptions: [];
  MessageIds: MotionFinding["kind"];
}>;

/**
 * Builds `css-animated-properties`: stylesheet transitions may not animate all properties, layout
 * properties or unverifiable properties; keyframes may not animate layout properties; and
 * `animation`/`animation-name` may not name theme keyframes that animate layout properties.
 *
 * @param view - The project design system.
 * @returns The rule.
 */
export function createCssAnimatedPropertiesRule(
  view: DesignSystemView,
): CssAnimatedPropertiesRule {
  return {
    meta: {
      type: "problem",
      docs: { description: "Animate paint properties only." },
      messages: MOTION_MESSAGES,
      schema: [],
    },
    create(context) {
      const report = (motionReport: MotionReport<CssNodePlain>) => {
        context.report(motionReport);
      };
      return {
        StyleSheet(node) {
          for (const declaration of collectStylesheetDeclarations(node)) {
            const findings = [
              ...evaluateTransition(declaration),
              ...evaluateKeyframeDeclaration(declaration),
              ...evaluateAnimation(declaration, view),
            ];
            reportMotionFindings(
              report,
              declaration.node ?? node,
              declaration.property,
              findings,
            );
          }
        },
      };
    },
  };
}
