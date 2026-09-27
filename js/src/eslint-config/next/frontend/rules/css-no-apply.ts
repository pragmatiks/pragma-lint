/**
 * The `css-no-apply` rule: stylesheets may not use `@apply`.
 *
 * @packageDocumentation
 */
import type { CSSRuleDefinition } from "@eslint/css";

/**
 * The `css-no-apply` rule type.
 */
type CssNoApplyRule = CSSRuleDefinition<{
  RuleOptions: [];
  MessageIds: "apply";
}>;

/**
 * `css-no-apply`: flags every `@apply` at-rule, whose class tokens no frontend rule can check.
 */
export const cssNoApplyRule: CssNoApplyRule = {
  meta: {
    type: "problem",
    docs: { description: "Disallow @apply." },
    messages: {
      apply:
        "Write the classes in markup or plain declarations here; @apply hides them from the lint rules.",
    },
    schema: [],
  },
  create(context) {
    return {
      Atrule(node) {
        if (node.name.toLowerCase() === "apply") {
          context.report({ node, messageId: "apply" });
        }
      },
    };
  },
};
