/**
 * The `no-comments` rule: JavaScript and TypeScript files carry no comments but JSDoc and bare
 * tool directives.
 *
 * @packageDocumentation
 */
import type { AST, Rule, SourceCode } from "eslint";

import { isBareScriptDirective } from "./directives.js";

/**
 * Tells whether a comment is one principle 10 keeps.
 *
 * @param comment - The comment to classify.
 * @param sourceCode - The source the comment belongs to.
 * @returns `true` for a JSDoc block, a line-1 shebang or a bare tool directive.
 */
function isPermittedComment(
  comment: AST.Program["comments"][number],
  sourceCode: SourceCode,
): boolean {
  const isJsdoc = comment.type === "Block" && comment.value.startsWith("*");
  const isShebang =
    comment.range?.[0] === 0 && sourceCode.text.startsWith("#!");
  return (
    isJsdoc ||
    isShebang ||
    isBareScriptDirective(comment.value, comment.type === "Line")
  );
}

/**
 * `no-comments`: flags every comment except a JSDoc block (`/** ... *\/`), a line-1 shebang and a
 * bare tool directive (`eslint-disable`, `eslint-enable`, `eslint`, `global`,
 * `globals`, `exported`, `@ts-expect-error`, `/// <reference ... />`).
 */
export const noCommentsRule: Rule.RuleModule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow comments other than JSDoc and bare tool directives (principle 10).",
    },
    messages: {
      comment:
        "Principle 10: delete this comment, or move its rationale into the owning JSDoc. Tool directives stay bare, with no `-- description`.",
    },
    schema: [],
  },
  create(context) {
    const { sourceCode } = context;
    return {
      Program() {
        for (const comment of sourceCode.getAllComments()) {
          if (comment.loc && !isPermittedComment(comment, sourceCode)) {
            context.report({ loc: comment.loc, messageId: "comment" });
          }
        }
      },
    };
  },
};
