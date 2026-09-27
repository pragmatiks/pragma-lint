/**
 * Integration tests for how `pragmatiksNextConfig` composes with the Next presets, loads the
 * design system and fails fast.
 *
 * @packageDocumentation
 */
import { rmSync } from "node:fs";
import path from "node:path";

import { lexer } from "@eslint/css-tree";
import type { Linter } from "eslint";
import tseslint from "typescript-eslint";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import * as nextEntry from "../src/eslint-config/next/index.js";
import {
  type PragmatiksNextOptions,
  pragmatiksNextConfig,
} from "../src/eslint-config/next/index.js";
import { computeCssPropertyName } from "../src/eslint-config/next/frontend/collect.js";
import { LAYOUT_PROPERTIES } from "../src/eslint-config/next/frontend/concepts/motion.js";
import { loadDesignSystem } from "../src/eslint-config/next/frontend/design-system.js";
import * as rootEntry from "../src/index.js";
import { PRAGMATIKS_LINT_FILES } from "../src/index.js";
import {
  createNextEslint,
  createNextProject,
  lintFile,
  loadNextPresets,
  type ProjectOptions,
  writeFixture,
} from "./next-project.js";

const OPTIONS_STYLESHEET = "app/globals.css";
const ACCESSIBILITY_GLOB = ["**/*.{js,jsx,mjs,ts,tsx,mts,cts}"];

/**
 * Properties matching `LAYOUT_NAME_PATTERNS` that only repaint, so they are deliberately absent from
 * `LAYOUT_PROPERTIES`.
 */
const NON_LAYOUT_PROPERTIES: ReadonlySet<string> = new Set([
  "column-rule",
  "column-rule-color",
  "column-rule-style",
  "column-rule-width",
  "font-palette",
  "font-smooth",
  "outline-width",
  "stroke-width",
  "border-image-width",
  "mask-border-width",
]);

/**
 * Name patterns of properties that must appear in either `LAYOUT_PROPERTIES` or `NON_LAYOUT_PROPERTIES`.
 */
const LAYOUT_NAME_PATTERNS: readonly RegExp[] = [
  /^(?:min-|max-)?(?:width|height|block-size|inline-size)$/,
  /^inset/,
  /^(?:top|right|bottom|left)$/,
  /^margin/,
  /^padding/,
  /^border(?:-(?:top|right|bottom|left|block|inline|start|end|width))*$/,
  /gap$/,
  /^grid/,
  /^flex/,
  /^font/,
  /^column/,
  /^(?:line-height|letter-spacing|word-spacing|text-indent|tab-size|aspect-ratio)$/,
  /-(?:width|height)$/,
];

const KEY_MAPPINGS: readonly (readonly [string, string])[] = [
  ["zIndex", "z-index"],
  ["WebkitTransition", "-webkit-transition"],
  ["msTransform", "-ms-transform"],
  ["forcedColorAdjust", "forced-color-adjust"],
  ["--tw-ring-shadow", "--tw-ring-shadow"],
];

const IGNORED_PATHS: readonly (readonly [string, boolean])[] = [
  ["out/page.tsx", true],
  [".next/server/page.js", true],
  ["next-env.d.ts", true],
  ["app/page.tsx", false],
];

const temporaryRoots: string[] = [];

/**
 * Creates a fixture project that is removed after the file's tests.
 *
 * @param options - How the project differs from the default.
 * @returns The project root.
 */
function createTrackedProject(options?: ProjectOptions): string {
  const root = createNextProject(options);
  temporaryRoots.push(root);
  return root;
}

/**
 * Builds the `pragmatiksNextConfig` options for a fixture project.
 *
 * @param root - The project root.
 * @returns The options, pointing at the project's `app/globals.css`.
 */
function buildOptions(root: string): PragmatiksNextOptions {
  return { rootDir: root, tailwindStylesheet: OPTIONS_STYLESHEET };
}

afterAll(() => {
  for (const root of temporaryRoots) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("AC-3 layout list completeness", () => {
  const names = Object.keys(lexer.properties).filter(
    (name) => !name.startsWith("-"),
  );

  it("classifies every css-tree property whose name looks like layout", () => {
    const unclassified = names.filter(
      (name) =>
        LAYOUT_NAME_PATTERNS.some((pattern) => pattern.test(name)) &&
        !LAYOUT_PROPERTIES.has(name) &&
        !NON_LAYOUT_PROPERTIES.has(name),
    );
    expect(unclassified).toEqual([]);
  });

  it("lists only properties css-tree knows", () => {
    const unknown = [...LAYOUT_PROPERTIES, ...NON_LAYOUT_PROPERTIES].filter(
      (name) => !names.includes(name),
    );
    expect(unknown).toEqual([]);
  });
});

describe("design system loading", () => {
  it("passes the canary on a project stylesheet", async () => {
    const view = await loadDesignSystem(buildOptions(createTrackedProject()));
    expect(
      view.declarationsOf("z-60")?.map((declaration) => declaration.text),
    ).toContain("60");
    expect(view.isDefaultThemeVariable("--color-amber-500")).toBe(true);
    expect(view.isDefaultThemeVariable("--color-brand")).toBe(false);
  });

  it("fails the canary when unprefixed classes no longer compile", async () => {
    const root = createTrackedProject({
      stylesheet: '@import "tailwindcss" prefix(tw);\n',
    });
    await expect(loadDesignSystem(buildOptions(root))).rejects.toThrow(
      /canary/,
    );
  });

  it("fails on a Tailwind version mismatch", async () => {
    const root = createTrackedProject({ postcssVersion: "4.3.2" });
    await expect(loadDesignSystem(buildOptions(root))).rejects.toThrow(
      /one Tailwind version/,
    );
  });

  it("imports the next entry without loading @tailwindcss/node", async () => {
    vi.resetModules();
    vi.doMock("@tailwindcss/node", () => {
      throw new Error("@tailwindcss/node is not installed");
    });
    try {
      await expect(
        import("../src/eslint-config/next/index.js"),
      ).resolves.toHaveProperty("pragmatiksNextConfig");
    } finally {
      vi.doUnmock("@tailwindcss/node");
      vi.resetModules();
    }
  });

  it("names the missing Tailwind package and how to install it", async () => {
    const root = createTrackedProject();
    rmSync(path.join(root, "node_modules", "@tailwindcss", "postcss"), {
      recursive: true,
    });
    await expect(loadDesignSystem(buildOptions(root))).rejects.toThrow(
      /@tailwindcss\/postcss cannot be resolved from .+\. To fix it, install @tailwindcss\/postcss at ~4\.3\.3 in the app root\./,
    );
  });
});

describe("pragmatiksNextConfig composition", () => {
  let root: string;
  let config: Linter.Config[];

  beforeAll(async () => {
    root = createTrackedProject();
    config = await pragmatiksNextConfig(
      await loadNextPresets(),
      buildOptions(root),
    );
  }, 60_000);

  it("scopes Next objects without files to the jsx-a11y glob", () => {
    const vitals = config.find(
      (entry) => entry.name === "next/core-web-vitals",
    );
    expect(vitals?.files).toEqual(ACCESSIBILITY_GLOB);
  });

  it("keeps ignore-only objects global", () => {
    const ignores = config.find((entry) => entry.ignores?.includes("out/**"));
    expect(ignores).toEqual({
      ignores: [".next/**", "out/**", "build/**", "next-env.d.ts"],
    });
  });

  it("parses every JavaScript and TypeScript file with typescript-eslint", () => {
    const parserEntry = config.findLast(
      (entry) => entry.languageOptions?.parser !== undefined,
    );
    expect(parserEntry?.files).toEqual(PRAGMATIKS_LINT_FILES);
    expect(parserEntry?.languageOptions?.parser).toBe(tseslint.parser);
  });

  it("rejects presets without a jsx-a11y object", async () => {
    const allPresets = await loadNextPresets();
    const presets = allPresets.filter(
      (entry) => entry.plugins?.["jsx-a11y"] === undefined,
    );
    await expect(
      pragmatiksNextConfig(presets, buildOptions(root)),
    ).rejects.toThrow(/exactly one.+pass \[\.\.\.nextVitals, \.\.\.nextTs\]/);
  });

  it("rejects presets with two jsx-a11y objects", async () => {
    const [next, ...rest] = await loadNextPresets();
    await expect(
      pragmatiksNextConfig(
        [next!, { ...next!, name: "copy" }, ...rest],
        buildOptions(root),
      ),
    ).rejects.toThrow(/exactly one/);
  });
});

describe("pragmatiksNextConfig on files", () => {
  let root: string;

  beforeAll(() => {
    root = createTrackedProject();
  });

  it.each(IGNORED_PATHS)(
    "isPathIgnored(%s) is %s",
    async (relativePath, ignored) => {
      const eslint = await createNextEslint(root);
      expect(await eslint.isPathIgnored(path.join(root, relativePath))).toBe(
        ignored,
      );
    },
  );

  it.each(["components/Save.jsx", "scripts/seed.mjs"])(
    "parses %s without a fatal message",
    async (relativePath) => {
      const eslint = await createNextEslint(root);
      const fixture = writeFixture(
        root,
        relativePath,
        'export const Save = () => <button type="button">Save</button>;\n',
      );
      const messages = await lintFile(eslint, fixture);
      expect(messages.filter((message) => message.fatal)).toEqual([]);
    },
  );

  it("lints .cjs files with the base config", async () => {
    const eslint = await createNextEslint(root);
    const fixture = writeFixture(
      root,
      "scripts/build.cjs",
      `const db = 1;
module.exports = db;
`,
    );
    const messages = await lintFile(eslint, fixture);
    expect(messages.filter((message) => message.fatal)).toEqual([]);
    expect(
      messages.some(
        (message) => message.ruleId === "unicorn/prevent-abbreviations",
      ),
    ).toBe(true);
  });
});

describe("entry points and key mapping", () => {
  it("exports only pragmatiksNextConfig from /next", () => {
    expect(Object.keys(nextEntry)).toEqual(["pragmatiksNextConfig"]);
  });

  it("keeps pragmatiksConfig on the root entry", () => {
    expect(typeof rootEntry.pragmatiksConfig).toBe("function");
  });

  it.each(KEY_MAPPINGS)("maps style key %s to %s", (key, property) => {
    expect(computeCssPropertyName(key)).toBe(property);
  });
});
