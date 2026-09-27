/**
 * The `@pragmatiks/lint/eslint-config/next` entry: the flat config for a Next app with Tailwind.
 *
 * @packageDocumentation
 */
import css from "@eslint/css";
import type { ESLint, Linter } from "eslint";
import reactX from "eslint-plugin-react-x";

import { pragmatiksConfig } from "../index.js";
import {
  type DesignSystemSource,
  type DesignSystemView,
  loadDesignSystem,
} from "./frontend/design-system.js";
import {
  createFrontendPlugin,
  createFrontendRules,
  type FrontendRules,
} from "./frontend/plugin.js";
import {
  FILENAME_CASE_OPTIONS,
  NO_USELESS_UNDEFINED_OPTIONS,
} from "../options.js";

/**
 * One rule's severity and options.
 */
type RuleEntry = Linter.RuleEntry;

/**
 * The part of `eslint-plugin-jsx-a11y` this config reads.
 */
interface AccessibilityPlugin {
  /** The plugin's flat presets. */
  readonly flatConfigs?: {
    readonly recommended?: { readonly rules?: Record<string, RuleEntry> };
  };
}

const ACCESSIBILITY_PLUGIN = "jsx-a11y";
const LABEL_RULE = "jsx-a11y/control-has-associated-label";
const TYPED_FILES = ["**/*.{ts,tsx,mts}"];
const THREE_DOTS_PATTERN = String.raw`/[A-Za-z]\.\.\./`;
const ELLIPSIS_MESSAGE = "Write the ellipsis glyph … instead of three dots.";
const ZOOM_MESSAGE = "Never disable zoom in the viewport export.";
const FORWARD_REF_MESSAGE =
  "Pass ref as a prop; React 19 does not need forwardRef.";
const URL_ATTRIBUTE = String.raw`JSXAttribute[name.name=/^(href|src|action)$/]`;
const ELLIPSIS_EXEMPT_LITERAL = [
  `${URL_ATTRIBUTE} Literal`,
  "ImportDeclaration > Literal",
  "ExportNamedDeclaration > Literal",
  "ExportAllDeclaration > Literal",
  "ImportExpression > Literal",
].join(", ");
const PRESET_RECOVERY =
  "To fix it, pass [...nextVitals, ...nextTs] from eslint-config-next";
const ICON_FAMILY = "@phosphor-icons/react";
const ICON_PACKAGES = [
  "lucide-react",
  "react-icons",
  "react-icons/*",
  "@heroicons/*",
  "@tabler/icons-react",
  "@radix-ui/react-icons",
  "react-feather",
  "@fortawesome/*",
  "@mui/icons-material",
  "@mui/icons-material/*",
];

const RESTRICTED_SYNTAX = [
  {
    selector: `JSXText[value=${THREE_DOTS_PATTERN}]`,
    message: ELLIPSIS_MESSAGE,
  },
  {
    selector: `Literal[value=${THREE_DOTS_PATTERN}]:not(${ELLIPSIS_EXEMPT_LITERAL})`,
    message: ELLIPSIS_MESSAGE,
  },
  {
    selector: `TemplateElement[value.cooked=${THREE_DOTS_PATTERN}]:not(${URL_ATTRIBUTE} TemplateElement)`,
    message: ELLIPSIS_MESSAGE,
  },
  {
    selector: `JSXAttribute[name.name="onPaste"] CallExpression[callee.property.name="preventDefault"]`,
    message: "Never block pasting into inputs.",
  },
  {
    selector: `Property:matches([key.name="userScalable"], [key.value="userScalable"])[value.value=false]`,
    message: ZOOM_MESSAGE,
  },
  {
    selector: `Property:matches([key.name="maximumScale"], [key.value="maximumScale"])[value.value=1]`,
    message: ZOOM_MESSAGE,
  },
  {
    selector: `JSXOpeningElement[name.name="link"] JSXAttribute[name.name="href"] Literal[value=/fonts\.(googleapis|gstatic)\.com/]`,
    message: "Load fonts through next/font, not a <link> to Google Fonts.",
  },
  {
    selector: `JSXText[value=/lorem ipsum|John Doe/i]`,
    message: "Replace placeholder content with real copy.",
  },
];

const RESTRICTED_IMPORTS = {
  paths: [
    {
      name: "react",
      importNames: ["forwardRef"],
      message: FORWARD_REF_MESSAGE,
    },
  ],
  patterns: [
    {
      group: ICON_PACKAGES,
      message: `Use ${ICON_FAMILY}, the project's one icon family.`,
    },
  ],
};

const RESTRICTED_PROPERTIES = {
  object: "React",
  property: "forwardRef",
  message: FORWARD_REF_MESSAGE,
};

/**
 * Where the Next app lives and which stylesheet is its Tailwind entry point.
 */
export interface PragmatiksNextOptions extends DesignSystemSource {
  /** Absolute path of the Next app, usually `import.meta.dirname` of its `eslint.config.mjs`. */
  readonly rootDir: string;
  /** Path of the Tailwind entry stylesheet relative to `rootDir`, such as `app/globals.css`. */
  readonly tailwindStylesheet: string;
}

/**
 * Tells whether a config object only lists ignores.
 *
 * @param config - A flat config object.
 * @returns `true` when the object has no keys besides `ignores` and `name`.
 */
function isIgnoreOnly(config: Linter.Config): boolean {
  return Object.keys(config).every(
    (key) => key === "ignores" || key === "name",
  );
}

/**
 * Finds the one Next config object that registers `jsx-a11y`.
 *
 * @param nextConfigs - The Next presets.
 * @returns The object, which has `files`.
 * @throws Error when no object or more than one registers `jsx-a11y`, or the one that does has
 *   no `files`.
 */
function findAccessibilityConfig(
  nextConfigs: readonly Linter.Config[],
): Linter.Config {
  const matches = nextConfigs.filter(
    (config) => config.plugins?.[ACCESSIBILITY_PLUGIN] !== undefined,
  );
  const [only] = matches;
  if (matches.length !== 1 || !only?.files) {
    throw new Error(
      `@pragmatiks/lint: pragmatiksNextConfig expects exactly one Next config object that registers ${ACCESSIBILITY_PLUGIN} with files; found ${String(matches.length)}. ${PRESET_RECOVERY}.`,
    );
  }
  return only;
}

/**
 * Scopes the Next config objects that have no `files` to a glob.
 *
 * @param nextConfigs - The Next presets.
 * @param files - The glob to apply.
 * @returns The presets, with ignore-only objects and objects that have `files` unchanged.
 */
function scopeNextConfigs(
  nextConfigs: readonly Linter.Config[],
  files: Linter.Config["files"],
): Linter.Config[] {
  return nextConfigs.map((config) =>
    config.files || isIgnoreOnly(config) ? config : { ...config, files },
  );
}

/**
 * Adds `select` to the ignored elements of `jsx-a11y/control-has-associated-label`.
 *
 * @param labelOptions - The rule's recommended options.
 * @returns The options with `select` appended to `ignoreElements`.
 */
function buildLabelOptions(labelOptions: readonly unknown[]): unknown[] {
  const [first, ...rest] = labelOptions;
  const options = (first ?? {}) as { ignoreElements?: readonly string[] };
  return [
    {
      ...options,
      ignoreElements: [...(options.ignoreElements ?? []), "select"],
    },
    ...rest,
  ];
}

/**
 * Builds the `jsx-a11y` rules: the recommended preset with the label rule and `no-autofocus` as
 * errors.
 *
 * @param accessibilityConfig - The Next object that registers `jsx-a11y`.
 * @returns The rule entries.
 * @throws Error when the plugin has no flat recommended preset with label rule options.
 */
function buildAccessibilityRules(
  accessibilityConfig: Linter.Config,
): Record<string, RuleEntry> {
  const plugin = accessibilityConfig.plugins?.[ACCESSIBILITY_PLUGIN] as
    | AccessibilityPlugin
    | undefined;
  const recommended = plugin?.flatConfigs?.recommended?.rules;
  const labelEntry = recommended?.[LABEL_RULE];
  if (!recommended || !Array.isArray(labelEntry)) {
    throw new Error(
      `@pragmatiks/lint: ${ACCESSIBILITY_PLUGIN} has no flat recommended preset with ${LABEL_RULE} options. ${PRESET_RECOVERY}.`,
    );
  }
  const [, ...labelOptions] = labelEntry;
  return {
    ...recommended,
    [LABEL_RULE]: ["error", ...buildLabelOptions(labelOptions)],
    "jsx-a11y/no-autofocus": ["error", { ignoreNonDOM: true }],
  };
}

/**
 * Turns frontend rule ids into error entries under the `pragmatiks` plugin.
 *
 * @param ruleIds - The rule ids without the plugin prefix.
 * @returns One `pragmatiks/<id>: "error"` entry per id.
 */
function buildRuleEntries(
  ruleIds: readonly string[],
): Record<string, RuleEntry> {
  return Object.fromEntries(
    ruleIds.map((ruleId) => [`pragmatiks/${ruleId}`, "error"]),
  );
}

/**
 * Builds the config object for the JavaScript and TypeScript frontend rules.
 *
 * @param accessibilityConfig - The Next object that registers `jsx-a11y`, whose `files` it reuses.
 * @param plugin - The `pragmatiks` plugin.
 * @param rules - The frontend rules.
 * @returns The config object.
 * @throws Error when `jsx-a11y` has no flat recommended preset with label rule options.
 */
function buildFrontendConfig(
  accessibilityConfig: Linter.Config,
  plugin: ESLint.Plugin,
  rules: FrontendRules,
): Linter.Config {
  return {
    name: "pragmatiks/next/frontend",
    files: accessibilityConfig.files,
    plugins: { pragmatiks: plugin },
    rules: {
      ...buildAccessibilityRules(accessibilityConfig),
      ...buildRuleEntries(Object.keys(rules.javascript)),
      "no-restricted-syntax": ["error", ...RESTRICTED_SYNTAX],
      "no-restricted-imports": ["error", RESTRICTED_IMPORTS],
      "no-restricted-properties": ["error", RESTRICTED_PROPERTIES],
      "no-alert": "error",
      "unicorn/filename-case": ["error", FILENAME_CASE_OPTIONS],
      "unicorn/no-useless-undefined": ["error", NO_USELESS_UNDEFINED_OPTIONS],
    },
  };
}

/**
 * Builds the config object for the typed `react-x` leaked-render check.
 *
 * @param rootDirectory - The app root, where the TypeScript project service looks for tsconfig.
 * @returns The config object for TypeScript files.
 */
function buildTypedConfig(rootDirectory: string): Linter.Config {
  return {
    name: "pragmatiks/next/typed",
    files: TYPED_FILES,
    plugins: { "react-x": reactX as unknown as ESLint.Plugin },
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: rootDirectory },
    },
    rules: { "react-x/no-leaked-conditional-rendering": "error" },
  };
}

/**
 * Builds the config object for the CSS rules.
 *
 * @param plugin - The `pragmatiks` plugin.
 * @param rules - The frontend rules.
 * @returns The config object for CSS files, parsed tolerantly by `@eslint/css`.
 */
function buildCssConfig(
  plugin: ESLint.Plugin,
  rules: FrontendRules,
): Linter.Config {
  return {
    name: "pragmatiks/next/css",
    files: ["**/*.css"],
    plugins: { css: css as unknown as ESLint.Plugin, pragmatiks: plugin },
    language: "css/css",
    languageOptions: { tolerant: true },
    rules: buildRuleEntries(Object.keys(rules.css)),
  };
}

/**
 * Builds the flat config for a Next app: the Next presets, the Pragmatiks base config, the
 * frontend rules for JavaScript and TypeScript, a typed leaked-render check, and the CSS rules.
 *
 * Next config objects without `files` are scoped to the glob of the one object that registers
 * `jsx-a11y`; ignore-only objects are kept as they are. The base config's typescript-eslint parser
 * replaces Next's Babel parser on JavaScript files. The project's Tailwind design system is loaded
 * when the config is built, so a stylesheet edit needs a restart of long-lived ESLint processes.
 *
 * Note: requires the optional peers `@eslint/css`, `eslint-plugin-react-x`, `tailwindcss`,
 * `@tailwindcss/postcss` and `@tailwindcss/node`, with `tailwindcss` and `@tailwindcss/postcss`
 * resolvable from `rootDir`.
 *
 * @param nextConfigs - The `eslint-config-next` presets, such as `[...nextVitals, ...nextTs]`.
 * @param options - The app root and its Tailwind entry stylesheet.
 * @returns The composed flat config.
 * @throws Error when the presets do not register `jsx-a11y` exactly once or lack its flat
 *   recommended preset, when a peer or Tailwind package is missing or their versions differ, when
 *   the stylesheet cannot be read, or when the Tailwind API or canary check fails.
 */
export async function pragmatiksNextConfig(
  nextConfigs: readonly Linter.Config[],
  options: PragmatiksNextOptions,
): Promise<Linter.Config[]> {
  const accessibilityConfig = findAccessibilityConfig(nextConfigs);
  const view: DesignSystemView = await loadDesignSystem(options);
  const rules = createFrontendRules(view);
  const plugin = createFrontendPlugin(rules);
  return [
    ...scopeNextConfigs(nextConfigs, accessibilityConfig.files),
    ...(pragmatiksConfig() as Linter.Config[]),
    buildFrontendConfig(accessibilityConfig, plugin, rules),
    buildTypedConfig(options.rootDir),
    buildCssConfig(plugin, rules),
  ];
}
