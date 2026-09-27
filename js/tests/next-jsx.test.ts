/**
 * Integration tests for the JSX, inline-style, handler and restricted-syntax rules of
 * `pragmatiksNextConfig`.
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
 * One source fixture and how many messages its table's rule reports on it.
 */
interface JsxCase {
  readonly name: string;
  readonly code: string;
  readonly count: number;
  /** The fixture path relative to the project root; defaults to a numbered `.tsx` file. */
  readonly file?: string;
}

/**
 * Builds a module whose `Fixture` component returns the given JSX.
 *
 * @param jsx - The JSX the component returns.
 * @param before - Source placed above the component, such as imports or helpers.
 * @returns The fixture source.
 */
function buildComponent(jsx: string, before = ""): string {
  return `${before}
export function Fixture() {
  return ${jsx};
}
`;
}

/**
 * Builds a component that renders one `div` with the given inline style properties.
 *
 * @param style - The inline style object's properties, such as `height: "100vh"`.
 * @returns The fixture source.
 */
function buildStyledElement(style: string): string {
  return buildComponent(`<div style={{ ${style} }} />`);
}

const FOCUS_CASES: RuleCaseTable<JsxCase> = {
  rule: "pragmatiks/focus-styling",
  cases: [
    {
      name: "inline outline",
      code: buildStyledElement(`outline: "none"`),
      count: 1,
    },
    {
      name: "inline --tw-ring-shadow",
      code: buildStyledElement(`"--tw-ring-shadow": "none"`),
      count: 1,
    },
    {
      name: "inline forcedColorAdjust",
      code: buildStyledElement(`forcedColorAdjust: "none"`),
      count: 1,
    },
    {
      name: "P1 element with inline boxShadow",
      code: buildComponent(
        `<button type="button" className="${P1}" style={{ boxShadow: "none" }}>Save</button>`,
      ),
      count: 1,
    },
    {
      name: "decorative inline boxShadow",
      code: buildStyledElement(`boxShadow: "0 0 0 1px var(--edge)"`),
      count: 0,
    },
    {
      name: "inline onFocus handler writing style",
      code: buildComponent(
        `<input aria-label="Name" onFocus={(event) => { event.currentTarget.style.borderColor = "var(--edge)"; }} />`,
      ),
      count: 1,
    },
    {
      name: "onFocus handler referenced by name",
      code: buildComponent(
        `<button type="button" onFocus={handleFocus}>Save</button>`,
        `function handleFocus(event: { currentTarget: HTMLElement }) {
  event.currentTarget.style.outline = "none";
}`,
      ),
      count: 1,
    },
    {
      name: "one handler on onFocus and onBlur",
      code: buildComponent(
        `<button type="button" onFocus={toggle} onBlur={toggle}>Save</button>`,
        `const toggle = (event: { currentTarget: HTMLElement }) => {
  event.currentTarget.style.opacity = "1";
};`,
      ),
      count: 1,
    },
    {
      name: "useCallback onMouseEnter writing boxShadow on a P1 button",
      code: `import { useCallback } from "react";
export function Fixture() {
  const handleEnter = useCallback((event: { currentTarget: HTMLElement }) => {
    event.currentTarget.style.boxShadow = "none";
  }, []);
  return <button type="button" className="${P1}" onMouseEnter={handleEnter}>Save</button>;
}
`,
      count: 1,
    },
    {
      name: "inline onMouseEnter writing boxShadow on a P1 button",
      code: buildComponent(
        `<button type="button" className="${P1}" onMouseEnter={(event) => { event.currentTarget.style.boxShadow = "none"; }}>Save</button>`,
      ),
      count: 1,
    },
    {
      name: "onMouseEnter writing boxShadow on a plain element",
      code: buildComponent(
        `<div onMouseEnter={(event) => { event.currentTarget.style.boxShadow = "none"; }} />`,
      ),
      count: 0,
    },
    {
      name: "style.outline written outside a handler",
      code: `export function hide(element: HTMLElement) {
  element.style.outline = "none";
}
`,
      count: 1,
    },
    {
      name: "style.outlineColor written in an onClick handler",
      code: buildComponent(
        `<button type="button" onClick={(event) => { event.currentTarget.style.outlineColor = "red"; }}>Save</button>`,
      ),
      count: 1,
    },
    {
      name: "dynamic inline outline",
      code: buildStyledElement(`outline: String(Date.now())`),
      count: 1,
    },
    {
      name: "conditional inline outline reported once",
      code: buildStyledElement(`outline: open ? "none" : "0"`),
      count: 1,
    },
    {
      name: "inline style object asserted as const",
      code: buildComponent(`<div style={{ outline: "none" } as const} />`),
      count: 1,
    },
    {
      name: "inline style object in a ternary",
      code: buildComponent(
        `<div style={open ? { outline: "none" } : undefined} />`,
        `const open = Date.now() > 0;`,
      ),
      count: 1,
    },
    {
      name: "inline --tw-shadow reset",
      code: buildStyledElement(`"--tw-shadow": "none"`),
      count: 1,
    },
    {
      name: "P1 element with inline WebkitBoxShadow",
      code: buildComponent(
        `<button type="button" className="${P1}" style={{ WebkitBoxShadow: "none" }}>Save</button>`,
      ),
      count: 1,
    },
    {
      name: "motion whileFocus outline",
      code: buildComponent(
        `<motion.button type="button" whileFocus={{ outline: "none" }}>Save</motion.button>`,
        `import { motion } from "motion/react";`,
      ),
      count: 1,
    },
    {
      name: "motion whileFocus boxShadow",
      code: buildComponent(
        `<motion.button type="button" whileFocus={{ boxShadow: "0 0 0 2px var(--focus-ring)" }}>Save</motion.button>`,
        `import { motion } from "motion/react";`,
      ),
      count: 1,
    },
    {
      name: "motion whileFocus scale",
      code: buildComponent(
        `<motion.button type="button" whileFocus={{ scale: 1.05 }}>Save</motion.button>`,
        `import { motion } from "motion/react";`,
      ),
      count: 1,
    },
    {
      name: "motion whileFocus naming a variant with a boxShadow",
      code: buildComponent(
        `<motion.button type="button" variants={{ focused: { boxShadow: "0 0 0 2px var(--focus-ring)" } }} whileFocus="focused">Save</motion.button>`,
        `import { motion } from "motion/react";`,
      ),
      count: 1,
    },
    {
      name: "motion whileFocus naming variants in an array",
      code: buildComponent(
        `<motion.button type="button" variants={{ rest: { scale: 1 }, focused: { scale: 1.05 } }} whileFocus={["focused"]}>Save</motion.button>`,
        `import { motion } from "motion/react";`,
      ),
      count: 1,
    },
    {
      name: "motion whileFocus scale with a transition",
      code: buildComponent(
        `<motion.button type="button" whileFocus={{ scale: 1.05, transition: { duration: 0.2 } }}>Save</motion.button>`,
        `import { motion } from "motion/react";`,
      ),
      count: 1,
    },
    {
      name: "motion whileFocus naming a variant in a ternary",
      code: buildComponent(
        `<motion.button type="button" variants={{ focused: { boxShadow: "0 0 0 2px red" } }} whileFocus={on ? "focused" : undefined}>Save</motion.button>`,
        `import { motion } from "motion/react";\nconst on = true;`,
      ),
      count: 1,
    },
    {
      name: "motion whileFocus naming a variant as const",
      code: buildComponent(
        `<motion.button type="button" variants={{ focused: { boxShadow: "0 0 0 2px red" } }} whileFocus={"focused" as const}>Save</motion.button>`,
        `import { motion } from "motion/react";`,
      ),
      count: 1,
    },
    {
      name: "motion whileFocus naming variants in an array as const",
      code: buildComponent(
        `<motion.button type="button" variants={{ focused: { boxShadow: "0 0 0 2px red" } }} whileFocus={["focused"] as const}>Save</motion.button>`,
        `import { motion } from "motion/react";`,
      ),
      count: 1,
    },
    {
      name: "motion whileHover naming a variant with a boxShadow",
      code: buildComponent(
        `<motion.button type="button" variants={{ hovered: { boxShadow: "0 0 0 2px var(--focus-ring)" } }} whileHover="hovered">Save</motion.button>`,
        `import { motion } from "motion/react";`,
      ),
      count: 0,
    },
    {
      name: "motion whileHover boxShadow",
      code: buildComponent(
        `<motion.button type="button" whileHover={{ boxShadow: "0 0 0 2px var(--focus-ring)" }}>Save</motion.button>`,
        `import { motion } from "motion/react";`,
      ),
      count: 0,
    },
    {
      name: "class helper object key",
      code: buildComponent(
        `<div className={cn({ "outline-none": active })} />`,
        `const active = Date.now() > 0;
const cn = (...values: unknown[]) => String(values);`,
      ),
      count: 1,
    },
    {
      name: "prose prop naming a utility",
      code: buildComponent(
        `<Button variant="outline" />`,
        `function Button(props: { variant: string }) {
  return props.variant;
}`,
      ),
      count: 0,
    },
    {
      name: "onFocusCapture handler writing style",
      code: buildComponent(
        `<div onFocusCapture={(event) => { event.currentTarget.style.opacity = "1"; }} />`,
      ),
      count: 1,
    },
    {
      name: "style.forcedColorAdjust written outside a handler",
      code: `export function reset(element: HTMLElement) {
  element.style.forcedColorAdjust = "none";
}
`,
      count: 1,
    },
    {
      name: "useCallback wrapping a named handler on a P1 button",
      code: `import { useCallback } from "react";
function paint(event: { currentTarget: HTMLElement }) {
  event.currentTarget.style.boxShadow = "none";
}
export function Fixture() {
  const handleEnter = useCallback(paint, []);
  return <button type="button" className="${P1}" onMouseEnter={handleEnter}>Save</button>;
}
`,
      count: 1,
    },
    {
      name: "inline handler delegating to a named function on a P1 button",
      code: buildComponent(
        `<button type="button" className="${P1}" onMouseEnter={(event) => paint(event)}>Save</button>`,
        `function paint(event: { currentTarget: HTMLElement }) {
  event.currentTarget.style.boxShadow = "none";
}`,
      ),
      count: 1,
    },
    {
      name: "inline handler writing boxShadow in the arguments of a named call on a P1 button",
      code: buildComponent(
        `<button type="button" className="${P1}" onMouseEnter={(event) => track(event.currentTarget.style.boxShadow = "none")}>Save</button>`,
        `function track(value: string) {
  return value.length;
}`,
      ),
      count: 1,
    },
    {
      name: "inline handler writing boxShadow in the arguments of a no-op on a P1 button",
      code: buildComponent(
        `<button type="button" className="${P1}" onMouseEnter={(event) => noop(event.currentTarget.style.boxShadow = "none")}>Save</button>`,
        `function noop(value: string) {}`,
      ),
      count: 1,
    },
    {
      name: "motion whileFocus resetting --tw-shadow",
      code: buildComponent(
        `<motion.button type="button" whileFocus={{ "--tw-shadow": "none" }}>Save</motion.button>`,
        `import { motion } from "motion/react";`,
      ),
      count: 1,
    },
  ],
};

const MOTION_CASES: RuleCaseTable<JsxCase> = {
  rule: "pragmatiks/animated-properties",
  cases: [
    {
      name: "transition all",
      code: buildStyledElement(`transition: "all 0.2s"`),
      count: 1,
    },
    {
      name: "transition opacity",
      code: buildStyledElement(`transition: "opacity 0.2s"`),
      count: 0,
    },
    {
      name: "WebkitTransition all",
      code: buildStyledElement(`WebkitTransition: "all 1s"`),
      count: 1,
    },
    {
      name: "transition none",
      code: buildStyledElement(`transition: "none"`),
      count: 0,
    },
    {
      name: "transition inherit",
      code: buildStyledElement(`transition: "inherit"`),
      count: 0,
    },
    {
      name: "transition without property",
      code: buildStyledElement(`transition: "1s"`),
      count: 1,
    },
    {
      name: "transition width",
      code: buildStyledElement(`transition: "width 1s"`),
      count: 1,
    },
    {
      name: "transition list with height",
      code: buildStyledElement(`transition: "opacity 1s, height 1s"`),
      count: 1,
    },
    {
      name: "transitionProperty height",
      code: buildStyledElement(`transitionProperty: "height"`),
      count: 1,
    },
    {
      name: "transition var only",
      code: buildStyledElement(`transition: "var(--transition)"`),
      count: 1,
    },
    {
      name: "transition with var duration",
      code: buildStyledElement(`transition: "opacity var(--duration) ease"`),
      count: 0,
    },
    {
      name: "transition of a custom property",
      code: buildStyledElement(`transition: "--progress 1s"`),
      count: 0,
    },
    {
      name: "conditional transition",
      code: buildStyledElement(`transition: open ? "width 1s" : "none"`),
      count: 1,
    },
    {
      name: "motion animate and whileHover layout keys",
      code: buildComponent(
        `<motion.div animate={{ height: 0 }} whileHover={{ width: 10, opacity: 1 }} />`,
        `import { motion } from "motion/react";`,
      ),
      count: 2,
    },
    {
      name: "motion variants with layout keys",
      code: buildComponent(
        `<motion.div variants={{ open: { height: "auto" }, closed: { height: 0 } }} />`,
        `import { motion } from "motion/react";`,
      ),
      count: 2,
    },
    {
      name: "conditional motion animate with layout keys",
      code: buildComponent(
        `<motion.div animate={open ? { height: "auto" } : { height: 0 }} />`,
        `import { motion } from "motion/react";
const open = Date.now() > 0;`,
      ),
      count: 2,
    },
    {
      name: "layout transition class in an interpolated template className",
      code: buildComponent(
        "<div className={`h-screen transition-[width] ${String(Date.now())}`} />",
      ),
      count: 1,
    },
  ],
};

const VIEWPORT_CASES: RuleCaseTable<JsxCase> = {
  rule: "pragmatiks/viewport-units",
  cases: [
    {
      name: "height 100vh",
      code: buildStyledElement(`height: "100vh"`),
      count: 1,
    },
    {
      name: "vh in a var fallback",
      code: buildStyledElement(`minHeight: "var(--full-height, 100vh)"`),
      count: 1,
    },
    {
      name: "vh class in an interpolated template className",
      code: buildComponent(
        "<div className={`h-screen transition-[width] ${String(Date.now())}`} />",
      ),
      count: 1,
    },
    {
      name: "vh in a static template style value",
      code: buildStyledElement("height: `100vh`"),
      count: 1,
    },
    {
      name: "height 100dvh",
      code: buildStyledElement(`height: "100dvh"`),
      count: 0,
    },
  ],
};

const Z_INDEX_CASES: RuleCaseTable<JsxCase> = {
  rule: "pragmatiks/z-index",
  cases: [
    { name: "zIndex 60", code: buildStyledElement(`zIndex: 60`), count: 1 },
    { name: "zIndex 10", code: buildStyledElement(`zIndex: 10`), count: 0 },
    {
      name: "zIndex var",
      code: buildStyledElement(`zIndex: "var(--layer-overlay)"`),
      count: 0,
    },
    {
      name: "zIndex theme variable above the cap",
      code: buildStyledElement(`zIndex: "var(--z-index-top)"`),
      count: 1,
    },
  ],
};

const COLOR_CASES: RuleCaseTable<JsxCase> = {
  rule: "pragmatiks/color-tokens",
  cases: [
    {
      name: "default palette variable",
      code: buildStyledElement(`color: "var(--color-amber-500)"`),
      count: 1,
    },
    {
      name: "project color variable",
      code: buildStyledElement(`color: "var(--color-brand)"`),
      count: 0,
    },
    {
      name: "default palette variable in a var fallback",
      code: buildStyledElement(`color: "var(--text, var(--color-amber-500))"`),
      count: 1,
    },
  ],
};

const LABEL_CASES: RuleCaseTable<JsxCase> = {
  rule: "pragmatiks/form-control-has-label",
  cases: [
    { name: "bare input", code: buildComponent(`<input />`), count: 1 },
    {
      name: "aria-label undefined",
      code: buildComponent(`<input aria-label={undefined} />`),
      count: 1,
    },
    {
      name: "empty aria-label",
      code: buildComponent(`<input aria-label="" />`),
      count: 1,
    },
    {
      name: "valueless aria-label",
      code: buildComponent(`<input aria-label />`),
      count: 1,
    },
    {
      name: "aria-label",
      code: buildComponent(`<input aria-label="Name" />`),
      count: 0,
    },
    {
      name: "wrapping label",
      code: buildComponent(`<label>Name <input /></label>`),
      count: 0,
    },
    {
      name: "wrapping label for another id",
      code: buildComponent(
        `<label htmlFor="other">Name <input id="name" /></label>`,
      ),
      count: 1,
    },
    {
      name: "sibling label",
      code: buildComponent(
        `<><label htmlFor="name">Name</label><input id="name" /></>`,
      ),
      count: 0,
    },
    {
      name: "sibling label through a const",
      code: buildComponent(
        `<><label htmlFor={fieldId}>Email</label><input id={fieldId} /></>`,
        `const fieldId = "email";`,
      ),
      count: 0,
    },
    {
      name: "label in another component",
      code: `export function Label() {
  return <label htmlFor="name">Name</label>;
}
export function Field() {
  return <input id="name" />;
}
`,
      count: 1,
    },
    {
      name: "hidden input",
      code: buildComponent(`<input type="hidden" />`),
      count: 0,
    },
    {
      name: "spread props",
      code: buildComponent(
        `<input {...fieldProps} />`,
        `const fieldProps = {};`,
      ),
      count: 0,
    },
    {
      name: "textarea with placeholder only",
      code: buildComponent(`<textarea placeholder="Notes" />`),
      count: 1,
    },
    { name: "select", code: buildComponent(`<select />`), count: 1 },
    {
      name: "second control inside a wrapping label",
      code: buildComponent(`<label>Name <input /><input /></label>`),
      count: 1,
    },
    {
      name: "one control on each branch of a conditional inside a wrapping label",
      code: buildComponent(
        `<label>Name{flag ? <input /> : <textarea />}</label>`,
        `const flag = Date.now() > 0;`,
      ),
      count: 0,
    },
    {
      name: "field component pairing through a prop",
      code: `export function Field({ id }: { id: string }) {
  return <><label htmlFor={id}>Name</label><input id={id} /></>;
}
`,
      count: 0,
    },
    {
      name: "useId template id",
      code: `import { useId } from "react";
export function Field() {
  const id = useId();
  return <><label htmlFor={\`\${id}-email\`}>Email</label><input id={\`\${id}-email\`} /></>;
}
`,
      count: 0,
    },
  ],
};

const ASSOCIATED_LABEL_CASES: RuleCaseTable<JsxCase> = {
  rule: "jsx-a11y/control-has-associated-label",
  cases: [
    {
      name: "labelled select",
      code: buildComponent(
        `<><label htmlFor="shade">Shade</label><select id="shade" /></>`,
      ),
      count: 0,
    },
    {
      name: "empty button",
      code: buildComponent(`<button type="button" />`),
      count: 1,
    },
  ],
};

const EMBEDDED_STYLE_CASES: RuleCaseTable<JsxCase> = {
  rule: "pragmatiks/no-embedded-style",
  cases: [
    {
      name: "JSX style element",
      code: buildComponent(`<style>{"a { color: red }"}</style>`),
      count: 1,
    },
  ],
};

const RESTRICTED_SYNTAX_CASES: RuleCaseTable<JsxCase> = {
  rule: "no-restricted-syntax",
  cases: [
    {
      name: "three dots in JSX text",
      code: buildComponent(`<p>Loading...</p>`),
      count: 1,
    },
    {
      name: "three dots in a string",
      code: `export const label = "Saving...";\n`,
      count: 1,
    },
    {
      name: "three dots in a template",
      code: "export const label = `Saving ${String(1)} files...`;\n",
      count: 1,
    },
    {
      name: "three dots in an href",
      code: buildComponent(
        `<a href="https://example.com/compare/a...b">Diff</a>`,
      ),
      count: 0,
    },
    {
      name: "ellipsis glyph",
      code: buildComponent(`<p>Loading…</p>`),
      count: 0,
    },
    {
      name: "paste blocked",
      code: buildComponent(
        `<input aria-label="Code" onPaste={(event) => event.preventDefault()} />`,
      ),
      count: 1,
    },
    {
      name: "zoom disabled",
      code: `export const viewport = { userScalable: false, maximumScale: 1 };
`,
      count: 2,
    },
    {
      name: "zoom disabled with quoted keys",
      code: `export const viewport = { "userScalable": false, "maximumScale": 1 };
`,
      count: 2,
    },
    {
      name: "Google Fonts link",
      code: buildComponent(
        `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter" />`,
      ),
      count: 1,
    },
    {
      name: "placeholder copy",
      code: buildComponent(`<p>Lorem ipsum dolor sit amet</p>`),
      count: 1,
    },
  ],
};

const RESTRICTED_IMPORTS_CASES: RuleCaseTable<JsxCase> = {
  rule: "no-restricted-imports",
  cases: [
    {
      name: "forwardRef import",
      code: `import { forwardRef } from "react";
export const wrap = forwardRef;
`,
      count: 1,
    },
    {
      name: "second icon family",
      code: `import { Check } from "lucide-react";
export const icon = Check;
`,
      count: 1,
    },
    {
      name: "the project icon family",
      code: `import { Check } from "@phosphor-icons/react";
export const icon = Check;
`,
      count: 0,
    },
    {
      name: "react-icons subpath",
      code: `import { FaBeer } from "react-icons/fa";
export const icon = FaBeer;
`,
      count: 1,
    },
  ],
};

const RESTRICTED_PROPERTIES_CASES: RuleCaseTable<JsxCase> = {
  rule: "no-restricted-properties",
  cases: [
    {
      name: "React.forwardRef",
      code: `import React from "react";
export const wrap = React.forwardRef;
`,
      count: 1,
    },
  ],
};

const ALERT_CASES: RuleCaseTable<JsxCase> = {
  rule: "no-alert",
  cases: [
    {
      name: "alert",
      code: `export function warn() {
  alert("Saved");
}
`,
      count: 1,
    },
  ],
};

const ALT_TEXT_CASES: RuleCaseTable<JsxCase> = {
  rule: "jsx-a11y/alt-text",
  cases: [
    {
      name: "img without alt",
      code: buildComponent(`<img src="/logo.png" />`),
      count: 1,
    },
  ],
};

const AUTOFOCUS_CASES: RuleCaseTable<JsxCase> = {
  rule: "jsx-a11y/no-autofocus",
  cases: [
    {
      name: "autoFocus on a DOM element",
      code: buildComponent(`<input aria-label="Search" autoFocus />`),
      count: 1,
    },
    {
      name: "autoFocus on a component",
      code: buildComponent(
        `<Search autoFocus />`,
        `function Search(props: { autoFocus: boolean }) {
  return props.autoFocus;
}`,
      ),
      count: 0,
    },
  ],
};

const LEAKED_RENDER_CASES: RuleCaseTable<JsxCase> = {
  rule: "react-x/no-leaked-conditional-rendering",
  cases: [
    {
      name: "leaked number render",
      code: `export function Fixture({ count }: { count: number }) {
  return <div>{count && <span>items</span>}</div>;
}
`,
      count: 1,
    },
  ],
};

const FILENAME_CASE_CASES: RuleCaseTable<JsxCase> = {
  rule: "unicorn/filename-case",
  cases: [
    {
      name: "snake_case file name",
      code: `export const value = 1;\n`,
      count: 1,
      file: "app/snake_case_name.ts",
    },
    {
      name: "PascalCase file name",
      code: `export const value = 1;\n`,
      count: 0,
      file: "app/SaveButton.tsx",
    },
  ],
};

const USELESS_UNDEFINED_CASES: RuleCaseTable<JsxCase> = {
  rule: "unicorn/no-useless-undefined",
  cases: [
    {
      name: "undefined argument",
      code: `export function reset(set: (value: unknown) => void) {
  set(undefined);
}
`,
      count: 0,
    },
  ],
};

const JSX_CASES = flattenCaseTables([
  FOCUS_CASES,
  MOTION_CASES,
  VIEWPORT_CASES,
  Z_INDEX_CASES,
  COLOR_CASES,
  LABEL_CASES,
  ASSOCIATED_LABEL_CASES,
  EMBEDDED_STYLE_CASES,
  RESTRICTED_SYNTAX_CASES,
  RESTRICTED_IMPORTS_CASES,
  RESTRICTED_PROPERTIES_CASES,
  ALERT_CASES,
  ALT_TEXT_CASES,
  AUTOFOCUS_CASES,
  LEAKED_RENDER_CASES,
  FILENAME_CASE_CASES,
  USELESS_UNDEFINED_CASES,
]);

const linter = registerNextFixtureLinter("tsx");

describe("AC-1 JSX, inline styles, handlers and restricted syntax", () => {
  it.each(JSX_CASES)(
    "$rule: $name gives $count",
    async ({ code, rule, count, file }) => {
      const messageCount = await linter.countRuleMessages(code, rule, file);
      expect(messageCount).toBe(count);
    },
  );
});
