/**
 * Builds rules that flag class tokens and inline styles whose declarations match a predicate.
 *
 * @packageDocumentation
 */
import type { Rule } from "eslint";

import { compileClassGroup } from "./class-group-declarations.js";
import {
  type ClassGroup,
  collectFrontendModel,
  type StyleLeaf,
} from "./collect.js";
import { type Declaration, parseStyleLeaf } from "./css-declarations.js";
import type { DesignSystemView } from "./design-system.js";
import { createUniqueReporter, type Reporter } from "./report.js";

/**
 * What a declaration rule flags and how it reports it.
 */
export interface DeclarationRuleOptions {
  /** The rule description shown in ESLint metadata. */
  readonly description: string;
  /** The single message ID the rule reports. */
  readonly messageId: string;
  /** The report message, with a `source` placeholder for the offending token or declaration. */
  readonly message: string;
  /** Tells whether a declaration breaks the rule. */
  readonly matches: (declaration: Declaration) => boolean;
}

/**
 * Reports each token of a class group that compiles to a matching declaration.
 *
 * @param report - The reporter to send diagnostics to.
 * @param group - One class group.
 * @param view - The project design system.
 * @param options - The rule's predicate and message ID.
 */
function checkClassGroup(
  report: Reporter,
  group: ClassGroup,
  view: DesignSystemView,
  options: DeclarationRuleOptions,
): void {
  for (const { token, declarations } of compileClassGroup(group, view)) {
    if (declarations.some((declaration) => options.matches(declaration))) {
      report({
        node: group.node,
        messageId: options.messageId,
        data: { source: token },
      });
    }
  }
}

/**
 * Reports an inline style leaf whose declaration matches.
 *
 * @param report - The reporter to send diagnostics to.
 * @param leaf - One inline style leaf.
 * @param options - The rule's predicate and message ID.
 */
function checkStyleLeaf(
  report: Reporter,
  leaf: StyleLeaf,
  options: DeclarationRuleOptions,
): void {
  const declaration = parseStyleLeaf(leaf);
  if (declaration && options.matches(declaration)) {
    report({
      node: leaf.node,
      messageId: options.messageId,
      data: { source: declaration.text },
    });
  }
}

/**
 * Builds a rule that flags every class token and inline style leaf whose declaration matches.
 *
 * A token is reported with its own text as `source`; a style leaf with its declaration text.
 *
 * @param view - The project design system.
 * @param options - The predicate, message and metadata of the rule.
 * @returns The rule.
 */
export function createDeclarationRule(
  view: DesignSystemView,
  options: DeclarationRuleOptions,
): Rule.RuleModule {
  return {
    meta: {
      type: "problem",
      docs: { description: options.description },
      messages: { [options.messageId]: options.message },
      schema: [],
    },
    create(context) {
      return {
        "Program:exit"() {
          const report = createUniqueReporter(context);
          const model = collectFrontendModel(context.sourceCode);
          for (const group of model.classGroups) {
            checkClassGroup(report, group, view, options);
          }
          for (const leaf of model.styleLeaves) {
            checkStyleLeaf(report, leaf, options);
          }
        },
      };
    },
  };
}
