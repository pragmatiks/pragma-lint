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

export const PRAGMATIKS_LINT_FILES = ["**/*.{ts,tsx,mts,cts,js,mjs,cjs}"];

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

export function semgrepRulesDirectory(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.join(findPackageRoot(here), "src", "semgrep-rules");
}

function recommendedOrThrow(
  plugin: { configs?: Record<string, unknown> },
  name: string,
): Config {
  const recommended = plugin.configs?.recommended;
  if (!recommended) {
    throw new Error(
      `${name} has no recommended flat-config preset. Peer dependency major mismatch.`,
    );
  }
  return recommended as Config;
}

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
    recommendedOrThrow(sonarjs, "eslint-plugin-sonarjs"),
    recommendedOrThrow(unicorn, "eslint-plugin-unicorn"),
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
