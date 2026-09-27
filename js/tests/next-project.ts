/**
 * Builds throwaway Next.js projects and lints fixtures in them with the full
 * `pragmatiksNextConfig`.
 *
 * @packageDocumentation
 */
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { createRequire, registerHooks } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { ESLint, type Linter } from "eslint";
import { afterAll, beforeAll, expect } from "vitest";

import { pragmatiksNextConfig } from "../src/eslint-config/next/index.js";

/**
 * What a fixture project differs in from the default.
 */
export interface ProjectOptions {
  /** The version the fake `@tailwindcss/postcss` package reports; defaults to `TAILWIND_VERSION`. */
  readonly postcssVersion?: string;
  /** The content of `app/globals.css`; defaults to `STYLESHEET`. */
  readonly stylesheet?: string;
}

/**
 * Case rows that all check one rule.
 */
export interface RuleCaseTable<Case> {
  /** The full rule ID, such as `pragmatiks/z-index`, or `ANY_PRAGMATIKS_RULE`. */
  readonly rule: string;
  /** The rows. */
  readonly cases: readonly Case[];
}

/**
 * Lints fixtures inside one fixture project.
 */
export interface NextFixtureLinter {
  /**
   * Writes code to a fixture file, lints it, asserts it has no fatal message, and counts the
   * messages of one rule.
   *
   * @param code - The fixture source.
   * @param rule - A full rule ID, or `ANY_PRAGMATIKS_RULE` to count every `pragmatiks/` rule.
   * @param file - The fixture path relative to the project root; defaults to a fresh numbered file
   *   under `app/` with the linter's extension.
   * @returns The number of matching messages.
   */
  readonly countRuleMessages: (
    code: string,
    rule: string,
    file?: string,
  ) => Promise<number>;
}

/**
 * Rule selector that matches every rule of the `pragmatiks` plugin.
 */
export const ANY_PRAGMATIKS_RULE = "any pragmatiks rule";

/**
 * The Tailwind version every fixture project installs.
 */
export const TAILWIND_VERSION = "4.3.3";

/**
 * The minimal P1 focus class string.
 */
export const P1 = "focus-visible:outline-hidden focus-visible:ring-2";

/**
 * The default fixture stylesheet: project colors, a theme animation with layout keyframes, a
 * z-index token above the cap, inline theme colors, one of which aliases a palette color, and a
 * functional utility that pairs a theme color with a palette color.
 */
export const STYLESHEET = `@import "tailwindcss";

@theme {
  --color-black: oklch(0.2 0 0);
  --color-white: oklch(0.99 0 0);
  --color-brand: oklch(0.6 0.1 20);
  --animate-grow: grow 1s ease-out;
  --z-index-top: 99;

  @keyframes grow {
    to {
      width: 10rem;
    }
  }
}

@theme inline {
  --color-focus: oklch(0.5 0.2 200);
  --color-danger: var(--color-red-500);
}

@utility tone-* {
  background-color: --value(--color-*);
  color: var(--color-blue-500);
}
`;

const require = createRequire(import.meta.url);

const NEXT_BABEL_PARSER = "next/dist/compiled/babel/eslint-parser";

registerNextParserStub();

/**
 * Finds the root directory of a package as resolved from a file.
 *
 * @param fromFile - The file to resolve from.
 * @param name - The package name.
 * @returns The nearest ancestor of the resolved entry named after the package's last path segment.
 * @throws Error When no ancestor of the resolved entry has that name.
 */
function packageDirectory(fromFile: string, name: string): string {
  const directoryName = name.split("/").at(-1);
  let directory = path.dirname(createRequire(fromFile).resolve(name));
  while (path.basename(directory) !== directoryName) {
    const parent = path.dirname(directory);
    if (parent === directory) {
      throw new Error(
        `No directory named ${String(directoryName)} holds ${name}`,
      );
    }
    directory = parent;
  }
  return directory;
}

/**
 * Writes a value as pretty-printed JSON.
 *
 * @param file - The file to write.
 * @param value - The value to serialize.
 */
function writeJson(file: string, value: unknown): void {
  writeFileSync(file, `${JSON.stringify(value, undefined, 2)}\n`);
}

/**
 * Resolves Next's compiled Babel parser, which ships without its dependencies, to the
 * typescript-eslint parser.
 */
function registerNextParserStub(): void {
  const typescriptParser = require.resolve("@typescript-eslint/parser", {
    paths: [require.resolve("typescript-eslint")],
  });
  registerHooks({
    resolve(specifier, context, nextResolve) {
      return specifier === NEXT_BABEL_PARSER
        ? {
            url: pathToFileURL(typescriptParser).href,
            format: "commonjs",
            shortCircuit: true,
          }
        : nextResolve(specifier, context);
    },
  });
}

/**
 * Tells whether a lint message comes from a rule.
 *
 * @param message - A lint message.
 * @param rule - A full rule ID, or `ANY_PRAGMATIKS_RULE`.
 * @returns `true` when the message's rule matches.
 */
function matchesRule(message: Linter.LintMessage, rule: string): boolean {
  return rule === ANY_PRAGMATIKS_RULE
    ? (message.ruleId ?? "").startsWith("pragmatiks/")
    : message.ruleId === rule;
}

/**
 * Creates a fixture Next.js project in a temporary directory, with Tailwind linked from this
 * package's dependencies and `app/globals.css` as its stylesheet.
 *
 * @param options - How the project differs from the default.
 * @returns The project root; the caller removes it.
 */
export function createNextProject(options: ProjectOptions = {}): string {
  const root = mkdtempSync(path.join(tmpdir(), "pragmatiks-next-"));
  const modules = path.join(root, "node_modules");
  mkdirSync(path.join(modules, "@tailwindcss", "postcss"), { recursive: true });
  mkdirSync(path.join(root, "app"));
  const tailwindNode = require.resolve("@tailwindcss/node");
  symlinkSync(
    packageDirectory(tailwindNode, "tailwindcss"),
    path.join(modules, "tailwindcss"),
    "dir",
  );
  writeJson(path.join(modules, "@tailwindcss", "postcss", "package.json"), {
    name: "@tailwindcss/postcss",
    version: options.postcssVersion ?? TAILWIND_VERSION,
    main: "index.js",
  });
  writeFileSync(
    path.join(modules, "@tailwindcss", "postcss", "index.js"),
    "module.exports = {};\n",
  );
  writeJson(path.join(root, "package.json"), {
    name: "fixture-app",
    private: true,
    type: "module",
  });
  writeJson(path.join(root, "tsconfig.json"), {
    compilerOptions: {
      target: "ES2022",
      module: "ESNext",
      moduleResolution: "Bundler",
      jsx: "preserve",
      strict: true,
    },
    include: ["**/*.ts", "**/*.tsx"],
  });
  writeFileSync(
    path.join(root, "app", "globals.css"),
    options.stylesheet ?? STYLESHEET,
  );
  return root;
}

/**
 * Loads the `eslint-config-next` core-web-vitals and typescript presets.
 *
 * @returns The preset objects, in that order.
 */
export async function loadNextPresets(): Promise<Linter.Config[]> {
  const [{ default: vitals }, { default: typescript }] = await Promise.all([
    import("eslint-config-next/core-web-vitals"),
    import("eslint-config-next/typescript"),
  ]);
  return [...vitals, ...typescript] as Linter.Config[];
}

/**
 * Builds an ESLint instance for a fixture project with the Next presets and
 * `pragmatiksNextConfig`.
 *
 * @param root - The fixture project root.
 * @returns The ESLint instance, rooted at the project.
 */
export async function createNextEslint(root: string): Promise<ESLint> {
  const config = await pragmatiksNextConfig(await loadNextPresets(), {
    rootDir: root,
    tailwindStylesheet: "app/globals.css",
  });
  return new ESLint({
    cwd: root,
    overrideConfigFile: true,
    overrideConfig: config,
  });
}

/**
 * Writes a fixture file into a project, creating its directory.
 *
 * @param root - The project root.
 * @param relativePath - The fixture path relative to the root.
 * @param code - The fixture source.
 * @returns The absolute path of the written file.
 */
export function writeFixture(
  root: string,
  relativePath: string,
  code: string,
): string {
  const file = path.join(root, relativePath);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, code);
  return file;
}

/**
 * Lints one file.
 *
 * @param eslint - The ESLint instance of the file's project.
 * @param file - The absolute path of the file.
 * @returns The lint messages of the file.
 */
export async function lintFile(
  eslint: ESLint,
  file: string,
): Promise<Linter.LintMessage[]> {
  const [result] = await eslint.lintFiles([file]);
  return result?.messages ?? [];
}

/**
 * Flattens case tables into rows that carry their rule.
 *
 * @param caseTables - The tables to flatten.
 * @returns Every row with its table's rule, in table order.
 */
export function flattenCaseTables<Case>(
  caseTables: readonly RuleCaseTable<Case>[],
): (Case & { readonly rule: string })[] {
  return caseTables.flatMap(({ rule, cases }) =>
    cases.map((row) => ({ ...row, rule })),
  );
}

/**
 * Registers hooks that create a fixture project before the file's tests and remove it after.
 *
 * @param extension - The extension of numbered fixture files, such as `tsx` or `css`.
 * @returns A linter for the project; use it only inside tests.
 */
export function registerNextFixtureLinter(
  extension: string,
): NextFixtureLinter {
  let root = "";
  let eslint: ESLint | undefined;
  let fixtureIndex = 0;
  beforeAll(async () => {
    root = createNextProject();
    eslint = await createNextEslint(root);
  }, 60_000);
  afterAll(() => {
    rmSync(root, { recursive: true, force: true });
  });
  return {
    async countRuleMessages(code, rule, file) {
      fixtureIndex += 1;
      const fixture = writeFixture(
        root,
        file ?? `app/fixture-${String(fixtureIndex)}.${extension}`,
        code,
      );
      const messages = await lintFile(eslint!, fixture);
      expect(messages.filter((message) => message.fatal)).toEqual([]);
      return messages.filter((message) => matchesRule(message, rule)).length;
    },
  };
}
