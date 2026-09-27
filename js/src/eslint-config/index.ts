import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { type Config, defineConfig, globalIgnores } from "eslint/config";
import sonarjs from "eslint-plugin-sonarjs";
import unicorn from "eslint-plugin-unicorn";
import tseslint from "typescript-eslint";

import {
  COMPLEXITY_OPTS,
  MAX_DEPTH_OPTS,
  MAX_LINES_PER_FUNCTION_OPTS,
  MAX_PARAMS_OPTS,
  MAX_STATEMENTS_OPTS,
  PREVENT_ABBREVIATIONS_OPTS,
} from "./options.js";

/**
 * The files every Pragmatiks config object applies to: JavaScript and TypeScript, JSX included.
 */
export const PRAGMATIKS_LINT_FILES = ["**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}"];

/**
 * Finds the nearest directory at or above `start` that contains a `package.json`.
 *
 * @param start - The directory to start from.
 * @returns The first directory, walking up, that contains a `package.json`.
 * @throws Error when no directory up to the filesystem root contains one.
 */
export function findPackageRoot(start: string): string {
  let current = start;
  for (;;) {
    if (existsSync(path.join(current, "package.json"))) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) {
      throw new Error(`package.json not found above ${start}`);
    }
    current = parent;
  }
}

/**
 * Locates the Semgrep rules shipped with this package.
 *
 * @returns The absolute path of the package's `src/semgrep-rules` directory.
 * @throws Error when the package root cannot be found above this module.
 */
export function semgrepRulesDirectory(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.join(findPackageRoot(here), "src", "semgrep-rules");
}

/**
 * Reads a plugin's recommended flat config and scopes it to `PRAGMATIKS_LINT_FILES`.
 *
 * @param plugin - An ESLint plugin that ships flat configs.
 * @param peer - The plugin's package name and the peer range this package supports, used in the
 *   error message.
 * @returns The recommended config with its `files` replaced by `PRAGMATIKS_LINT_FILES`, so it never
 *   applies to CSS or other languages composed alongside it.
 * @throws Error when the plugin has no `recommended` flat config, which means an unsupported major.
 */
function recommendedOrThrow(
  plugin: { configs?: Record<string, unknown> },
  peer: { name: string; range: string },
): Config {
  const recommended = plugin.configs?.recommended;
  if (!recommended) {
    throw new Error(
      `@pragmatiks/lint: ${peer.name} has no recommended flat-config preset (peer dependency major mismatch). To fix it, install ${peer.name} ${peer.range}.`,
    );
  }
  return { ...(recommended as Config), files: PRAGMATIKS_LINT_FILES };
}

/**
 * Builds the Pragmatiks base flat config for JavaScript and TypeScript files.
 *
 * Every object except the global ignores, the sonarjs and unicorn recommended presets included,
 * applies only to `PRAGMATIKS_LINT_FILES`, so the config composes with configs for other
 * languages such as CSS.
 *
 * @returns The flat config: the typescript-eslint parser, the sonarjs and unicorn recommended
 *   presets, the Pragmatiks size and naming rules, and global ignores for build output.
 * @throws Error when the package root cannot be found, or when sonarjs or unicorn has no
 *   recommended flat config.
 */
export function pragmatiksConfig() {
  return defineConfig([
    {
      files: PRAGMATIKS_LINT_FILES,
      languageOptions: {
        parser: tseslint.parser,
        parserOptions: {
          ecmaVersion: "latest",
          sourceType: "module",
        },
      },
      settings: {
        pragmatiksLint: {
          semgrepRulesDirectory: semgrepRulesDirectory(),
        },
      },
    },
    recommendedOrThrow(sonarjs, {
      name: "eslint-plugin-sonarjs",
      range: "^4.0.0",
    }),
    recommendedOrThrow(unicorn, {
      name: "eslint-plugin-unicorn",
      range: "^64.0.0",
    }),
    {
      files: PRAGMATIKS_LINT_FILES,
      rules: {
        complexity: ["error", COMPLEXITY_OPTS],
        "max-lines-per-function": ["error", MAX_LINES_PER_FUNCTION_OPTS],
        "max-statements": ["error", MAX_STATEMENTS_OPTS],
        "max-depth": ["error", MAX_DEPTH_OPTS],
        "max-params": ["error", MAX_PARAMS_OPTS],
        "unicorn/prevent-abbreviations": ["error", PREVENT_ABBREVIATIONS_OPTS],
      },
    },
    globalIgnores(["dist/**", "node_modules/**", ".next/**", ".turbo/**"]),
  ]);
}

export default pragmatiksConfig;
