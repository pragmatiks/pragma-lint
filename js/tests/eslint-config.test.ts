import { describe, expect, it } from "vitest";

import {
  pragmatiksConfig,
  semgrepRulesDirectory,
} from "../src/eslint-config/index.js";
import {
  COMPLEXITY_OPTS,
  MAX_DEPTH_OPTS,
  MAX_LINES_PER_FUNCTION_OPTS,
  MAX_PARAMS_OPTS,
  MAX_STATEMENTS_OPTS,
  PREVENT_ABBREVIATIONS_OPTS,
} from "../src/eslint-config/options.js";
import { PRAGMATIKS_LINT_FILES } from "../src/index.js";

const ALLOWED_ENTRIES = [
  "id",
  "url",
  "uri",
  "api",
  "cli",
  "sdk",
  "os",
  "io",
  "ip",
  "tls",
  "ssl",
  "jwt",
  "json",
  "yaml",
  "html",
  "css",
  "dom",
  "ast",
  "gpu",
  "cpu",
  "ram",
  "vm",
  "props",
  "ref",
  "e",
] as const;

const PRIMARY_RULES = [
  "complexity",
  "max-lines-per-function",
  "max-statements",
  "max-depth",
  "max-params",
  "unicorn/prevent-abbreviations",
] as const;

type RuleEntry =
  | ["error" | "warn" | "off", ...unknown[]]
  | "error"
  | "warn"
  | "off";

describe("option consts", () => {
  it("exposes documented thresholds", () => {
    expect(COMPLEXITY_OPTS).toBe(10);
    expect(MAX_LINES_PER_FUNCTION_OPTS).toEqual({
      max: 50,
      skipBlankLines: true,
      skipComments: true,
    });
    expect(MAX_STATEMENTS_OPTS).toBe(15);
    expect(MAX_DEPTH_OPTS).toBe(4);
    expect(MAX_PARAMS_OPTS).toBe(4);
  });
});

describe("prevent-abbreviations allowList", () => {
  const allowList = PREVENT_ABBREVIATIONS_OPTS.allowList as Record<
    string,
    boolean
  >;

  it("excludes Python-specific entries", () => {
    for (const pythonOnly of ["cls", "self", "kwargs", "args"]) {
      expect(allowList[pythonOnly]).toBeUndefined();
    }
  });

  it("includes industry-standard and React-specific entries", () => {
    for (const entry of ALLOWED_ENTRIES) {
      expect(allowList[entry]).toBe(true);
    }
  });
});

describe("pragmatiksConfig", () => {
  it("returns a non-empty array with primary rules at error severity", () => {
    const config = pragmatiksConfig();
    expect(Array.isArray(config)).toBe(true);
    expect(config.length).toBeGreaterThan(0);

    const block = config.find(
      (entry: { rules?: Record<string, RuleEntry> }) => {
        return entry.rules !== undefined && "complexity" in entry.rules;
      },
    ) as { rules: Record<string, RuleEntry> } | undefined;

    expect(block).toBeDefined();
    for (const ruleName of PRIMARY_RULES) {
      const entry = block!.rules[ruleName];
      expect(entry).toBeDefined();
      const severity = Array.isArray(entry) ? entry[0] : entry;
      expect(severity).toBe("error");
    }
  });

  it("exports the standard JS and TS file glob", () => {
    expect(PRAGMATIKS_LINT_FILES).toEqual(["**/*.{ts,tsx,mts,cts,js,mjs,cjs}"]);
  });

  it("exposes the vendored semgrep rules directory in settings", () => {
    const [block] = pragmatiksConfig();
    expect(block?.settings?.pragmatiksLint).toEqual({
      semgrepRulesDirectory: semgrepRulesDirectory(),
    });
  });
});
