import { defineConfig } from "tsup";
import path from "path";

const alias = { "@": path.resolve(__dirname) };

export default defineConfig([
  {
    // Main client bundle (MapRenderer, useMapStream, types, etc.)
    entry: ["lib/index.ts"],
    tsconfig: "tsconfig.lib.json",
    format: ["esm"],
    dts: true,
    splitting: false,
    sourcemap: true,
    clean: true,
    external: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "maplibre-gl",
      "lucide-react",
      "ai",
      "@ai-sdk/anthropic",
      "@ai-sdk/react",
    ],
    banner: {
      js: '"use client";',
    },
    esbuildOptions(options) {
      options.alias = alias;
    },
  },
  {
    // Server-side API helper (no "use client" banner)
    entry: { api: "lib/api.ts" },
    tsconfig: "tsconfig.lib.json",
    format: ["esm"],
    dts: true,
    splitting: false,
    sourcemap: true,
    external: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "maplibre-gl",
      "lucide-react",
      "ai",
      "@ai-sdk/anthropic",
      "@ai-sdk/react",
    ],
    esbuildOptions(options) {
      options.alias = alias;
    },
  },
]);
