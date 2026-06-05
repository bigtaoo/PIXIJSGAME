const resolve = require('@rollup/plugin-node-resolve').default;
const commonjs = require('@rollup/plugin-commonjs');
const typescript = require('@rollup/plugin-typescript');
const polyfillNode = require('rollup-plugin-polyfill-node');
const json = require('@rollup/plugin-json');
const babel = require('@rollup/plugin-babel').default;

module.exports = {
  input: 'src/wechatIndex.ts',
  output: {
    file: 'wechatgame/pixigame.js',
    format: 'iife',
    name: 'game',
    sourcemap: true,
  },
  plugins: [
    polyfillNode(),
    resolve({
      browser: true,
      preferBuiltins: false,
    }),
    commonjs(),
    json(),
    typescript({ tsconfig: './tsconfig.wechat.json' }),
    // Transpile ES2020 syntax (??  and ?.) that WeChat's JS engine rejects.
    // Runs after typescript so it covers both our code and third-party bundles.
    babel({
      babelHelpers: 'bundled',
      plugins: [
        '@babel/plugin-proposal-optional-chaining',
        '@babel/plugin-proposal-nullish-coalescing-operator',
      ],
      // Apply to all JS in the bundle (including node_modules like pixi.js)
      exclude: [],
    }),
  ],
};
