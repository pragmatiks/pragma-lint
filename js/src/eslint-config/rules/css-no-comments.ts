/**
 * The `css-no-comments` rule: stylesheets carry no comments but bare ESLint directives.
 *
 * @packageDocumentation
 */
import type { CSSRuleDefinition } from "@eslint/css";

import { isBareEslintDirective } from "./directives.js";

/**
 * The `css-no-comments` rule type.
 */
export type CssNoCommentsRule = CSSRuleDefinition<{
  RuleOptions: [];
  MessageIds: "comment";
}>;

/**
 * `css-no-comments`: flags every stylesheet comment except a bare ESLint directive.
 */
export const cssNoCommentsRule: CssNoCommentsRule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow stylesheet comments other than bare ESLint directives (principle 10).",
    },
    messages: {
      comment:
        "Principle 10: delete this comment, or move its rationale into the JSDoc of the component that sets the selector.",
    },
    schema: [],
  },
  create(context) {
    return {
      StyleSheet() {
        for (const comment of context.sourceCode.comments ?? []) {
          if (comment.loc && !isBareEslintDirective(comment.value)) {
            context.report({ loc: comment.loc, messageId: "comment" });
          }
        }
      },
    };
  },
};
