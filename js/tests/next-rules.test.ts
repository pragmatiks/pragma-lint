/**
 * RuleTester tests for the frontend rules of `pragmatiksNextConfig` in isolation, without a
 * fixture project.
 *
 * @packageDocumentation
 */
import css from "@eslint/css";
import { type Rule, RuleTester } from "eslint";
import tseslint from "typescript-eslint";
import { describe, expect, it } from "vitest";

import { cssFocusStylingRule } from "../src/eslint-config/next/frontend/rules/css-focus-styling.js";
import { cssNoApplyRule } from "../src/eslint-config/next/frontend/rules/css-no-apply.js";
import { cssParsedFullyRule } from "../src/eslint-config/next/frontend/rules/css-parsed-fully.js";
import { cssViewportUnitsRule } from "../src/eslint-config/next/frontend/rules/css-viewport-units.js";
import type { DesignSystemView } from "../src/eslint-config/next/frontend/design-system.js";
import { createCssZIndexRule } from "../src/eslint-config/next/frontend/rules/css-z-index.js";
import { formControlHasLabelRule } from "../src/eslint-config/next/frontend/rules/form-control-has-label.js";
import { noEmbeddedStyleRule } from "../src/eslint-config/next/frontend/rules/no-embedded-style.js";

/**
 * The valid and invalid cases RuleTester runs for one rule.
 */
type RuleCases = Parameters<RuleTester["run"]>[2];

/**
 * One rule with the tester and cases it runs under.
 */
interface RuleSuite {
  readonly name: string;
  readonly tester: RuleTester;
  readonly rule: unknown;
  readonly cases: RuleCases;
}

const jsxTester = new RuleTester({
  languageOptions: {
    parser: tseslint.parser,
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
});

const cssTester = new RuleTester({
  plugins: { css },
  language: "css/css",
  languageOptions: { tolerant: true },
});

const THEME: Readonly<Record<string, string>> = {
  "--z-index-low": "10",
  "--z-index-top": "99",
};

const UNKNOWN: Readonly<Record<string, never>> = {};

const THEME_VIEW: DesignSystemView = {
  declarationsOf: (token) => UNKNOWN[token],
  candidatesOf: () => [],
  keyframeProperties: (name) => UNKNOWN[name],
  isDefaultThemeVariable: () => false,
  themeValue: (variableName) => THEME[variableName],
};

const FORM_CONTROL_CASES: RuleCases = {
  valid: [
    `const a = <input aria-label="Name" />;`,
    `const a = <input aria-labelledby="name-label" />;`,
    `const a = <label>Name <select /></label>;`,
    `const a = <label htmlFor="n">Name <input id="n" /></label>;`,
    `function F() { return <><label htmlFor="n">Name</label><textarea id="n" /></>; }`,
    `const a = <input type="submit" />;`,
    `const a = <input {...props} />;`,
    `function Field({ id }) { return <><label htmlFor={id}>Name</label><input id={id} /></>; }`,
    "function F() { const id = useId(); return <><label htmlFor={`${id}-email`}>Email</label><input id={`${id}-email`} /></>; }",
    `function F(props) { return <><label htmlFor={props.id}>Name</label><input id={props.id} /></>; }`,
    `const a = <label>Name{flag ? <input /> : <textarea />}</label>;`,
    `function F() { return <>{[1].map(() => <label htmlFor="n">Name</label>)}{[1].map(() => <input id="n" />)}</>; }`,
    `function F(props) { return <>{[1].map(() => <label htmlFor={props.id}>Name</label>)}{[1].map(() => <input id={props.id} />)}</>; }`,
    `function F({ items }) { return items.map((item) => <><label htmlFor={item.id}>Name</label><input id={item.id} /></>); }`,
    `const F = () => <><label htmlFor="n">Name</label>{[1].map(() => <input id="n" />)}</>;`,
    `function Form({ rows }) { return <><label htmlFor="e">Email</label>{rows.map(function Row(row) { return <input id="e" />; })}</>; }`,
    `function F(props: { id: string }) {
  type Field = { id: string };
  const label = <label htmlFor={(props as Field).id}>Email</label>;
  return <>{label}{[0].map(() => {
    type Field = { id: string };
    return <input id={(props as Field).id} />;
  })}</>;
}`,
    `function F<T extends { id: string }>(props: T) { return <><label htmlFor={(props as T).id}>Email</label>{[0].map(<T,>() => <input id={(props as T).id} />)}</>; }`,
  ],
  invalid: [
    {
      code: `const a = <input placeholder="Name" />;`,
      errors: [{ messageId: "unlabelled" }],
    },
    {
      code: `const a = <input aria-label={null} />;`,
      errors: [{ messageId: "unlabelled" }],
    },
    {
      code: "const a = <input aria-label={``} />;",
      errors: [{ messageId: "unlabelled" }],
    },
    {
      code: `const a = <input type={kind} />;`,
      errors: [{ messageId: "unlabelled" }],
    },
    {
      code: `function A() { return <label htmlFor="n">Name</label>; }
function B() { return <input id="n" />; }`,
      errors: [{ messageId: "unlabelled" }],
    },
    {
      code: `function F() { return <><label htmlFor={dynamic}>Name</label><input id={dynamic} /></>; }`,
      errors: [{ messageId: "unlabelled" }],
    },
    {
      code: `const a = <label>Name <input /><input /></label>;`,
      errors: [{ messageId: "unlabelled" }],
    },
    {
      code: `function A({ id }) { return <label htmlFor={id}>Name</label>; }
function B({ id }) { return <input id={id} />; }`,
      errors: [{ messageId: "unlabelled" }],
    },
    {
      code: `function makeFields() {
  function Label() { return <label htmlFor="email">Email</label>; }
  function Input() { return <input id="email" />; }
  return Input;
}`,
      errors: [{ messageId: "unlabelled" }],
    },
    {
      code: `function makeFields() {
  const Label = () => <label htmlFor="email">Email</label>;
  const Input = () => <input id="email" />;
  return Input;
}`,
      errors: [{ messageId: "unlabelled" }],
    },
    {
      code: `function F() { return <>{[{ id: "labelled" }].map((item) => <label htmlFor={item.id}>Email</label>)}{[{ id: "unlabelled" }].map((item) => <input id={item.id} />)}</>; }`,
      errors: [{ messageId: "unlabelled" }],
    },
    {
      code: `function F() { return <>{[{ id: "a" }].map((item) => <label htmlFor={\`\${item.id}-x\`}>Email</label>)}{[{ id: "b" }].map((item) => <input id={\`\${item.id}-x\`} />)}</>; }`,
      errors: [{ messageId: "unlabelled" }],
    },
    {
      code: `function F() { return <>{[{ id: "a" }].map((item) => <label htmlFor={item?.id}>Email</label>)}{[{ id: "b" }].map((item) => <input id={item?.id} />)}</>; }`,
      errors: [{ messageId: "unlabelled" }],
    },
  ],
};

const EMBEDDED_STYLE_CASES: RuleCases = {
  valid: [
    `const a = <div style={{ color: "var(--text)" }} />;`,
    `const a = <Style />;`,
  ],
  invalid: [
    {
      code: `const a = <style>{".a { color: red }"}</style>;`,
      errors: [{ messageId: "embedded" }],
    },
  ],
};

const NO_APPLY_CASES: RuleCases = {
  valid: [`.a { color: var(--text); }`],
  invalid: [{ code: `.a { @apply px-2; }`, errors: [{ messageId: "apply" }] }],
};

const PARSED_FULLY_CASES: RuleCases = {
  valid: [
    `.a { color: var(--text); &:hover { opacity: 0.5; } }`,
    `@custom-variant dark (&:where(.dark, .dark *));`,
    `@utility glass { & { color: var(--text); } &:hover { opacity: 0.5; } }`,
  ],
  invalid: [
    {
      code: `@utility glass {
  color: var(--text);
  &:hover { opacity: 0.5; }
  opacity: 1;
}`,
      errors: [{ messageId: "swallowed" }, { messageId: "unparsed" }],
    },
    {
      code: `@utility glass { outline: none; &:hover { opacity: 0.5; } }`,
      errors: [{ messageId: "swallowed" }],
    },
  ],
};

const VIEWPORT_CASES: RuleCases = {
  valid: [`.a { height: 100dvh; width: 100vw; }`],
  invalid: [
    {
      code: `.a { height: 100vh; }`,
      errors: [{ messageId: "vhUnit" }],
    },
    {
      code: `.a { height: var(--h, 50vh); }`,
      errors: [{ messageId: "vhUnit" }],
    },
  ],
};

const Z_INDEX_CASES: RuleCases = {
  valid: [
    `.a { z-index: 50; }`,
    `.a { z-index: -1; }`,
    `.a { z-index: var(--layer); }`,
    `.a { z-index: var(--z-index-low); }`,
    `.a { z-index: var(--layer, 10); }`,
    `.a { z-index: calc(5 * 10); }`,
  ],
  invalid: [
    { code: `.a { z-index: 51; }`, errors: [{ messageId: "exceeds" }] },
    {
      code: `.a { z-index: calc(6 * 10); }`,
      errors: [{ messageId: "exceeds" }],
    },
    { code: `.a { z-index: inherit; }`, errors: [{ messageId: "exceeds" }] },
    {
      code: `.a { z-index: var(--z-index-top); }`,
      errors: [{ messageId: "exceeds" }],
    },
    {
      code: `.a { z-index: var(--layer, 99); }`,
      errors: [{ messageId: "exceeds" }],
    },
  ],
};

const FOCUS_CASES: RuleCases = {
  valid: [
    `.a:focus-visible { outline: 2px solid var(--ring); outline-offset: 2px; }`,
    `@layer components { .a { box-shadow: 0 1px 2px var(--shadow); } }`,
    `.a { box-shadow: var(--tw-ring-offset-shadow), var(--tw-ring-shadow), 0 1px 2px var(--shadow); }`,
    `@layer theme { .a { box-shadow: 0 1px 2px var(--shadow); } }`,
    `.a { --tw-shadow: 0 1px 2px var(--shadow); }`,
    `.a { @variant focus-visible { outline: 2px solid var(--ring); outline-offset: 2px; } }`,
  ],
  invalid: [
    {
      code: `.a:focus-visible { outline: none; }`,
      errors: [{ messageId: "focusRule" }],
    },
    {
      code: `.a:focus-within { outline: 2px solid var(--ring); }`,
      errors: [{ messageId: "focusRule" }],
    },
    {
      code: `.a { outline-color: var(--ring); }`,
      errors: [{ messageId: "focusDeclaration" }],
    },
    { code: `.a { all: unset; }`, errors: [{ messageId: "focusDeclaration" }] },
    {
      code: `@layer components { .a { box-shadow: none !important; } }`,
      errors: [{ messageId: "focusDeclaration" }],
    },
    {
      code: `.a { box-shadow: var(--tw-ring-shadow), 0 1px 2px var(--shadow); }`,
      errors: [{ messageId: "focusDeclaration" }],
    },
    {
      code: `.a { -webkit-box-shadow: 0 1px 2px var(--shadow); }`,
      errors: [{ messageId: "focusDeclaration" }],
    },
    {
      code: `@layer components { .a { --tw-shadow: none; } }`,
      errors: [{ messageId: "focusDeclaration" }],
    },
    {
      code: `.a:focus-visible { outline: 2s solid var(--ring); }`,
      errors: [{ messageId: "focusRule" }],
    },
    {
      code: `.a { @variant focus-visible { outline: none; } }`,
      errors: [{ messageId: "focusRule" }],
    },
  ],
};

const SUITES: readonly RuleSuite[] = [
  {
    name: "form-control-has-label",
    tester: jsxTester,
    rule: formControlHasLabelRule,
    cases: FORM_CONTROL_CASES,
  },
  {
    name: "no-embedded-style",
    tester: jsxTester,
    rule: noEmbeddedStyleRule,
    cases: EMBEDDED_STYLE_CASES,
  },
  {
    name: "css-no-apply",
    tester: cssTester,
    rule: cssNoApplyRule,
    cases: NO_APPLY_CASES,
  },
  {
    name: "css-parsed-fully",
    tester: cssTester,
    rule: cssParsedFullyRule,
    cases: PARSED_FULLY_CASES,
  },
  {
    name: "css-viewport-units",
    tester: cssTester,
    rule: cssViewportUnitsRule,
    cases: VIEWPORT_CASES,
  },
  {
    name: "css-z-index",
    tester: cssTester,
    rule: createCssZIndexRule(THEME_VIEW),
    cases: Z_INDEX_CASES,
  },
  {
    name: "css-focus-styling",
    tester: cssTester,
    rule: cssFocusStylingRule,
    cases: FOCUS_CASES,
  },
];

describe("frontend rules in isolation", () => {
  it.each(SUITES)("$name", ({ name, tester, rule, cases }) => {
    expect(() =>
      tester.run(name, rule as Rule.RuleModule, cases),
    ).not.toThrow();
  });
});
