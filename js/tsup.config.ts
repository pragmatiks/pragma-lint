import { defineConfig } from "tsup";

export default defineConfig({
  entry: [
    "src/index.ts",
    "src/eslint-config/index.ts",
    "src/eslint-config/next/index.ts",
  ],
  format: ["esm"],
  dts: true,
  clean: true,
  target: "node22",
  sourcemap: true,
  splitting: false,
  treeshake: true,
});
