import { resolve } from "path";
import { compileModule } from "svelte/compiler";
import { defineConfig, PluginOption, transformWithOxc, UserConfig } from "vite";
import dts from "unplugin-dts/vite";

const srcDir = resolve(import.meta.dirname, "src");
const testsDir = resolve(import.meta.dirname, "tests");

const svelteRunesTsPlugin = (): PluginOption => ({
    name: "svelte-runes-ts",
    enforce: "pre",
    async transform(code, id) {
        if (
            (!id.startsWith(srcDir) && !id.startsWith(testsDir)) ||
            !id.endsWith(".ts")
        ) {
            return null;
        }

        if (!/\$state|\$effect|\$derived/.test(code)) {
            return null;
        }

        try {
            const tsResult = await transformWithOxc(code, id, {
                lang: "ts",
                target: "es2020",
            });
            const result = compileModule(tsResult.code, {
                filename: id.replace(/\.ts$/, ".js"),
                generate: "client",
            });

            if (result.warnings.length > 0) {
                for (const w of result.warnings) {
                    console.warn(`[svelte runes] ${w.message}`);
                }
            }

            return {
                code: result.js.code,
                map: result.js.map,
            };
        } catch (_err) {
            return null;
        }
    },
});

/*
 * Laravel exposes its broadcasting defaults as VITE_* variables, and the consuming app's Vite
 * build statically replaces `import.meta.env.VITE_*` — so these accesses must survive our own
 * build verbatim. The guard makes non-Vite (e.g. CJS) consumers resolve to undefined instead of
 * throwing: format rendering lowers `import.meta` in CJS output, turning the guard condition
 * falsy while the guarded access is never evaluated.
 *
 * Skipped under Vitest: its worker cannot evaluate import.meta-based defines, and tests run with a
 * real import.meta.env so no replacement is needed there.
 */
const guardedEnvVariables = (names: string[]): Record<string, string> =>
    Object.fromEntries(
        process.env.VITEST
            ? []
            : names.map((name) => [
                  `import.meta.env.${name}`,
                  `(typeof import.meta.env !== 'undefined' ? import.meta.env.${name} : undefined)`,
              ]),
    );

const config: UserConfig = (() => {
    const common: Partial<UserConfig["build"]> = {
        rollupOptions: {
            external: (id) =>
                id === "svelte" ||
                id.startsWith("svelte/") ||
                id === "pusher-js",
            output: {
                globals: (id) => {
                    if (id === "svelte" || id.startsWith("svelte/"))
                        return "Svelte";
                    if (id === "pusher-js") return "Pusher";
                    return undefined;
                },
            },
        },
        outDir: resolve(import.meta.dirname, "dist"),
        sourcemap: true,
        minify: true,
        target: "es2022",
    };

    if (process.env.FORMAT === "iife") {
        return {
            build: {
                lib: {
                    entry: resolve(import.meta.dirname, "src/index.iife.ts"),
                    name: "EchoSvelte",
                    formats: ["iife"],
                    fileName: () => "echo-svelte.iife.js",
                },
                emptyOutDir: false,
                ...common,
            },
        };
    }

    return {
        plugins: [
            svelteRunesTsPlugin(),
            dts({
                insertTypesEntry: true,
                bundleTypes: true,
                include: ["src/**/*.ts"],
            }),
        ],
        define: guardedEnvVariables([
            "VITE_ABLY_PUBLIC_KEY",
            "VITE_PUSHER_APP_CLUSTER",
            "VITE_PUSHER_APP_KEY",
            "VITE_PUSHER_HOST",
            "VITE_PUSHER_PORT",
            "VITE_REVERB_APP_KEY",
            "VITE_REVERB_HOST",
            "VITE_REVERB_PORT",
            "VITE_REVERB_SCHEME",
            "VITE_SOCKET_IO_HOST",
        ]),
        build: {
            lib: {
                entry: resolve(import.meta.dirname, "src/index.ts"),
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
