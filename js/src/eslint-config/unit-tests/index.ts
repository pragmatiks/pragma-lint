/**
 * The `@pragmatiks/lint/eslint-config/unit-tests` entry: bans on mocks, fakes and I/O in unit tests.
 *
 * @packageDocumentation
 */
import type { Linter } from "eslint";

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
  "worker_threads",
];

const BANNED_GLOBALS = ["fetch", "XMLHttpRequest", "WebSocket", "EventSource", "process"];

/**
 * Builds the flat config object that bans vi mock, stub and fake-timer helpers, msw,
 * Node I/O modules and network globals in unit tests.
 *
 * @param files - The globs the bans apply to; defaults to {@link PRAGMATIKS_UNIT_TEST_FILES}.
 * @returns The config object with `no-restricted-properties`, `no-restricted-imports` and `no-restricted-globals` set.
 */
export function pragmatiksUnitTestConfig(files: string[] = PRAGMATIKS_UNIT_TEST_FILES): Linter.Config {
  return {
    name: "pragmatiks/unit-tests",
    files,
    rules: {
      "no-restricted-properties": [
        "error",
        ...BANNED_VI_PROPERTIES.map((property) => ({ object: "vi", property, message: MOCK_MESSAGE })),
      ],
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "msw", message: MOCK_MESSAGE },
            ...BANNED_NODE_MODULES.flatMap((module) => [
              { name: module, message: IO_MESSAGE },
              { name: `node:${module}`, message: IO_MESSAGE },
            ]),
          ],
          patterns: [{ group: ["msw/*"], message: MOCK_MESSAGE }],
        },
      ],
      "no-restricted-globals": ["error", ...BANNED_GLOBALS.map((name) => ({ name, message: IO_MESSAGE }))],
    },
  };
}

export default pragmatiksUnitTestConfig;
