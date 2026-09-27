import { defineConfig, globalIgnores } from "eslint/config";
import sonarjs from "eslint-plugin-sonarjs";
import unicorn from "eslint-plugin-unicorn";
import tseslint from "typescript-eslint";

const COMPLEXITY_OPTS = 10;
const MAX_LINES_PER_FUNCTION_OPTS = {
  max: 50,
  skipBlankLines: true,
  skipComments: true,
};
const MAX_STATEMENTS_OPTS = 15;
const MAX_DEPTH_OPTS = 4;
const MAX_PARAMS_OPTS = 4;
const PREVENT_ABBREVIATIONS_OPTS = {
  allowList: {
    id: true,
    url: true,
    uri: true,
    api: true,
    cli: true,
    sdk: true,
    os: true,
    io: true,
    ip: true,
    tls: true,
    ssl: true,
    jwt: true,
    json: true,
    yaml: true,
    html: true,
    css: true,
    dom: true,
    ast: true,
    gpu: true,
    cpu: true,
    ram: true,
    vm: true,
    props: true,
    ref: true,
    e: true,
  },
};

const LINT_FILES = ["**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}"];

export default defineConfig([
  {
    files: LINT_FILES,
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
    },
  },
  { ...sonarjs.configs.recommended, files: LINT_FILES },
  { ...unicorn.configs.recommended, files: LINT_FILES },
  {
    files: LINT_FILES,
    rules: {
      complexity: ["error", COMPLEXITY_OPTS],
      "max-lines-per-function": ["error", MAX_LINES_PER_FUNCTION_OPTS],
      "max-statements": ["error", MAX_STATEMENTS_OPTS],
      "max-depth": ["error", MAX_DEPTH_OPTS],
      "max-params": ["error", MAX_PARAMS_OPTS],
      "unicorn/prevent-abbreviations": ["error", PREVENT_ABBREVIATIONS_OPTS],
    },
  },
  globalIgnores([
    "dist/**",
    "node_modules/**",
    "tests/fixtures/**",
    "src/semgrep-rules/**",
  ]),
]);
