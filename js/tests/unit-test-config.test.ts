/**
 * Integration tests for `pragmatiksUnitTestConfig`.
 *
 * @packageDocumentation
 */
import { Linter } from "eslint";
import { describe, expect, it } from "vitest";

import { pragmatiksNextUnitTestConfig } from "../src/eslint-config/next/index.js";
import { pragmatiksUnitTestConfig } from "../src/eslint-config/unit-test/index.js";

const UNIT_FILE = "tests/unit/decision.test.ts";

/**
 * Lints one source as a file at the given path under the unit-test config.
 *
 * @param code - The source to lint.
 * @param filename - The path the source is linted as.
 * @param unitConfig - The unit-test config under test.
 * @returns The rule ids ESLint reports.
 */
function ruleIds(code: string, filename = UNIT_FILE, unitConfig = pragmatiksUnitTestConfig()): (string | null)[] {
  const linter = new Linter({ configType: "flat" });
  const config = [{ files: ["**/*.ts"] }, unitConfig];

  return linter.verify(code, config, { filename }).map((message) => message.ruleId);
}

describe("pragmatiksUnitTestConfig", () => {
  it.each([
    ["vi.mock", 'vi.mock("./module");', "no-restricted-properties"],
    ["vi.useFakeTimers", "vi.useFakeTimers();", "no-restricted-properties"],
    ["msw", 'import { http } from "msw";', "no-restricted-imports"],
    ["msw subpath", 'import { setupServer } from "msw/node";', "no-restricted-imports"],
    ["node:fs", 'import { readFile } from "node:fs/promises";', "no-restricted-imports"],
    ["child_process", 'import { exec } from "child_process";', "no-restricted-imports"],
    ["fetch", 'fetch("/api");', "no-restricted-globals"],
    ["process", "process.env.HOME;", "no-restricted-globals"],
    ["node:process", 'import { env } from "node:process";', "no-restricted-imports"],
    ["dns", 'import { lookup } from "node:dns";', "no-restricted-imports"],
    ["globalThis.fetch", 'globalThis.fetch("/api");', "no-restricted-properties"],
    ["window.fetch", 'window.fetch("/api");', "no-restricted-properties"],
    ["require node:fs", 'require("node:fs");', "no-restricted-syntax"],
    ["require fs/promises", 'require("fs/promises");', "no-restricted-syntax"],
    ["import() fs", 'await import("fs");', "no-restricted-syntax"],
    ["import() msw subpath", 'await import("msw/node");', "no-restricted-syntax"],
  ])("bans %s", (_name, code, rule) => {
    expect(ruleIds(code)).toEqual([rule]);
  });

  it("allows require() and import() of other modules", () => {
    expect(ruleIds('require("./decision");\nawait import("./decision");')).toEqual([]);
  });

  it("leaves Next bans out of the base unit-test config", () => {
    expect(ruleIds('import { X } from "lucide-react";\nReact.forwardRef(() => null);')).toEqual([]);
  });

  it.each([
    ["forwardRef import", 'import { forwardRef } from "react";', "no-restricted-imports"],
    ["icon family", 'import { X } from "lucide-react";', "no-restricted-imports"],
    ["React.forwardRef", "React.forwardRef(() => null);", "no-restricted-properties"],
    ["require node:fs", 'require("node:fs");', "no-restricted-syntax"],
  ])("keeps the Next ban on %s in pragmatiksNextUnitTestConfig", (_name, code, rule) => {
    expect(ruleIds(code, UNIT_FILE, pragmatiksNextUnitTestConfig())).toEqual([rule]);
  });

  it("allows a pure assertion", () => {
    expect(ruleIds('import { expect } from "vitest";\nexpect(1 + 1).toBe(2);')).toEqual([]);
  });

  it("leaves files outside tests/unit alone", () => {
    expect(ruleIds('vi.mock("./module");\nfetch("/api");', "tests/integration/flow.test.ts")).toEqual([]);
  });
});
