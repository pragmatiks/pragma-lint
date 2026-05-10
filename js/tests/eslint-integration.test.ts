import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { ESLint } from "eslint";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { pragmatiksConfig } from "../src/eslint-config/index.js";

let workspace: string;
let eslint: ESLint;

beforeAll(() => {
  workspace = mkdtempSync(path.join(tmpdir(), "pragmatiks-lint-it-"));
  eslint = new ESLint({
    cwd: workspace,
    overrideConfigFile: true,
    overrideConfig: pragmatiksConfig(),
  });
});

afterAll(() => {
  rmSync(workspace, { recursive: true, force: true });
});

describe("pragmatiksConfig integration", () => {
  it("parses .ts files via the bundled typescript-eslint parser", async () => {
    const fixture = path.join(workspace, "type-annotations.ts");
    writeFileSync(
      fixture,
      "export function compute(database: string): string {\n  return database;\n}\n",
    );
    const calculated = await eslint.calculateConfigForFile(fixture);
    expect(calculated.languageOptions?.parser).toBeDefined();
    expect(Object.keys(calculated.rules ?? {}).length).toBeGreaterThan(100);
  });

  it("flags forbidden abbreviations with flat-config TS wiring", async () => {
    const fixture = path.join(workspace, "abbrev.ts");
    writeFileSync(
      fixture,
      "export function compute(db: string): string {\n  return db;\n}\n",
    );
    const [report] = await eslint.lintFiles([fixture]);
    expect(report).toBeDefined();
    const ruleIds = new Set(report!.messages.map((message) => message.ruleId));
    expect(ruleIds.has("unicorn/prevent-abbreviations")).toBe(true);
    expect(report!.errorCount).toBeGreaterThan(0);
  });

  it("respects the allowList for database and id", async () => {
    const fixture = path.join(workspace, "allowed.ts");
    writeFileSync(
      fixture,
      "export function compute(database: string, id: string): string {\n  return database + id;\n}\n",
    );
    const [report] = await eslint.lintFiles([fixture]);
    const abbreviationFindings = report!.messages.filter(
      (message) => message.ruleId === "unicorn/prevent-abbreviations",
    );
    expect(abbreviationFindings).toHaveLength(0);
  });
});
