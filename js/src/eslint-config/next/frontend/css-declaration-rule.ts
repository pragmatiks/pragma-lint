/**
 * Builds rules that flag project stylesheet declarations matching a predicate.
 *
 * @packageDocumentation
 */
import type { CSSRuleDefinition } from "@eslint/css";

import {
  collectStylesheetDeclarations,
  type Declaration,
} from "./css-declarations.js";

/**
 * What a stylesheet declaration rule flags and how it reports it.
 */
export interface CssDeclarationRuleOptions {
  /** The rule description shown in ESLint metadata. */
  readonly description: string;
  /** The single message ID the rule reports. */
  readonly messageId: string;
  /** The report message, with a `source` placeholder. */
  readonly message: string;
  /** Tells whether a declaration breaks the rule. */
  readonly matches: (declaration: Declaration) => boolean;
  /** Builds the `source` placeholder value for a reported declaration. */
  readonly describe: (declaration: Declaration) => string;
}

/**
 * Builds a rule that flags every stylesheet declaration that matches, at the declaration or, when
 * the declaration has no node, at the stylesheet.
 *
 * @param options - The predicate, message and metadata of the rule.
 * @returns The rule.
 */
export function createCssDeclarationRule(
  options: CssDeclarationRuleOptions,
): CSSRuleDefinition<{ RuleOptions: []; MessageIds: string }> {
  return {
    meta: {
      type: "problem",
      docs: { description: options.description },
      messages: { [options.messageId]: options.message },
      schema: [],
    },
    create(context) {
      return {
        StyleSheet(node) {
          for (const declaration of collectStylesheetDeclarations(node)) {
            if (options.matches(declaration)) {
              context.report({
                node: declaration.node ?? node,
                messageId: options.messageId,
                data: { source: options.describe(declaration) },
              });
            }
          }
        },
      };
    },
  };
}
