import babel from 'rollup-plugin-babel';
import typescript from 'rollup-plugin-typescript2';

export default {
    input: './src/echo.ts',
    output: [{
        file: 'dist/echo.js',
        format: 'cjs'
    }],
    plugins: [
        typescript({
            useTsconfigDeclarationDir: true
        }),
        babel({
            exclude: 'node_modules/**',
            presets: ['es2015-rollup', 'stage-2'],
            plugins: ['transform-object-assign']
        })
    ]
}
