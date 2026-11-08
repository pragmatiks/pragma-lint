/**
 * The `@pragmatiks/lint/eslint-config/css` entry: the flat config for stylesheets.
 *
 * @packageDocumentation
 */
import css from "@eslint/css";
import type { ESLint, Linter } from "eslint";

import { COMMENTS_PLUGIN_NAME, commentsPlugin } from "../rules/plugin.js";

/**
 * The files the stylesheet config applies to.
 */
export const PRAGMATIKS_CSS_FILES = ["**/*.css"];

/**
 * Builds the Pragmatiks flat config object for CSS files.
 *
 * Note: requires the optional peer `@eslint/css`.
 *
 * @returns The config object: `@eslint/css` parsing tolerantly, with `css-no-comments` on.
 */
export function pragmatiksCssConfig(): Linter.Config {
  return {
    name: "pragmatiks/css",
    files: PRAGMATIKS_CSS_FILES,
    plugins: {
      css: css as unknown as ESLint.Plugin,
      [COMMENTS_PLUGIN_NAME]: commentsPlugin,
    },
    language: "css/css",
    languageOptions: { tolerant: true },
    rules: { [`${COMMENTS_PLUGIN_NAME}/css-no-comments`]: "error" },
  };
}

export default pragmatiksCssConfig;
