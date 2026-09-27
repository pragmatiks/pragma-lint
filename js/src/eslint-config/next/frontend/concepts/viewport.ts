/**
 * Detects the `vh` unit in declarations.
 *
 * @packageDocumentation
 */
import { type Declaration, listValueNodes } from "../css-declarations.js";

/**
 * Report message for a `vh` finding, with a `source` placeholder.
 */
export const VH_UNIT_MESSAGE =
  "{{source}} uses vh, which ignores mobile browser chrome; use dvh, svh or lvh, such as h-dvh or min-h-svh.";

/**
 * Tells whether a declaration uses the `vh` unit anywhere, including `var()` fallbacks.
 *
 * Only `vh` itself matches, in any letter case; the `dvh`, `svh` and `lvh` replacements do not.
 *
 * @param declaration - Any declaration.
 * @returns `true` when a `vh` dimension appears in the value.
 */
export function usesVhUnit(declaration: Declaration): boolean {
  return listValueNodes(declaration.value).some(
    (node) => node.type === "Dimension" && node.unit.toLowerCase() === "vh",
  );
}
