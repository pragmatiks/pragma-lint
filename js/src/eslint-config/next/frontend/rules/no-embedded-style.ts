/**
 * The `no-embedded-style` rule: JSX may not embed `<style>` elements.
 *
 * @packageDocumentation
 */
import type { Rule } from "eslint";

import { jsxElementName, toAstNode } from "../ast.js";

/**
 * `no-embedded-style`: flags every JSX `<style>` element, whose CSS the CSS rules cannot check.
 */
export const noEmbeddedStyleRule: Rule.RuleModule = {
  meta: {
    type: "problem",
    docs: { description: "Disallow JSX <style> elements." },
    messages: {
      embedded:
        "Move this CSS into a project stylesheet, where the CSS rules check it.",
    },
    schema: [],
  },
  create(context) {
    return {
      JSXOpeningElement(node: Rule.Node) {
        if (jsxElementName(toAstNode(node)) === "style") {
          context.report({ node, messageId: "embedded" });
        }
      },
    };
  },
};
