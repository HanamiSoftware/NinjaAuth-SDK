import { defineConfig } from "tsup";

export default defineConfig([
    {
        entry: ["src/index.ts"],
        format: ["iife", "cjs", "esm"],
        globalName: "NinjaAuth",
        minify: false,
        sourcemap: true,
        outDir: "dist",
        dts: true
    }
]);