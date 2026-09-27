/**
 * The `css-parsed-fully` rule: every block and rule prelude must parse.
 *
 * @packageDocumentation
 */
import type { CSSRuleDefinition } from "@eslint/css";

/**
 * The `css-parsed-fully` rule type.
 */
type CssParsedFullyRule = CSSRuleDefinition<{
  RuleOptions: [];
  MessageIds: "unparsed" | "swallowed";
}>;

/**
 * `css-parsed-fully`: flags every raw child of a block (`unparsed`) and every rule prelude left raw
 * with a `:` or `;` in it (`swallowed`), which is how the tolerant parser swallows declarations
 * written before a nested rule inside an at-rule. No other rule checks what did not parse.
 */
export const cssParsedFullyRule: CssParsedFullyRule = {
  meta: {
    type: "problem",
    docs: { description: "Require blocks to parse fully." },
    messages: {
      unparsed:
        "This part of the block did not parse, so no rule checks it; rewrite it as plain declarations and nested rules, wrapping declarations that sit between nested rules in & { … } so they keep their order.",
      swallowed:
        "The declarations before this nested rule did not parse, so no rule checks them; wrap them in & { … } where they stand, or move @keyframes into an @theme block of their own.",
    },
    schema: [],
  },
  create(context) {
    return {
      Block(node) {
        for (const child of node.children) {
          if (child.type === "Raw") {
            context.report({ node: child, messageId: "unparsed" });
          }
        }
      },
      Rule(node) {
        if (node.prelude.type === "Raw" && /[:;]/.test(node.prelude.value)) {
          context.report({ node: node.prelude, messageId: "swallowed" });
        }
      },
    };
  },
};
