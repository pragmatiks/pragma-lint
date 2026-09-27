/**
 * The `color-tokens` rule: class tokens and inline styles may use project color tokens only.
 *
 * @packageDocumentation
 */
import type { Rule } from "eslint";

import { compileClassGroup } from "../class-group-declarations.js";
import {
  type ClassGroup,
  collectFrontendModel,
  type StyleLeaf,
} from "../collect.js";
import {
  canSetColor,
  containsColorLiteral,
  DEFAULT_PALETTE_MESSAGE,
  listAliasedPaletteColors,
  listDefaultPaletteColors,
} from "../concepts/color.js";
import { type Declaration, parseStyleLeaf } from "../css-declarations.js";
import type { DesignSystemView } from "../design-system.js";
import { createUniqueReporter, type Reporter } from "../report.js";

/**
 * Tells whether a token writes a color literal in an arbitrary value of a property that takes a
 * color.
 *
 * @param token - One class token.
 * @param declarations - The declarations the token compiles to.
 * @param view - The project design system that parses the token.
 * @returns `true` when an arbitrary input holds a color literal and a declaration can set a color.
 */
function hasColorLiteral(
  token: string,
  declarations: readonly Declaration[],
  view: DesignSystemView,
): boolean {
  const inputs = view
    .candidatesOf(token)
    .flatMap((candidate) => candidate.arbitraryInputs);
  return (
    inputs.some((input) => containsColorLiteral(input)) &&
    declarations.some((declaration) => canSetColor(declaration))
  );
}

/**
 * Lists the default-palette colors a token reaches through the project theme colors it names.
 *
 * @param token - One class token.
 * @param view - The project design system that parses the token.
 * @returns The default-palette `--color-*` names behind each project color a parse of the token
 *   names, such as an `@theme inline` alias of a default-palette color.
 */
function collectExemptPaletteColors(
  token: string,
  view: DesignSystemView,
): Set<string> {
  return new Set(
    view
      .candidatesOf(token)
      .flatMap((candidate) => listAliasedPaletteColors(candidate, view)),
  );
}

/**
 * Reports the color literals and default palette colors of every token in a class group, except
 * the palette colors behind a project theme color the token names.
 *
 * @param report - The reporter to send diagnostics to.
 * @param group - One class group.
 * @param view - The project design system.
 */
function checkClassGroup(
  report: Reporter,
  group: ClassGroup,
  view: DesignSystemView,
): void {
  for (const { token, declarations } of compileClassGroup(group, view)) {
    if (hasColorLiteral(token, declarations, view)) {
      report({
        node: group.node,
        messageId: "literal",
        data: { source: token },
      });
    }
    const exemptVariables = collectExemptPaletteColors(token, view);
    for (const declaration of declarations) {
      const paletteColors = listDefaultPaletteColors(declaration.value, view);
      const variables = paletteColors.filter(
        (variable) => !exemptVariables.has(variable),
      );
      for (const variable of variables) {
        report({
          node: group.node,
          messageId: "defaultPalette",
          data: { source: token, variable },
        });
      }
    }
  }
}

/**
 * Reports the default palette colors an inline style leaf uses.
 *
 * @param report - The reporter to send diagnostics to.
 * @param leaf - One inline style leaf.
 * @param view - The project design system.
 */
function checkStyleLeaf(
  report: Reporter,
  leaf: StyleLeaf,
  view: DesignSystemView,
): void {
  const declaration = parseStyleLeaf(leaf);
  if (!declaration) {
    return;
  }
  const variables = listDefaultPaletteColors(declaration.value, view);
  for (const variable of variables) {
    report({
      node: leaf.node,
      messageId: "defaultPalette",
      data: { source: leaf.property, variable },
    });
  }
}

/**
 * Builds `color-tokens`: class tokens may not write color literals in arbitrary values of
 * properties that take a color, and classes and inline styles may not use Tailwind's default
 * palette.
 *
 * @param view - The project design system.
 * @returns The rule.
 */
export function createColorTokensRule(view: DesignSystemView): Rule.RuleModule {
  return {
    meta: {
      type: "problem",
      docs: { description: "Use project color tokens." },
      messages: {
        literal:
          "{{source}} writes a color literal; use a project color token such as bg-(--token).",
        defaultPalette: DEFAULT_PALETTE_MESSAGE,
      },
      schema: [],
    },
    create(context) {
      return {
        "Program:exit"() {
          const report = createUniqueReporter(context);
          const model = collectFrontendModel(context.sourceCode);
          for (const group of model.classGroups) {
            checkClassGroup(report, group, view);
          }
          for (const leaf of model.styleLeaves) {
            checkStyleLeaf(report, leaf, view);
          }
        },
      };
    },
  };
}
