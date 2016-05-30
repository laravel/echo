import typescript from 'rollup-plugin-typescript';
import babel from 'rollup-plugin-babel';

export default {
  entry: './src/echo.ts',
  dest: './dist/echo.js',
  plugins: [
    typescript(),
    babel({
      exclude: 'node_modules/**',
      presets: ['es2015-rollup', 'stage-2'],
      plugins: ['transform-object-assign']
    })
  ]
}
