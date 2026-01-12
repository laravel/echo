import tsPlugin from "@typescript-eslint/eslint-plugin";
import reactHooks from "eslint-plugin-react-hooks";
import tsParser from "@typescript-eslint/parser";
import eslintReact from "@eslint-react/eslint-plugin";

const config = [
    eslintReact.configs["recommended-typescript"],
    reactHooks.configs.flat.recommended,
    {
        ignores: ["dist/**/*"],
        files: ["src/**/*.ts"],
        languageOptions: {
            parser: tsParser, // Use the imported parser object
            parserOptions: {
                ecmaVersion: "latest",
                sourceType: "module",
                project: "./tsconfig.json", // Path to your TypeScript configuration file
            },
        },
        plugins: {
            "@typescript-eslint": tsPlugin,
        },
        rules: {
            ...tsPlugin.configs.recommended.rules,
            ...tsPlugin.configs["recommended-requiring-type-checking"].rules,
        },
    },
];

export default config;
