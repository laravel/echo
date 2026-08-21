import { resolve } from "path";
import { defineConfig, PluginOption, UserConfig } from "vite";
import dts from "unplugin-dts/vite";

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
            external: ["react", "pusher-js"],
            output: {
                globals: {
                    react: "React",
                    "pusher-js": "Pusher",
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
                    name: "EchoReact",
                    formats: ["iife"],
                    fileName: () => "echo-react.iife.js",
                },
                emptyOutDir: false, // Don't empty the output directory for the second build
                ...common,
            },
        };
    }

    return {
        plugins: [
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
