import { defineConfig } from "tsup";
import path from "path";

export default defineConfig({
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
  ],
  banner: {
    js: '"use client";',
  },
  esbuildOptions(options) {
    options.alias = {
      "@": path.resolve(__dirname),
    };
  },
});
