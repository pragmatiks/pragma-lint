/**
 * Reports diagnostics for nodes from the frontend model.
 *
 * @packageDocumentation
 */
import type { Rule } from "eslint";

import { type AstNode, toRuleNode } from "./ast.js";

/**
 * One diagnostic for a node from the frontend model.
 */
export interface FrontendReport {
  /** The node to report at. */
  readonly node: AstNode;
  /** The rule's message ID. */
  readonly messageId: string;
  /** The message placeholder values. */
  readonly data?: Readonly<Record<string, string>>;
}

/**
 * Reports one diagnostic.
 */
export type Reporter = (report: FrontendReport) => void;

/**
 * Builds a reporter that reports each node, message and data combination once per rule run, so a
 * style key with several model entries (one per branch of a conditional value) yields one
 * diagnostic.
 *
 * @param context - The rule context to report to.
 * @returns A function that reports a diagnostic unless the same one was already reported.
 */
export function createUniqueReporter(context: Rule.RuleContext): Reporter {
  const reported = new Map<AstNode, Set<string>>();
  return ({ node, messageId, data }) => {
    const key = JSON.stringify([messageId, data ?? {}]);
    const keys = reported.get(node) ?? new Set<string>();
    if (keys.has(key)) {
      return;
    }
    keys.add(key);
    reported.set(node, keys);
    context.report({ node: toRuleNode(node), messageId, data });
  };
}
