/**
 * Integration tests for `pragmatiksUnitTestConfig`.
 *
 * @packageDocumentation
 */
import { Linter } from "eslint";
import { describe, expect, it } from "vitest";

import { pragmatiksUnitTestConfig } from "../src/eslint-config/unit-test/index.js";

const UNIT_FILE = "tests/unit/decision.test.ts";

/**
 * Lints one source as a file at the given path under the unit-test config.
 *
 * @param code - The source to lint.
 * @param filename - The path the source is linted as.
 * @returns The rule ids ESLint reports.
 */
function ruleIds(code: string, filename = UNIT_FILE): (string | null)[] {
  const linter = new Linter({ configType: "flat" });
  const config = [{ files: ["**/*.ts"] }, pragmatiksUnitTestConfig()];

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
    ["Next forwardRef import", 'import { forwardRef } from "react";', "no-restricted-imports"],
    ["Next icon family", 'import { X } from "lucide-react";', "no-restricted-imports"],
    ["Next React.forwardRef", "React.forwardRef(() => null);", "no-restricted-properties"],
  ])("bans %s", (_name, code, rule) => {
    expect(ruleIds(code)).toEqual([rule]);
  });

  it("allows a pure assertion", () => {
    expect(ruleIds('import { expect } from "vitest";\nexpect(1 + 1).toBe(2);')).toEqual([]);
  });

  it("leaves files outside tests/unit alone", () => {
    expect(ruleIds('vi.mock("./module");\nfetch("/api");', "tests/integration/flow.test.ts")).toEqual([]);
  });
});
