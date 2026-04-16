import { resolve } from "path";
import { defineConfig, UserConfig } from "vite";
import dts from "vite-plugin-dts";

const config: UserConfig = (() => {
    const common: Partial<UserConfig["build"]> = {
        rollupOptions: {
            external: ["pusher-js", "socket.io-client"],
            output: {
                globals: {
                    "pusher-js": "Pusher",
                    "socket.io-client": "io",
                },
            },
        },
        outDir: resolve(__dirname, "dist"),
        sourcemap: true,
        minify: true,
        target: "es2022",
    };

    if (process.env.FORMAT === "iife") {
        return {
            build: {
                lib: {
                    entry: resolve(__dirname, "src/echo.ts"),
                    name: "Echo",
                    formats: ["iife"],
                    fileName: () => "echo.iife.js",
                },
                ...common,
                emptyOutDir: false, // Don't empty the output directory for the second build
            },
        };
    }

    return {
        plugins: [
            dts({
                insertTypesEntry: true,
                rollupTypes: true,
                include: ["src/**/*.ts"],
            }),
        ],
        build: {
            lib: {
                entry: resolve(__dirname, "src/echo.ts"),
                formats: ["es", "cjs"],
                fileName: (format, entryName) => {
                    return `${entryName}.${format === "es" ? "js" : "common.js"}`;
                },
            },
            emptyOutDir: true,
            ...common,
        },
        test: {
            globals: true,
            environment: "jsdom",
        },
    };
})();

export default defineConfig(config);
