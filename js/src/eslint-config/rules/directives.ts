/**
 * Recognizes bare tool directives, the only comments principle 10 keeps.
 *
 * @packageDocumentation
 */

/**
 * A comma-separated list of rule names an ESLint directive may carry.
 */
const RULE_LIST = String.raw`[\w@/.-]+(?:\s*,\s*[\w@/.-]+)*`;

/**
 * A list of global or exported names a `global(s)` or `exported` directive may carry.
 */
const NAME_LIST = String.raw`[\w$:-]+(?:[\s,]+[\w$:-]+)*`;

/**
 * The opening of a triple-slash reference after its `//`.
 */
const TRIPLE_SLASH_PREFIX = "/ <reference ";

/**
 * The closing of a triple-slash reference.
 */
const TRIPLE_SLASH_SUFFIX = "/>";

/**
 * The separator that starts a directive's description.
 */
const DESCRIPTION_SEPARATOR = "--";

/**
 * The TypeScript directive kept in a JavaScript or TypeScript comment.
 */
const TS_EXPECT_ERROR = "@ts-expect-error";

/**
 * Directives ESLint reads from any comment, each matched against the whole trimmed comment text.
 */
const ESLINT_DIRECTIVES: readonly RegExp[] = [
  new RegExp(
    String.raw`^eslint-(?:disable(?:-next-line|-line)?|enable)(?:\s+${RULE_LIST})?$`,
  ),
  new RegExp(String.raw`^(?:globals?|exported)\s+${NAME_LIST}$`),
  /^eslint\s+\S[\s\S]*$/,
];

/**
 * Tells whether a comment's text is a bare ESLint directive.
 *
 * Note: a directive carrying a `-- description` is not bare; its rationale belongs in the owning
 * docstring.
 *
 * @param text - The comment text without its delimiters.
 * @returns `true` when the text is an ESLint directive with no description.
 */
export function isBareEslintDirective(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.includes(DESCRIPTION_SEPARATOR)) {
    return false;
  }
  return ESLINT_DIRECTIVES.some((pattern) => pattern.test(trimmed));
}

/**
 * Tells whether a line comment's trimmed text is a triple-slash reference.
 *
 * @param trimmed - The trimmed text after `//`.
 * @returns `true` for `/ <reference ... />` holding no other `>`.
 */
function isTripleSlashReference(trimmed: string): boolean {
  return (
    trimmed.startsWith(TRIPLE_SLASH_PREFIX) &&
    trimmed.endsWith(TRIPLE_SLASH_SUFFIX) &&
    trimmed.indexOf(">") === trimmed.length - 1
  );
}

/**
 * Tells whether a JavaScript or TypeScript comment's text is a bare tool directive.
 *
 * @param text - The comment text without its delimiters.
 * @param isLine - Whether the comment is a `//` line comment, the only form a triple-slash
 *   reference takes.
 * @returns `true` when the text is a bare ESLint, TypeScript or triple-slash directive.
 */
export function isBareScriptDirective(text: string, isLine: boolean): boolean {
  const trimmed = text.trim();
  if (isLine && isTripleSlashReference(trimmed)) {
    return true;
  }
  return (
    trimmed === TS_EXPECT_ERROR ||
    isBareEslintDirective(trimmed)
  );
}
