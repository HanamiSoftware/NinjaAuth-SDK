import { defineConfig } from "tsup";

export default defineConfig([
    // Build per npm: ESM e CommonJS
    {
        entry: ["src/index.ts"],
        format: ["esm", "cjs"],
        dts: true,
        sourcemap: true,
        outDir: "dist",
				cjsInterop: true
    },

    // Build browser: IIFE
    {
        entry: ["src/NinjaAuth-iife.ts"],
        format: ["iife"],
        sourcemap: true,
        minify: false,
        outDir: "dist"
    }
]);