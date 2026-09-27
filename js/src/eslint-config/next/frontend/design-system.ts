/**
 * Loads the project's Tailwind design system and exposes the read-only view the frontend rules
 * use.
 *
 * @packageDocumentation
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  type Declaration,
  parseStylesheetDeclarations,
} from "./css-declarations.js";

/**
 * One parse of a Tailwind class token, reduced to the fields the frontend rules read.
 *
 * Tailwind can parse one token several ways (`outline-hidden` is both a static utility and
 * `outline` with the value `hidden`), so `DesignSystemView.candidatesOf` returns one entry per parse.
 */
export interface ClassCandidate {
  /** The utility root, such as `ring` in `ring-2`, or the property of an arbitrary property. */
  readonly utility: string;
  /** Whether the token is an arbitrary property such as `[--tw-shadow:none]`. */
  readonly arbitraryProperty: boolean;
  /** The printed variants, such as `focus-visible`, outermost first. */
  readonly variants: readonly string[];
  /** Whether the token carries `!`. */
  readonly important: boolean;
  /** Whether the value is a theme name, an arbitrary `[...]` value, or absent. */
  readonly valueKind: "named" | "arbitrary" | "none";
  /** The value text, or `undefined` when there is none. */
  readonly value: string | undefined;
  /** Whether the `/modifier` is a theme name, an arbitrary `[...]` value, or absent. */
  readonly modifierKind: "named" | "arbitrary" | "none";
  /** The authored text of the arbitrary value and arbitrary modifier, in that order. */
  readonly arbitraryInputs: readonly string[];
}

/**
 * Read-only view of the project's Tailwind design system, injected into every frontend rule.
 */
export interface DesignSystemView {
  /**
   * Compiles one class token with the project's stylesheet.
   *
   * @param token - A single class token, variants included.
   * @returns The compiled declarations, or `undefined` when the token is not a class.
   */
  declarationsOf(token: string): readonly Declaration[] | undefined;

  /**
   * Parses one class token.
   *
   * @param token - A single class token, variants included.
   * @returns One entry per way Tailwind parses the token; empty when it is not a class.
   */
  candidatesOf(token: string): readonly ClassCandidate[];

  /**
   * Looks up a keyframes block defined in the project theme.
   *
   * @param name - The keyframes name.
   * @returns The properties the keyframes animate, or `undefined` when the theme does not define it.
   */
  keyframeProperties(name: string): readonly string[] | undefined;

  /**
   * Tells whether a theme variable comes from Tailwind's default theme rather than the project.
   *
   * @param variableName - A custom property name such as `--color-amber-500`.
   * @returns `true` when Tailwind's default theme defines the variable and the project does not
   *   override it; `false` for project-defined or unknown variables.
   */
  isDefaultThemeVariable(variableName: string): boolean;

  /**
   * Resolves a theme variable to its value.
   *
   * @param variableName - A custom property name such as `--animate-spin`.
   * @returns The theme value, or `undefined` when the theme does not define it.
   */
  themeValue(variableName: string): string | undefined;
}

/**
 * Where the project's Tailwind entry stylesheet lives.
 */
export interface DesignSystemSource {
  /** Absolute path of the project root. */
  readonly rootDir: string;
  /** Path of the Tailwind entry stylesheet relative to `rootDir`. */
  readonly tailwindStylesheet: string;
}

/**
 * A variant as Tailwind's parser returns it.
 */
interface TailwindVariant {
  readonly kind: string;
}

/**
 * One parse of a class token as Tailwind's parser returns it.
 */
interface TailwindCandidate {
  readonly kind: "static" | "functional" | "arbitrary";
  readonly root?: string;
  readonly property?: string;
  readonly value?: unknown;
  readonly modifier?: {
    readonly kind: "named" | "arbitrary";
    readonly value: string;
  } | null;
  readonly variants: readonly TailwindVariant[];
  readonly important: boolean;
}

/**
 * A node of Tailwind's CSS AST, such as a keyframes block or a declaration.
 */
interface TailwindAstNode {
  readonly kind: string;
  readonly name?: string;
  readonly params?: string;
  readonly property?: string;
  readonly nodes?: readonly TailwindAstNode[];
}

/**
 * The part of Tailwind's unstable design system API this module uses.
 */
interface TailwindDesignSystem {
  readonly theme: {
    getOptions(variableName: string): number;
    getKeyframes(): readonly TailwindAstNode[];
  };
  parseCandidate(token: string): readonly TailwindCandidate[];
  printVariant(variant: TailwindVariant): string;
  candidatesToCss(tokens: string[]): (string | null)[];
  resolveThemeValue(variableName: string): string | undefined;
}

/**
 * The fields of a `package.json` this module reads.
 */
interface PackageManifest {
  readonly name?: string;
  readonly version?: string;
}

const DEFAULT_THEME_OPTION = 4;
const CACHE_LIMIT = 10_000;
const SUPPORTED_TAILWIND_RANGE = "~4.3.3";
const VERSION_RECOVERY = `pin tailwindcss, @tailwindcss/postcss and @tailwindcss/node to the same ${SUPPORTED_TAILWIND_RANGE} version`;

const CANARY_EXPECTATIONS: readonly {
  token: string;
  property: string;
  value: string;
}[] = [
  { token: "z-60", property: "z-index", value: "60" },
  { token: "h-screen", property: "height", value: "100vh" },
  { token: "transition-all", property: "transition-property", value: "all" },
  { token: "bg-[#fff]", property: "background-color", value: "#fff" },
  {
    token: "focus-visible:outline-hidden",
    property: "outline-style",
    value: "none",
  },
];

/**
 * Reads the `package.json` in a directory.
 *
 * @param directory - The directory to read from.
 * @returns The manifest, or `undefined` when it is missing or not JSON.
 */
function loadManifest(directory: string): PackageManifest | undefined {
  try {
    return JSON.parse(
      readFileSync(path.join(directory, "package.json"), "utf8"),
    ) as PackageManifest;
  } catch {
    return undefined;
  }
}

/**
 * Finds the manifest of a named package at or above a directory.
 *
 * @param start - The directory to start from, such as the directory of the package's entry file.
 * @param name - The package name.
 * @returns The first manifest, walking up, whose `name` is `name`.
 * @throws Error when no directory up to the filesystem root holds that package's manifest.
 */
function findPackageManifest(start: string, name: string): PackageManifest {
  let current = start;
  for (;;) {
    const manifest = loadManifest(current);
    if (manifest?.name === name) {
      return manifest;
    }
    const parent = path.dirname(current);
    if (parent === current) {
      throw new Error(
        `@pragmatiks/lint: no package.json of ${name} above ${start}. To fix it, reinstall ${name}.`,
      );
    }
    current = parent;
  }
}

/**
 * Resolves the entry file of a package as seen from a file.
 *
 * @param fromFile - The file the package is resolved from.
 * @param name - The package name.
 * @returns The absolute path of the package's entry file.
 * @throws Error when the package is not installed where `fromFile` can resolve it.
 */
function resolvePackageEntry(fromFile: string, name: string): string {
  try {
    return createRequire(fromFile).resolve(name);
  } catch {
    throw new Error(
      `@pragmatiks/lint: ${name} cannot be resolved from ${path.dirname(fromFile)}. To fix it, install ${name} at ${SUPPORTED_TAILWIND_RANGE} in the app root.`,
    );
  }
}

/**
 * Reads the installed version of a package as resolved from a file.
 *
 * @param fromFile - The file the package is resolved from.
 * @param name - The package name.
 * @returns The version in the package's `package.json`.
 * @throws Error when the package cannot be resolved, its `package.json` cannot be found, or it has
 *   no version.
 */
function readPackageVersion(fromFile: string, name: string): string {
  const entry = resolvePackageEntry(fromFile, name);
  const version = findPackageManifest(path.dirname(entry), name).version;
  if (!version) {
    throw new Error(
      `@pragmatiks/lint: the package.json of ${name} has no version. To fix it, reinstall ${name}.`,
    );
  }
  return version;
}

/**
 * Reduces a Tailwind parse's value to its kind and text.
 *
 * @param candidate - One Tailwind parse.
 * @returns The value kind and text.
 */
function buildCandidateValue(
  candidate: TailwindCandidate,
): Pick<ClassCandidate, "valueKind" | "value"> {
  const value = candidate.value as
    | { kind?: string; value?: string }
    | string
    | null
    | undefined;
  if (typeof value === "string") {
    return { valueKind: "arbitrary", value };
  }
  if (!value?.kind) {
    return { valueKind: "none", value: undefined };
  }
  return {
    valueKind: value.kind === "arbitrary" ? "arbitrary" : "named",
    value: value.value,
  };
}

/**
 * Lists the authored arbitrary value and arbitrary modifier of a parse.
 *
 * @param candidate - One Tailwind parse.
 * @param value - Its reduced value.
 * @returns The arbitrary value text, then the arbitrary modifier text, where present.
 */
function buildArbitraryInputs(
  candidate: TailwindCandidate,
  value: Pick<ClassCandidate, "valueKind" | "value">,
): string[] {
  const inputs: string[] = [];
  if (value.valueKind === "arbitrary" && value.value !== undefined) {
    inputs.push(value.value);
  }
  if (candidate.modifier?.kind === "arbitrary") {
    inputs.push(candidate.modifier.value);
  }
  return inputs;
}

/**
 * Reduces a Tailwind parse to a class candidate.
 *
 * @param designSystem - The design system, which prints variants.
 * @param candidate - One Tailwind parse.
 * @returns The class candidate.
 */
function buildClassCandidate(
  designSystem: TailwindDesignSystem,
  candidate: TailwindCandidate,
): ClassCandidate {
  const value = buildCandidateValue(candidate);
  return {
    utility:
      candidate.kind === "arbitrary"
        ? (candidate.property ?? "")
        : (candidate.root ?? ""),
    arbitraryProperty: candidate.kind === "arbitrary",
    variants: candidate.variants.map((variant) =>
      designSystem.printVariant(variant),
    ),
    important: candidate.important,
    ...value,
    modifierKind: candidate.modifier?.kind ?? "none",
    arbitraryInputs: buildArbitraryInputs(candidate, value),
  };
}

/**
 * Adds every declared property in a Tailwind AST to a set.
 *
 * @param nodes - The nodes to walk.
 * @param output - The set to add to.
 * @returns `output`.
 */
function collectProperties(
  nodes: readonly TailwindAstNode[] | undefined,
  output: Set<string>,
): Set<string> {
  for (const node of nodes ?? []) {
    if (node.kind === "declaration" && node.property) {
      output.add(node.property);
    }
    collectProperties(node.nodes, output);
  }
  return output;
}

/**
 * Wraps a function of a string in a least-recently-used cache of `CACHE_LIMIT` entries.
 *
 * @param compute - The function to cache.
 * @returns A function that returns the cached result for a key it has seen.
 */
function memoize<Result>(
  compute: (key: string) => Result,
): (key: string) => Result {
  const cache = new Map<string, Result>();
  return (key) => {
    const result = cache.has(key) ? (cache.get(key) as Result) : compute(key);
    cache.delete(key);
    cache.set(key, result);
    if (cache.size > CACHE_LIMIT) {
      cache.delete(cache.keys().next().value as string);
    }
    return result;
  };
}

/**
 * Builds the view over a loaded Tailwind design system.
 *
 * @param tailwind - The loaded design system.
 * @returns The view.
 */
function createDesignSystemView(
  tailwind: TailwindDesignSystem,
): DesignSystemView {
  const keyframes = new Map<string, readonly string[]>();
  for (const block of tailwind.theme.getKeyframes()) {
    if (block.params) {
      keyframes.set(block.params, [
        ...collectProperties(block.nodes, new Set()),
      ]);
    }
  }
  return {
    declarationsOf: memoize((token) => {
      const css = tailwind.candidatesToCss([token])[0];
      return css ? parseStylesheetDeclarations(css) : undefined;
    }),
    candidatesOf: memoize((token) =>
      tailwind
        .parseCandidate(token)
        .map((candidate) => buildClassCandidate(tailwind, candidate)),
    ),
    keyframeProperties: (name) => keyframes.get(name),
    isDefaultThemeVariable: (variableName) =>
      (tailwind.theme.getOptions(variableName) & DEFAULT_THEME_OPTION) !== 0,
    themeValue: (variableName) => tailwind.resolveThemeValue(variableName),
  };
}

/**
 * Checks that the project's Tailwind packages share one version.
 *
 * @param rootDirectory - The project root.
 * @throws Error when `tailwindcss`, `@tailwindcss/postcss` or `@tailwindcss/node` is missing or
 *   their versions differ.
 */
function assertMatchingVersions(rootDirectory: string): void {
  const projectManifest = path.join(rootDirectory, "package.json");
  const versions = {
    tailwindcss: readPackageVersion(projectManifest, "tailwindcss"),
    "@tailwindcss/postcss": readPackageVersion(
      projectManifest,
      "@tailwindcss/postcss",
    ),
    "@tailwindcss/node": readPackageVersion(
      fileURLToPath(import.meta.url),
      "@tailwindcss/node",
    ),
  };
  if (new Set(Object.values(versions)).size !== 1) {
    throw new Error(
      `@pragmatiks/lint: tailwindcss, @tailwindcss/postcss and @tailwindcss/node need one Tailwind version; found ${JSON.stringify(versions)}. To fix it, ${VERSION_RECOVERY}.`,
    );
  }
}

/**
 * Checks that the loaded design system has the API shape this module reads.
 *
 * @param designSystem - The loaded design system.
 * @throws Error when a method or a parse field is missing.
 */
function assertTailwindApi(designSystem: TailwindDesignSystem): void {
  const [candidate] = designSystem.parseCandidate(
    "focus-visible:outline-hidden",
  );
  const usable =
    typeof designSystem.theme.getOptions === "function" &&
    typeof designSystem.theme.getKeyframes === "function" &&
    typeof designSystem.printVariant === "function" &&
    typeof designSystem.resolveThemeValue === "function" &&
    Array.isArray(candidate?.variants) &&
    typeof candidate.important === "boolean" &&
    typeof candidate.root === "string";
  if (!usable) {
    throw new Error(
      `@pragmatiks/lint: the canary found that the Tailwind design system API changed shape. To fix it, ${VERSION_RECOVERY}, the range @pragmatiks/lint supports.`,
    );
  }
}

/**
 * Checks that known tokens still compile to the declarations the rules rely on.
 *
 * @param view - The design system view.
 * @throws Error when a canary token compiles to something else.
 */
function assertCanary(view: DesignSystemView): void {
  for (const expected of CANARY_EXPECTATIONS) {
    const found = view
      .declarationsOf(expected.token)
      ?.some(
        (declaration) =>
          declaration.property === expected.property &&
          declaration.text === expected.value,
      );
    if (!found) {
      throw new Error(
        `@pragmatiks/lint: the canary found that ${expected.token} no longer compiles to ${expected.property}: ${expected.value}. To fix it, ${VERSION_RECOVERY}, the range @pragmatiks/lint supports.`,
      );
    }
  }
}

/**
 * Loads the project's Tailwind design system from its entry stylesheet.
 *
 * @param source - The project root and the stylesheet path relative to it.
 * @returns The design system view.
 * @throws Error when tailwindcss, @tailwindcss/postcss or @tailwindcss/node is missing or their
 *   versions differ, when the stylesheet cannot be read, or when the Tailwind API or canary check
 *   fails.
 */
export async function loadDesignSystem(
  source: DesignSystemSource,
): Promise<DesignSystemView> {
  assertMatchingVersions(source.rootDir);
  const { __unstable__loadDesignSystem } = await import("@tailwindcss/node");
  const stylesheetPath = path.resolve(
    source.rootDir,
    source.tailwindStylesheet,
  );
  const stylesheet = readFileSync(stylesheetPath, "utf8");
  const loaded = await __unstable__loadDesignSystem(stylesheet, {
    base: path.dirname(stylesheetPath),
  });
  const designSystem = loaded as unknown as TailwindDesignSystem;
  assertTailwindApi(designSystem);
  const view = createDesignSystemView(designSystem);
  assertCanary(view);
  return view;
}
