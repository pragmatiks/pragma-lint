/**
 * The `@pragmatiks/lint/eslint-config/unit-test` entry: bans on mocks, fakes and I/O in unit tests.
 *
 * @packageDocumentation
 */
import type { Linter } from "eslint";

type RestrictedImportPath = { name: string; message: string; importNames?: string[] };

type RestrictedImportPattern = { group: string[]; message: string };

type RestrictedProperty = { object: string; property: string; message: string };

type RestrictedSyntax = { selector: string; message: string };

/**
 * The restricted lists of the base config a consumer uses, which the unit-test config keeps.
 */
export interface InheritedBans {
  readonly imports?: { paths: RestrictedImportPath[]; patterns: RestrictedImportPattern[] };
  readonly properties?: RestrictedProperty[];
  readonly syntax?: RestrictedSyntax[];
}

/**
 * The files the unit-test config applies to by default.
 */
export const PRAGMATIKS_UNIT_TEST_FILES = ["tests/unit/**"];

const MOCK_MESSAGE = "Unit tests use no mocks, stubs or fakes; test a pure decision with real inputs.";

const IO_MESSAGE = "Unit tests perform no I/O; test a pure decision with real inputs.";

const BANNED_VI_PROPERTIES = [
  "mock",
  "doMock",
  "spyOn",
  "fn",
  "stubGlobal",
  "stubEnv",
  "useFakeTimers",
  "setSystemTime",
];

const BANNED_NODE_MODULES = [
  "fs",
  "fs/promises",
  "child_process",
  "net",
  "http",
  "https",
  "dgram",
  "dns",
  "dns/promises",
  "http2",
  "tls",
  "process",
  "worker_threads",
];

const BANNED_GLOBALS = ["fetch", "XMLHttpRequest", "WebSocket", "EventSource", "process"];

const GLOBAL_OBJECTS = ["globalThis", "window", "self"];

const SLASH = String.raw`\u002F`;

const MODULE_PATTERN = `/^((node:)?(${BANNED_NODE_MODULES.map((module) => module.replace("/", SLASH)).join("|")})|msw(${SLASH}.*)?)$/`;

const DYNAMIC_LOAD_SYNTAX = [
  {
    selector: `CallExpression[callee.name="require"] > Literal.arguments[value=${MODULE_PATTERN}]`,
    message: IO_MESSAGE,
  },
  { selector: `ImportExpression > Literal.source[value=${MODULE_PATTERN}]`, message: IO_MESSAGE },
];

/**
 * Builds the flat config object that bans vi mock, stub and fake-timer helpers, msw,
 * Node I/O modules (static, `require()` and `import()`) and network globals in unit tests.
 *
 * @param inherited - The base config's restricted lists to keep, since a later flat config replaces a rule's options; `pragmatiksNextUnitTestConfig` passes the Next ones.
 * @returns The config object with the `no-restricted-*` rules set.
 */
export function pragmatiksUnitTestConfig(inherited: InheritedBans = {}): Linter.Config {
  return {
    name: "pragmatiks/unit-test",
    files: PRAGMATIKS_UNIT_TEST_FILES,
    rules: {
      "no-restricted-properties": [
        "error",
        ...(inherited.properties ?? []),
        ...BANNED_VI_PROPERTIES.map((property) => ({ object: "vi", property, message: MOCK_MESSAGE })),
        ...GLOBAL_OBJECTS.flatMap((object) =>
          BANNED_GLOBALS.map((property) => ({ object, property, message: IO_MESSAGE })),
        ),
      ],
      "no-restricted-imports": [
        "error",
        {
          paths: [
            ...(inherited.imports?.paths ?? []),
            { name: "msw", message: MOCK_MESSAGE },
            ...BANNED_NODE_MODULES.flatMap((module) => [
              { name: module, message: IO_MESSAGE },
              { name: `node:${module}`, message: IO_MESSAGE },
            ]),
          ],
          patterns: [...(inherited.imports?.patterns ?? []), { group: ["msw/*"], message: MOCK_MESSAGE }],
        },
      ],
      "no-restricted-syntax": ["error", ...(inherited.syntax ?? []), ...DYNAMIC_LOAD_SYNTAX],
      "no-restricted-globals": ["error", ...BANNED_GLOBALS.map((name) => ({ name, message: IO_MESSAGE }))],
    },
  };
}

export default pragmatiksUnitTestConfig;
