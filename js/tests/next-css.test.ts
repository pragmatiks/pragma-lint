/**
 * Integration tests for the stylesheet rules of `pragmatiksNextConfig`.
 *
 * @packageDocumentation
 */
import { describe, expect, it } from "vitest";

import {
  ANY_PRAGMATIKS_RULE,
  flattenCaseTables,
  registerNextFixtureLinter,
  type RuleCaseTable,
} from "./next-project.js";

/**
 * One stylesheet fixture and how many messages its table's rule reports on it.
 */
interface CssCase {
  readonly name: string;
  readonly code: string;
  readonly count: number;
}

const REDUCED_MOTION = `@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
`;

const REACT_FLOW_C1 = `.react-flow-nacre .react-flow__node.selectable:focus-visible,
.react-flow-nacre .react-flow__edge.selectable:focus-visible {
  outline: 2px solid var(--nacre-rose);
  outline-offset: 2px;
}
`;

const FOCUS_CASES: RuleCaseTable<CssCase> = {
  rule: "pragmatiks/css-focus-styling",
  cases: [
    {
      name: "C1",
      code: `.button:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: 2px; }`,
      count: 0,
    },
    { name: "C1 node-and-edge list", code: REACT_FLOW_C1, count: 0 },
    {
      name: "C1 with a keyword width",
      code: `.link:focus-visible { outline: medium solid var(--focus-ring); }`,
      count: 0,
    },
    {
      name: "mixed selector list",
      code: `.a:focus-visible, .b:focus { outline: 2px solid var(--focus-ring); }`,
      count: 1,
    },
    {
      name: "C1 with !important",
      code: `.a:focus-visible { outline: 2px solid var(--focus-ring) !important; }`,
      count: 1,
    },
    {
      name: "zero outline width",
      code: `.a:focus-visible { outline: 0 solid var(--focus-ring); }`,
      count: 1,
    },
    {
      name: "literal outline color",
      code: `.a:focus-visible { outline: 2px solid #fff; }`,
      count: 1,
    },
    {
      name: "extra declaration in a focus rule",
      code: `.a:focus-visible { outline: 2px solid var(--focus-ring); color: var(--text); }`,
      count: 1,
    },
    {
      name: ":focus rule",
      code: `.a:focus { outline: 2px solid var(--focus-ring); }`,
      count: 1,
    },
    {
      name: "outline outside a focus rule",
      code: `.a { outline: none; }`,
      count: 1,
    },
    {
      name: "forced-color-adjust",
      code: `.a { forced-color-adjust: none; }`,
      count: 1,
    },
    {
      name: "--tw-ring-color",
      code: `.a { --tw-ring-color: var(--brand); }`,
      count: 1,
    },
    {
      name: "unlayered box-shadow",
      code: `.a { box-shadow: 0 0 0 1px var(--edge); }`,
      count: 1,
    },
    {
      name: "box-shadow in utilities",
      code: `@layer utilities { .a { box-shadow: none; } }`,
      count: 1,
    },
    {
      name: "box-shadow in components",
      code: `@layer components { .a { box-shadow: 0 0 0 1px var(--edge); } }`,
      count: 0,
    },
    {
      name: "box-shadow in base",
      code: `@layer base { .a { box-shadow: none; } }`,
      count: 0,
    },
    {
      name: "box-shadow in keyframes",
      code: `@layer components { @keyframes pulse { to { box-shadow: 0 0 4px var(--edge); } } }`,
      count: 1,
    },
    {
      name: "!important box-shadow in components",
      code: `@layer components { .a { box-shadow: none !important; } }`,
      count: 1,
    },
    {
      name: "box-shadow composing the ring",
      code: `.a { box-shadow: var(--tw-ring-offset-shadow), var(--tw-ring-shadow), 0 0 0 1px var(--edge); }`,
      count: 0,
    },
    {
      name: "box-shadow composing the ring without its offset",
      code: `.a { box-shadow: var(--tw-ring-shadow), 0 0 0 1px var(--edge); }`,
      count: 1,
    },
    {
      name: "box-shadow in theme",
      code: `@layer theme { .a { box-shadow: 0 0 0 1px var(--edge); } }`,
      count: 0,
    },
    {
      name: "unlayered -webkit-box-shadow",
      code: `.a { -webkit-box-shadow: 0 0 0 1px var(--edge); }`,
      count: 1,
    },
    {
      name: "--tw-shadow reset",
      code: `@layer components { .a { --tw-shadow: none; } }`,
      count: 1,
    },
    {
      name: "outline with a time as its width",
      code: `.a:focus-visible { outline: 2s solid var(--focus-ring); }`,
      count: 1,
    },
    {
      name: "C1 in @variant focus-visible",
      code: `.a { @variant focus-visible { outline: 2px solid var(--focus-ring); outline-offset: 2px; } }`,
      count: 0,
    },
    {
      name: "C1 in @variant focus-visible inside @utility",
      code: `@utility focus-ring { @variant focus-visible { outline: 2px solid var(--focus-ring); } }`,
      count: 0,
    },
    {
      name: "outline removed in @variant focus-visible",
      code: `.a { @variant focus-visible { outline: none; } }`,
      count: 1,
    },
    {
      name: "outline nested in @media and @layer",
      code: `@media (width >= 40rem) { @layer utilities { .a { outline: none; } } }`,
      count: 1,
    },
  ],
};

const UNFLAGGED_CASES: RuleCaseTable<CssCase> = {
  rule: ANY_PRAGMATIKS_RULE,
  cases: [
    { name: "globals.css:234 reduced motion", code: REDUCED_MOTION, count: 0 },
    {
      name: "custom property holding a block",
      code: `:root { --data: {"a":1}; }`,
      count: 0,
    },
    {
      name: "@custom-variant and @theme inline",
      code: `@custom-variant dark (&:where(.dark, .dark *));
@theme inline { --color-surface: var(--color-brand); }
`,
      count: 0,
    },
  ],
};

const MOTION_CASES: RuleCaseTable<CssCase> = {
  rule: "pragmatiks/css-animated-properties",
  cases: [
    { name: "transition all", code: `.a { transition: all 1s; }`, count: 1 },
    {
      name: "transition of paint properties",
      code: `.a { transition: opacity 1s, transform 1s ease; }`,
      count: 0,
    },
    {
      name: "transition-property height",
      code: `.a { transition-property: height; }`,
      count: 1,
    },
    { name: "transition none", code: `.a { transition: none; }`, count: 0 },
    {
      name: "keyframes animating width",
      code: `@keyframes grow { to { width: 10rem; } }`,
      count: 1,
    },
    {
      name: "animation naming theme keyframes that animate width",
      code: `.a { animation: grow 1s; }`,
      count: 1,
    },
    {
      name: "animation-name quoting theme keyframes that animate width",
      code: `.a { animation-name: "grow"; }`,
      count: 1,
    },
    {
      name: "keyframes animating opacity",
      code: `@keyframes fade { to { opacity: 1; } }`,
      count: 0,
    },
  ],
};

const VIEWPORT_CASES: RuleCaseTable<CssCase> = {
  rule: "pragmatiks/css-viewport-units",
  cases: [
    { name: "height 100vh", code: `.a { height: 100vh; }`, count: 1 },
    {
      name: "vh in a var fallback",
      code: `.a { min-height: var(--full-height, 100vh); }`,
      count: 1,
    },
    {
      name: "vh in a custom property",
      code: `:root { --full-height: 100vh; }`,
      count: 1,
    },
    {
      name: "vh inside @layer",
      code: `@layer components { .a { height: calc(100vh - 4rem); } }`,
      count: 1,
    },
    {
      name: "vh in @property initial-value",
      code: `@property --full-height { syntax: "<length>"; inherits: false; initial-value: 100vh; }`,
      count: 1,
    },
    { name: "height 100dvh", code: `.a { height: 100dvh; }`, count: 0 },
  ],
};

const Z_INDEX_CASES: RuleCaseTable<CssCase> = {
  rule: "pragmatiks/css-z-index",
  cases: [
    { name: "z-index 60", code: `.a { z-index: 60; }`, count: 1 },
    {
      name: "z-index 99 inside @media",
      code: `@media (width >= 40rem) { .a { z-index: 99; } }`,
      count: 1,
    },
    { name: "z-index 50", code: `.a { z-index: 50; }`, count: 0 },
    {
      name: "z-index var and auto",
      code: `.a { z-index: var(--layer-overlay); } .b { z-index: auto; }`,
      count: 0,
    },
    {
      name: "z-index theme variable above the cap",
      code: `.a { z-index: var(--z-index-top); }`,
      count: 1,
    },
    {
      name: "z-index var fallback above the cap",
      code: `.a { z-index: var(--layer-overlay, 99); }`,
      count: 1,
    },
    {
      name: "z-index negative calc",
      code: `.a { z-index: calc(10 * -1); }`,
      count: 0,
    },
  ],
};

const COLOR_CASES: RuleCaseTable<CssCase> = {
  rule: "pragmatiks/css-color-tokens",
  cases: [
    {
      name: "default palette variable",
      code: `.a { color: var(--color-amber-500); }`,
      count: 1,
    },
    {
      name: "project color variable",
      code: `.a { color: var(--color-brand); }`,
      count: 0,
    },
    {
      name: "default palette color in a var fallback",
      code: `.a { color: var(--text, var(--color-amber-500)); }`,
      count: 1,
    },
    {
      name: "default palette color through theme()",
      code: `.a { color: theme(--color-red-500); }`,
      count: 1,
    },
    {
      name: "@theme aliasing a default palette color",
      code: `@theme { --color-danger: var(--color-red-500); }`,
      count: 0,
    },
  ],
};

const NO_APPLY_CASES: RuleCaseTable<CssCase> = {
  rule: "pragmatiks/css-no-apply",
  cases: [{ name: "@apply", code: `.a { @apply bg-brand; }`, count: 1 }],
};

const PARSED_FULLY_CASES: RuleCaseTable<CssCase> = {
  rule: "pragmatiks/css-parsed-fully",
  cases: [
    {
      name: "@utility mixing declarations and nested rules",
      code: `@utility glass {
  color: var(--color-brand);
  &:hover { opacity: 0.5; }
  backdrop-filter: blur(4px);
}
`,
      count: 2,
    },
    {
      name: "@utility whose declarations precede a nested rule",
      code: `@utility glass {
  outline: none;
  &:hover { opacity: 0.5; }
}
`,
      count: 1,
    },
  ],
};

const CSS_CASES = flattenCaseTables([
  FOCUS_CASES,
  MOTION_CASES,
  VIEWPORT_CASES,
  Z_INDEX_CASES,
  COLOR_CASES,
  NO_APPLY_CASES,
  PARSED_FULLY_CASES,
  UNFLAGGED_CASES,
]);

const linter = registerNextFixtureLinter("css");

describe("AC-4 CSS integration", () => {
  it.each(CSS_CASES)(
    "$rule: $name gives $count",
    async ({ code, rule, count }) => {
      const messageCount = await linter.countRuleMessages(code, rule);
      expect(messageCount).toBe(count);
    },
  );
});
