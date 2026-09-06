import { defineConfig } from "tsup";

export default defineConfig([
    {
        entry: ["src/index.ts"],
        format: ["esm", "cjs"],
        dts: true,
        sourcemap: true,
        clean: true
    },
    {
        entry: ["src/index.ts"],
        format: ["iife"],
        globalName: "NinjaConnect",
        minify: true,
        sourcemap: true,
        outDir: "dist"
    }
]);