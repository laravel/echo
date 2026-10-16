import { defineConfig } from "vite-plus";

export default defineConfig({
    lint: {
        ignorePatterns: ["**/dist/**", "**/tests/**"],
        jsPlugins: [
            { name: "vite-plus", specifier: "vite-plus/oxlint-plugin" },
        ],
        options: { typeAware: true, typeCheck: true },
        plugins: ["typescript"],
        rules: {
            "no-console": "warn",
            "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
            "typescript/no-floating-promises": "error",
            "typescript/no-unsafe-argument": "warn",
            "typescript/no-unsafe-assignment": "warn",
            "typescript/no-unsafe-call": "warn",
            "typescript/no-unsafe-member-access": "warn",
            "typescript/no-unsafe-return": "warn",
            "vite-plus/prefer-vite-plus-imports": "error",
        },
        overrides: [
            {
                files: ["packages/react/**"],
                plugins: ["react"],
                rules: {
                    "react/exhaustive-deps": "warn",
                    "react/rules-of-hooks": "error",
                },
            },
        ],
    },
    fmt: {
        ignorePatterns: [".github/**", "CHANGELOG.md"],
        overrides: [
            {
                files: ["**/*.{yml,yaml}"],
                options: { tabWidth: 2 },
            },
        ],
        printWidth: 80,
        sortPackageJson: false,
        tabWidth: 4,
        useTabs: false,
    },
});
