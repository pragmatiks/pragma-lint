/**
 * Compiles class groups into the declarations of their tokens.
 *
 * @packageDocumentation
 */
import type { ClassGroup } from "./collect.js";
import type { Declaration } from "./css-declarations.js";
import type { DesignSystemView } from "./design-system.js";

/**
 * The compiled declarations of one class token.
 */
export interface TokenDeclarations {
  /** The class token. */
  readonly token: string;
  /** The declarations the token compiles to. */
  readonly declarations: readonly Declaration[];
}

/**
 * Compiles every token of a class group, skipping words that are not Tailwind classes.
 *
 * @param group - One class group.
 * @param view - The project design system.
 * @returns One entry per token that compiles.
 */
export function compileClassGroup(
  group: ClassGroup,
  view: DesignSystemView,
): TokenDeclarations[] {
  return group.tokens.flatMap((token) => {
    const declarations = view.declarationsOf(token);
    return declarations ? [{ token, declarations }] : [];
  });
}
