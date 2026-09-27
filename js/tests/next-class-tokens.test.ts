/**
 * Integration tests for the class-token rules of `pragmatiksNextConfig`, compiled by the fixture
 * project's Tailwind design system.
 *
 * @packageDocumentation
 */
import { describe, expect, it } from "vitest";

import {
  flattenCaseTables,
  P1,
  registerNextFixtureLinter,
  type RuleCaseTable,
} from "./next-project.js";

/**
 * One class string and how many messages its table's rule reports on it.
 */
interface ClassCase {
  readonly classes: string;
  readonly count: number;
}

const FOCUS_CASES: RuleCaseTable<ClassCase> = {
  rule: "pragmatiks/focus-styling",
  cases: [
    { classes: P1, count: 0 },
    {
      classes: `${P1} focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-black`,
      count: 0,
    },
    { classes: `${P1} focus-visible:ring-(--focus-ring)`, count: 0 },
    {
      classes:
        "focus-visible:outline-hidden focus-visible:ring focus-visible:ring-[var(--focus-ring)]",
      count: 0,
    },
    { classes: `${P1} focus-visible:ring-focus`, count: 0 },
    {
      classes: `${P1} focus-visible:ring-brand focus-visible:ring-offset-2`,
      count: 1,
    },
    { classes: "ring-2 focus-visible:outline-hidden", count: 1 },
    { classes: "focus-visible:outline-hidden", count: 1 },
    { classes: "outline-none", count: 1 },
    { classes: "focus:outline-hidden focus:ring-2", count: 1 },
    { classes: "focus-within:underline", count: 1 },
    { classes: "forced-color-adjust-none", count: 1 },
    { classes: `${P1} focus-visible:ring-amber-500`, count: 1 },
    { classes: `${P1} focus-visible:ring-current/0`, count: 1 },
    { classes: `${P1} focus-visible:ring-brand/50`, count: 1 },
    { classes: `${P1} focus-visible:ring-offset-[-2px]`, count: 1 },
    { classes: `${P1} focus-visible:ring-offset-0`, count: 0 },
    {
      classes: `${P1} focus-visible:ring-offset-0 focus-visible:ring-offset-brand`,
      count: 0,
    },
    {
      classes: "focus-visible:outline-hidden focus-visible:inset-ring-2",
      count: 1,
    },
    {
      classes:
        "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-4",
      count: 1,
    },
    { classes: "focus-visible:outline-hidden focus-visible:!ring-2", count: 1 },
    {
      classes: "hover:focus-visible:outline-hidden focus-visible:ring-2",
      count: 1,
    },
    { classes: "ring-1", count: 1 },
    { classes: "[box-shadow:none]", count: 1 },
    { classes: "[box-shadow:none]!", count: 1 },
    { classes: "shadow-[none]", count: 1 },
    { classes: "[--tw-shadow:none]", count: 1 },
    { classes: "!shadow-sm", count: 0 },
    { classes: "shadow-none", count: 0 },
    { classes: "shadow-md shadow-brand", count: 0 },
    { classes: "[all:unset]", count: 1 },
    { classes: "[&:focus-visible]:underline", count: 1 },
    { classes: "outline-2 outline-brand", count: 1 },
    { classes: "rounded-md bg-brand px-2 text-white", count: 0 },
  ],
};

const MOTION_CASES: RuleCaseTable<ClassCase> = {
  rule: "pragmatiks/animated-properties",
  cases: [
    { classes: "transition-all", count: 1 },
    { classes: "transition", count: 0 },
    {
      classes: "transition-colors transition-opacity transition-transform",
      count: 0,
    },
    { classes: "transition-[height]", count: 1 },
    { classes: "transition-[opacity,transform]", count: 0 },
    { classes: "transition-(--motion-properties)", count: 1 },
    { classes: "animate-grow", count: 1 },
    { classes: "animate-spin animate-pulse", count: 0 },
    { classes: "[transition:width_1s]", count: 1 },
  ],
};

const VIEWPORT_CASES: RuleCaseTable<ClassCase> = {
  rule: "pragmatiks/viewport-units",
  cases: [
    { classes: "h-screen", count: 1 },
    { classes: "min-h-screen", count: 1 },
    { classes: "h-dvh min-h-svh", count: 0 },
    { classes: "h-[calc(100vh-4rem)]", count: 1 },
    { classes: "w-screen", count: 0 },
  ],
};

const Z_INDEX_CASES: RuleCaseTable<ClassCase> = {
  rule: "pragmatiks/z-index",
  cases: [
    { classes: "z-60", count: 1 },
    { classes: "z-50", count: 0 },
    { classes: "-z-10", count: 0 },
    { classes: "z-[100]", count: 1 },
    { classes: "z-auto", count: 0 },
    { classes: "!z-60", count: 1 },
    { classes: "z-(--layer-overlay)", count: 0 },
    { classes: "z-top", count: 1 },
    { classes: "z-[var(--layer-overlay,99)]", count: 1 },
  ],
};

const COLOR_CASES: RuleCaseTable<ClassCase> = {
  rule: "pragmatiks/color-tokens",
  cases: [
    { classes: "bg-[#fff]", count: 1 },
    { classes: "text-[red]", count: 1 },
    { classes: "bg-[rgb(0_0_0/0.5)]", count: 1 },
    { classes: "bg-[rgb(var(--r)_var(--g)_var(--b)/0.5)]", count: 1 },
    { classes: "bg-[rgb(var(--r)_var(--g)_var(--b)/var(--alpha))]", count: 0 },
    { classes: "bg-[oklch(from_var(--brand)_l_c_h)]", count: 0 },
    { classes: "bg-[oklch(from_var(--brand)_calc(l*0.8)_c_h)]", count: 1 },
    { classes: "bg-[oklch(from_var(--brand)_l_c_h/0.5)]", count: 1 },
    { classes: "bg-[color-mix(in_oklab,var(--brand),transparent)]", count: 0 },
    { classes: "bg-[color-mix(in_oklab,var(--brand)_40%,#000)]", count: 1 },
    { classes: "content-['Red']", count: 0 },
    { classes: "bg-brand/50 text-white border-black", count: 0 },
    { classes: "bg-transparent text-current border", count: 0 },
    { classes: "bg-amber-500", count: 1 },
    { classes: "bg-amber-500 hover:bg-amber-500", count: 2 },
    { classes: "shadow-md ring-1", count: 0 },
    { classes: "bg-[var(--surface,#fff)]", count: 1 },
    { classes: "[grid-area:red]", count: 0 },
    { classes: "animate-[red_1s]", count: 0 },
    { classes: "[view-transition-name:blue]", count: 0 },
    { classes: "[grid-area:var(--area,red)]", count: 0 },
    { classes: "[font-family:var(--font,red)]", count: 0 },
    { classes: "bg-danger", count: 0 },
    { classes: "tone-brand", count: 1 },
    { classes: "tone-danger", count: 1 },
  ],
};

const CLASS_CASES = flattenCaseTables([
  FOCUS_CASES,
  MOTION_CASES,
  VIEWPORT_CASES,
  Z_INDEX_CASES,
  COLOR_CASES,
]);

const linter = registerNextFixtureLinter("tsx");

/**
 * Builds a component that renders one button with the given classes.
 *
 * @param classes - The `className` value.
 * @returns The fixture source.
 */
function buildButton(classes: string): string {
  return `export function Fixture() {
  return <button type="button" className="${classes}">Save</button>;
}
`;
}

describe("AC-1 class tokens compiled by Tailwind 4.3.3", () => {
  it.each(CLASS_CASES)(
    "$rule: `$classes` gives $count",
    async ({ classes, rule, count }) => {
      const messageCount = await linter.countRuleMessages(
        buildButton(classes),
        rule,
      );
      expect(messageCount).toBe(count);
    },
  );
});
