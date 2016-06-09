import babel from 'rollup-plugin-babel';

export default {
  entry: './src/echo.js',
  dest: './dist/echo.js',
  plugins: [
    babel({
      exclude: 'node_modules/**',
      presets: ['es2015-rollup', 'stage-2'],
      plugins: ['transform-object-assign']
    })
  ]
}
