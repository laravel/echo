import { defineConfig } from "vite-plus";

export default defineConfig({
    lint: {
        ignorePatterns: ["**/tests/**"],
        jsPlugins: [
            { name: "vite-plus", specifier: "vite-plus/oxlint-plugin" },
        ],
        options: { typeAware: true },
        rules: {
            "no-console": "warn",
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
        printWidth: 80,
        sortPackageJson: false,
    },
});
