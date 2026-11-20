/**
 * The `@pragmatiks/lint/eslint-config/unit-test` entry: bans on mocks, fakes and I/O in unit tests.
 *
 * @packageDocumentation
 */
import type { Linter } from "eslint";

import { NEXT_RESTRICTED_IMPORTS, NEXT_RESTRICTED_PROPERTIES } from "../next/restricted.js";

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

/**
 * Builds the flat config object that bans vi mock, stub and fake-timer helpers, msw,
 * Node I/O modules and network globals in unit tests, keeping the Next config's import and
 * property bans, since a later flat config replaces a rule's options.
 *
 * @returns The config object with `no-restricted-properties`, `no-restricted-imports` and `no-restricted-globals` set.
 */
export function pragmatiksUnitTestConfig(): Linter.Config {
  return {
    name: "pragmatiks/unit-test",
    files: PRAGMATIKS_UNIT_TEST_FILES,
    rules: {
      "no-restricted-properties": [
        "error",
        NEXT_RESTRICTED_PROPERTIES,
        ...BANNED_VI_PROPERTIES.map((property) => ({ object: "vi", property, message: MOCK_MESSAGE })),
        ...GLOBAL_OBJECTS.flatMap((object) =>
          BANNED_GLOBALS.map((property) => ({ object, property, message: IO_MESSAGE })),
        ),
      ],
      "no-restricted-imports": [
        "error",
        {
          paths: [
            ...NEXT_RESTRICTED_IMPORTS.paths,
            { name: "msw", message: MOCK_MESSAGE },
            ...BANNED_NODE_MODULES.flatMap((module) => [
              { name: module, message: IO_MESSAGE },
              { name: `node:${module}`, message: IO_MESSAGE },
            ]),
          ],
          patterns: [...NEXT_RESTRICTED_IMPORTS.patterns, { group: ["msw/*"], message: MOCK_MESSAGE }],
        },
      ],
      "no-restricted-globals": ["error", ...BANNED_GLOBALS.map((name) => ({ name, message: IO_MESSAGE }))],
    },
  };
}

export default pragmatiksUnitTestConfig;
