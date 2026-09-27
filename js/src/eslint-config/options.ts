export const COMPLEXITY_OPTS = 10;

export const MAX_LINES_PER_FUNCTION_OPTS = {
  max: 50,
  skipBlankLines: true,
  skipComments: true,
};

export const MAX_STATEMENTS_OPTS = 15;

export const MAX_DEPTH_OPTS = 4;

export const MAX_PARAMS_OPTS = 4;

export const PREVENT_ABBREVIATIONS_OPTS = {
  allowList: {
    id: true,
    url: true,
    uri: true,
    api: true,
    cli: true,
    sdk: true,
    os: true,
    io: true,
    ip: true,
    tls: true,
    ssl: true,
    jwt: true,
    json: true,
    yaml: true,
    html: true,
    css: true,
    dom: true,
    ast: true,
    gpu: true,
    cpu: true,
    ram: true,
    vm: true,
    props: true,
    ref: true,
    e: true,
  },
};

/**
 * `unicorn/filename-case` options for Next apps: kebab-case modules, PascalCase components and
 * camelCase hooks and utilities are all allowed.
 */
export const FILENAME_CASE_OPTIONS = {
  cases: {
    kebabCase: true,
    pascalCase: true,
    camelCase: true,
  },
};

/**
 * `unicorn/no-useless-undefined` options for React: explicit resets such as
 * `setState(undefined)` are meaningful arguments, so arguments are not checked.
 */
export const NO_USELESS_UNDEFINED_OPTIONS = { checkArguments: false };
