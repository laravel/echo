import babel from '@rollup/plugin-babel';
import { builtinModules } from 'node:module';
import json from '@rollup/plugin-json';
import dts from 'rollup-plugin-dts';
import pkg from './package.json' assert { type: 'json' };
import { defineConfig } from 'rollup';
import esbuild from 'rollup-plugin-esbuild';

const plugins = [
    esbuild(),
    babel({
        babelHelpers: 'bundled',
        exclude: 'node_modules/**',
        extensions: ['.ts'],
        presets: ['@babel/preset-env'],
        plugins: [
            ['@babel/plugin-proposal-decorators', { legacy: true }],
            '@babel/plugin-proposal-function-sent',
            '@babel/plugin-proposal-export-namespace-from',
            '@babel/plugin-proposal-numeric-separator',
            '@babel/plugin-proposal-throw-expressions',
            '@babel/plugin-transform-object-assign',
        ],
    }),
    json(),
];

const external = [
    ...builtinModules,
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.peerDependencies || {}),
];

export default defineConfig([
    {
        input: 'src/echo.ts',
        output: [
            { file: './dist/echo.js', format: 'esm' },
            { file: './dist/echo.common.js', format: 'cjs' },
        ],
        external,
        plugins,
        onwarn,
    },
    {
        input: 'src/echo.ts',
        output: [{ file: './dist/echo.iife.js', format: 'iife', name: 'Echo' }],
        plugins,
        onwarn,
    },
    {
        input: 'src/echo.ts',
        output: {
            dir: 'dist',
            entryFileNames: '[name].d.ts',
            format: 'esm',
        },
        external,
        plugins: [dts({ respectExternal: true })],
        onwarn,
    },
]);

function onwarn(message) {
    if (['EMPTY_BUNDLE', 'CIRCULAR_DEPENDENCY'].includes(message.code)) return;
    console.error(message);
}
