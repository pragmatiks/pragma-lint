/**
 * The `pragmatiks-comments` ESLint plugin, shared by the base and CSS configs.
 *
 * Note: flat config refuses two different objects under one plugin name, so every config
 * registers this one object, under a name distinct from the `/next` frontend plugin.
 *
 * @packageDocumentation
 */
import type { ESLint, Rule } from "eslint";

import { cssNoCommentsRule } from "./css-no-comments.js";
import { noCommentsRule } from "./no-comments.js";

/**
 * The plugin name the comment rules are registered under.
 */
export const COMMENTS_PLUGIN_NAME = "pragmatiks-comments";

/**
 * The plugin holding `no-comments` and `css-no-comments`.
 */
export const commentsPlugin: ESLint.Plugin = {
  meta: { name: "@pragmatiks/lint/comments" },
  rules: {
    "no-comments": noCommentsRule,
    "css-no-comments": cssNoCommentsRule as unknown as Rule.RuleModule,
  },
};
