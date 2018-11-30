import typescript from 'rollup-plugin-typescript';
import babel from 'rollup-plugin-babel';

export default {
  input: './src/echo.ts',
  output: [{ file: './dist/echo.js', format: 'esm' }],
  plugins: [
    typescript(),
    babel({
      exclude: 'node_modules/**',
      presets: ['es2015-rollup', 'stage-2'],
      plugins: ['transform-object-assign']
    })
  ]
}
