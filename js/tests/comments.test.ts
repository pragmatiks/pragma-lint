/**
 * Integration tests for the `no-comments` and `css-no-comments` rules.
 *
 * @packageDocumentation
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { ESLint } from "eslint";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { pragmatiksCssConfig } from "../src/eslint-config/css/index.js";
import { pragmatiksConfig } from "../src/eslint-config/index.js";

const SCRIPT_RULE = "pragmatiks-comments/no-comments";
const CSS_RULE = "pragmatiks-comments/css-no-comments";
const BAN_TS_COMMENT_RULE = "@typescript-eslint/ban-ts-comment";

/**
 * One source fixture and how many findings a rule reports on it.
 */
interface CommentCase {
  readonly name: string;
  readonly code: string;
  readonly count: number;
}

const SCRIPT_CASES: readonly CommentCase[] = [
  {
    name: "line comment",
    code: "// explains\nexport const a = 1;\n",
    count: 1,
  },
  {
    name: "WHY line comment",
    code: "export const a = 1; // WHY: x\n",
    count: 1,
  },
  {
    name: "block comment",
    code: "/* explains */\nexport const a = 1;\n",
    count: 1,
  },
  {
    name: "empty block comment",
    code: "/**/\nexport const a = 1;\n",
    count: 1,
  },
  {
    name: "TODO with an issue",
    code: "// TODO(PRA-1): later\nexport const a = 1;\n",
    count: 1,
  },
  {
    name: "JSDoc",
    code: "/** The answer. */\nexport const a = 1;\n",
    count: 0,
  },
  {
    name: "JSDoc holding a block opener",
    code: "/**\n * Globs such as src/** and a /* opener stay.\n */\nexport const a = 1;\n",
    count: 0,
  },
  {
    name: "shebang",
    code: "#!/usr/bin/env node\nexport const a = 1;\n",
    count: 0,
  },
  {
    name: "bare eslint-disable-next-line",
    code: "// eslint-disable-next-line no-console\nconsole.log(1);\n",
    count: 0,
  },
  {
    name: "bare scoped rule list",
    code: "// eslint-disable-next-line no-console, @typescript-eslint/no-explicit-any\nconsole.log(1);\n",
    count: 0,
  },
  {
    name: "unspaced block disable",
    code: "/*eslint-disable*/\nexport const a = 1;\n",
    count: 0,
  },
  {
    name: "directive with a description",
    code: "// eslint-disable-next-line no-console -- WHY: debug\nconsole.log(1);\n",
    count: 1,
  },
  {
    name: "globals",
    code: "/* global window, document */\nexport const a = 1;\n",
    count: 0,
  },
  {
    name: "exported",
    code: "/* exported a */\nexport const a = 1;\n",
    count: 0,
  },
  {
    name: "prettier-ignore",
    code: "// prettier-ignore\nexport const a = [1,2];\n",
    count: 1,
  },
  {
    name: "triple-slash reference",
    code: '/// <reference types="node" />\nexport const a = 1;\n',
    count: 0,
  },
  {
    name: "bare ts-expect-error",
    code: "// @ts-expect-error\nexport const a: number = 'x';\n",
    count: 0,
  },
  {
    name: "ts-expect-error with prose",
    code: "// @ts-expect-error wrong type\nexport const a: number = 'x';\n",
    count: 1,
  },
  {
    name: "ts-nocheck",
    code: "// @ts-nocheck\nexport const a = 1;\n",
    count: 1,
  },
];

const JSX_CASES: readonly CommentCase[] = [
  {
    name: "JSX block comment",
    code: "export const a = <div>{/* note */}</div>;\n",
    count: 1,
  },
  {
    name: "JSX JSDoc",
    code: "export const a = <div>{/** note */}</div>;\n",
    count: 0,
  },
];

const CSS_CASES: readonly CommentCase[] = [
  {
    name: "block comment",
    code: "/* explains */\n.a { color: red; }\n",
    count: 1,
  },
  { name: "WHY comment", code: ".a { color: red; /* WHY: x */ }\n", count: 1 },
  { name: "no comment", code: ".a { color: red; }\n", count: 0 },
  {
    name: "bare eslint-disable",
    code: "/* eslint-disable */\n.a { color: red; }\n",
    count: 0,
  },
];

let workspace: string;
let eslint: ESLint;

beforeAll(() => {
  workspace = mkdtempSync(path.join(tmpdir(), "pragmatiks-lint-comments-"));
  eslint = new ESLint({
    cwd: workspace,
    overrideConfigFile: true,
    overrideConfig: [
      ...pragmatiksConfig(),
      pragmatiksCssConfig(),
      {
        languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
        files: ["**/*.tsx"],
      },
    ],
  });
});

afterAll(() => {
  rmSync(workspace, { recursive: true, force: true });
});

/**
 * Lints one fixture and counts one rule's findings.
 *
 * @param code - The fixture source.
 * @param file - The file name the fixture is linted as.
 * @param rule - The full rule ID.
 * @returns The number of findings `rule` reports.
 */
async function countFindings(
  code: string,
  file: string,
  rule: string,
): Promise<number> {
  const [report] = await eslint.lintText(code, {
    filePath: path.join(workspace, file),
  });
  const fatal = report!.messages.filter((message) => message.fatal);
  expect(fatal).toEqual([]);
  return report!.messages.filter((message) => message.ruleId === rule).length;
}

describe("no-comments", () => {
  it.each(SCRIPT_CASES)("$name", async ({ code, count }) => {
    expect(await countFindings(code, "fixture.ts", SCRIPT_RULE)).toBe(count);
  });

  it.each(JSX_CASES)("$name", async ({ code, count }) => {
    expect(await countFindings(code, "fixture.tsx", SCRIPT_RULE)).toBe(count);
  });

  it("lets ban-ts-comment pass a bare ts-expect-error", async () => {
    const code = "// @ts-expect-error\nexport const a: number = 'x';\n";
    expect(await countFindings(code, "fixture.ts", BAN_TS_COMMENT_RULE)).toBe(
      0,
    );
  });

  it("keeps ban-ts-comment on ts-ignore", async () => {
    const code = "// @ts-ignore\nexport const a: number = 'x';\n";
    expect(await countFindings(code, "fixture.ts", BAN_TS_COMMENT_RULE)).toBe(
      1,
    );
  });
});

describe("css-no-comments", () => {
  it.each(CSS_CASES)("$name", async ({ code, count }) => {
    expect(await countFindings(code, "fixture.css", CSS_RULE)).toBe(count);
  });
});
