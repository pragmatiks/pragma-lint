/**
 * The `animated-properties` rule: transitions and animations in classes, inline styles and motion
 * props may animate paint properties only.
 *
 * @packageDocumentation
 */
import type { Rule } from "eslint";

import { compileClassGroup } from "../class-group-declarations.js";
import { collectFrontendModel, type FrontendModel } from "../collect.js";
import {
  evaluateAnimation,
  evaluateMotionKey,
  evaluateTransition,
  MOTION_MESSAGES,
  type MotionFinding,
  reportMotionFindings,
} from "../concepts/motion.js";
import { type Declaration, parseStyleLeaf } from "../css-declarations.js";
import type { DesignSystemView } from "../design-system.js";
import { createUniqueReporter, type Reporter } from "../report.js";

/**
 * Checks a declaration's transitions and animations.
 *
 * @param declaration - The declaration, or `undefined` when the style leaf's value is not
 *   statically known.
 * @param view - The project design system that resolves theme keyframes.
 * @returns The motion findings; none for `undefined`.
 */
function evaluateDeclarationMotion(
  declaration: Declaration | undefined,
  view: DesignSystemView,
): MotionFinding[] {
  return declaration
    ? [
        ...evaluateTransition(declaration),
        ...evaluateAnimation(declaration, view),
      ]
    : [];
}

/**
 * Reports the motion findings of every class group, style leaf and motion key in a file.
 *
 * @param report - The reporter to send diagnostics to.
 * @param model - The file's frontend model.
 * @param view - The project design system.
 */
function reportModelMotion(
  report: Reporter,
  model: FrontendModel,
  view: DesignSystemView,
): void {
  for (const group of model.classGroups) {
    for (const { token, declarations } of compileClassGroup(group, view)) {
      const findings = declarations.flatMap((declaration) =>
        evaluateDeclarationMotion(declaration, view),
      );
      reportMotionFindings(report, group.node, token, findings);
    }
  }
  for (const leaf of model.styleLeaves) {
    const findings = evaluateDeclarationMotion(parseStyleLeaf(leaf), view);
    reportMotionFindings(report, leaf.node, leaf.property, findings);
  }
  for (const key of model.motionKeys) {
    const findings = evaluateMotionKey(key.property);
    reportMotionFindings(report, key.node, key.property, findings);
  }
}

/**
 * Builds `animated-properties`: transitions and animations in classes, inline styles and motion
 * props may not animate all properties, layout properties or unverifiable properties.
 *
 * @param view - The project design system.
 * @returns The rule.
 */
export function createAnimatedPropertiesRule(
  view: DesignSystemView,
): Rule.RuleModule {
  return {
    meta: {
      type: "problem",
      docs: { description: "Animate paint properties only." },
      messages: MOTION_MESSAGES,
      schema: [],
    },
    create(context) {
      return {
        "Program:exit"() {
          const report = createUniqueReporter(context);
          const model = collectFrontendModel(context.sourceCode);
          reportModelMotion(report, model, view);
        },
      };
    },
  };
}
