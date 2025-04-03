import babel from '@rollup/plugin-babel';
import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';

export default [
    {
        input: './src/echo.ts',
        output: [
            { file: './dist/echo.js', format: 'esm' },
            { file: './dist/echo.common.js', format: 'cjs' },
        ],
        plugins: [
            resolve(),
            typescript({
                tsconfig: './tsconfig.json', // Ensures Rollup aligns with your TS settings
            }),
            babel({
                babelHelpers: 'bundled',
                extensions: ['.ts'],
                exclude: 'node_modules/**',
                presets: ['@babel/preset-env'],
                plugins: [
                    '@babel/plugin-transform-numeric-separator',
                    '@babel/plugin-transform-export-namespace-from',
                    ['@babel/plugin-proposal-decorators', { legacy: true }],
                    '@babel/plugin-proposal-function-sent',
                    '@babel/plugin-proposal-throw-expressions',
                    '@babel/plugin-transform-object-assign',
                ],
            }),
        ],
        external: ['jquery', 'axios', 'vue', '@hotwired/turbo', 'tslib', 'react', 'pusher-js'], // Compatible packages not included in the bundle
    },
    {
        input: './src/index.iife.ts',
        output: [{ file: './dist/echo.iife.js', format: 'iife', name: 'Echo' }],
        plugins: [
            resolve(),
            typescript({
                tsconfig: './tsconfig.json',
            }),
            babel({
                babelHelpers: 'bundled',
                extensions: ['.ts'],
                exclude: 'node_modules/**',
            }),
        ],
        external: ['jquery', 'axios', 'vue', '@hotwired/turbo', 'tslib'], // Compatible packages not included in the bundle
    },
    {
        input: './src/hooks/use-echo.ts',
        output: [
            { file: './dist/hooks/use-echo.js', format: 'esm' },
        ],
        plugins: [
            resolve(),
            typescript({
                tsconfig: './tsconfig.json',
            }),
            babel({
                babelHelpers: 'bundled',
                extensions: ['.ts'],
                exclude: 'node_modules/**',
                presets: ['@babel/preset-env'],
            }),
        ],
        external: ['react', 'pusher-js', 'laravel-echo'], // React and other dependencies should be external
    },
    {
        input: './src/composables/useEcho.ts',
        output: [
            { file: './dist/composables/useEcho.js', format: 'esm' },
        ],
        plugins: [
            resolve(),
            typescript({
                tsconfig: './tsconfig.json',
            }),
            babel({
                babelHelpers: 'bundled',
                extensions: ['.ts'],
                exclude: 'node_modules/**',
                presets: ['@babel/preset-env'],
            }),
        ],
        external: ['vue', 'pusher-js', 'laravel-echo'], // Vue and other dependencies should be external
    },
];
