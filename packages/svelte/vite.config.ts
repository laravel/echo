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

const handleEnvVariablesPlugin = (): PluginOption => {
    return {
        name: "handle-env-variables-plugin",
        generateBundle(options, bundle) {
            for (const fileName in bundle) {
                const file = bundle[fileName];

                if (file.type === "chunk" && file.fileName.endsWith(".js")) {
                    const transformedContent = file.code.replace(
                        /import\.meta\.env\.VITE_([A-Z0-9_]+)/g,
                        "(typeof import.meta.env !== 'undefined' ? import.meta.env.VITE_$1 : undefined)",
                    );

                    file.code = transformedContent;
                }
            }
        },
    };
};

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
            handleEnvVariablesPlugin(),
        ],
        define: {
            "import.meta.env.VITE_REVERB_APP_KEY":
                "import.meta.env.VITE_REVERB_APP_KEY",
            "import.meta.env.VITE_REVERB_HOST":
                "import.meta.env.VITE_REVERB_HOST",
            "import.meta.env.VITE_REVERB_PORT":
                "import.meta.env.VITE_REVERB_PORT",
            "import.meta.env.VITE_REVERB_SCHEME":
                "import.meta.env.VITE_REVERB_SCHEME",
            "import.meta.env.VITE_PUSHER_APP_KEY":
                "import.meta.env.VITE_PUSHER_APP_KEY",
            "import.meta.env.VITE_PUSHER_APP_CLUSTER":
                "import.meta.env.VITE_PUSHER_APP_CLUSTER",
            "import.meta.env.VITE_PUSHER_HOST":
                "import.meta.env.VITE_PUSHER_HOST",
            "import.meta.env.VITE_PUSHER_PORT":
                "import.meta.env.VITE_PUSHER_PORT",
            "import.meta.env.VITE_SOCKET_IO_HOST":
                "import.meta.env.VITE_SOCKET_IO_HOST",
            "import.meta.env.VITE_ABLY_PUBLIC_KEY":
                "import.meta.env.VITE_ABLY_PUBLIC_KEY",
        },
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
