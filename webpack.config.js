const path = require('path');
const fs = require('fs');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const webpack = require('webpack');
const CopyPlugin = require('copy-webpack-plugin');

const ASSETS_DIR        = path.resolve(__dirname, 'src/assets');
const MOBILE_ASSETS_DIR = path.resolve(__dirname, 'src/mobileAssets');

/**
 * For mobile builds (web/iOS/Android), replace an asset import with the
 * high-res version from src/mobileAssets/ when a same-named file exists there.
 * Falls back to src/assets/ otherwise — no import changes required.
 */
class MobileAssetReplacementPlugin {
  apply(compiler) {
    compiler.hooks.normalModuleFactory.tap('MobileAssetReplacementPlugin', factory => {
      factory.hooks.beforeResolve.tap('MobileAssetReplacementPlugin', resolveData => {
        if (!resolveData) return;
        const req = resolveData.request;
        // Only intercept relative imports that resolve inside src/assets/
        const absPath = path.resolve(resolveData.context, req);
        if (!absPath.startsWith(ASSETS_DIR + path.sep)) return;

        // Match by filename stem (ignore extension) so an import of e.g.
        // lobby_bg.webp is satisfied by mobileAssets/lobby_bg.png.
        if (!fs.existsSync(MOBILE_ASSETS_DIR)) return;
        const stem = path.basename(absPath, path.extname(absPath));
        const match = fs
          .readdirSync(MOBILE_ASSETS_DIR)
          .find(f => path.basename(f, path.extname(f)) === stem);
        if (match) {
          resolveData.request = path.join(MOBILE_ASSETS_DIR, match);
        }
      });
    });
  }
}

module.exports = (env, argv) => {
  const isProd = argv.mode === 'production';
  const targetPlatform = env.TARGET || 'web';

  // platform-specific overrides
  const platformConfig = {
    web: {
      entry: './src/index.ts',
      outputPath: path.resolve(__dirname, 'dist'),
      htmlTemplate: './public/index.html',
      useMobileAssets: false,
    },
    mobile: {
      entry: './src/index.ts',
      outputPath: path.resolve(__dirname, 'dist'),
      htmlTemplate: './public/index.html',
      useMobileAssets: true,
    },
    crazygames: {
      entry: './src/crazygamesIndex.ts',
      outputPath: path.resolve(__dirname, 'crazygames'),
      htmlTemplate: './public/crazygames.html',
      useMobileAssets: false,
    },
    telegram: {
      entry: './src/telegramIndex.ts',
      outputPath: path.resolve(__dirname, 'telegram'),
      htmlTemplate: './public/telegram.html',
      useMobileAssets: false,
    },
  };

  const platform = platformConfig[targetPlatform] ?? platformConfig.web;

  return {
    target: 'web',
    mode: isProd ? 'production' : 'development',
    entry: platform.entry,
    devtool: isProd ? false : 'source-map',
    module: {
      rules: [
        {
          test: /\.ts$/,
          use: { loader: 'ts-loader', options: { transpileOnly: true } },
          exclude: /node_modules/,
        },
        {
          test: /\.(png|jpg|gif|webp|mp3|wav|ogg|json)$/i,
          type: 'asset/resource',
        },
        { test: /\.css$/i, use: ['style-loader', 'css-loader'] },
      ],
    },
    resolve: { extensions: ['.ts', '.js'] },
    output: {
      filename: 'index.js',
      path: platform.outputPath,
      clean: true,
    },
    plugins: [
      new HtmlWebpackPlugin({ template: platform.htmlTemplate }),
      new CopyPlugin({ patterns: [{ from: 'public/favicon.png', to: 'favicon.png' }] }),
      new webpack.DefinePlugin({
        TARGET: JSON.stringify(targetPlatform),
      }),
      ...(platform.useMobileAssets ? [new MobileAssetReplacementPlugin()] : []),
    ],
    devServer: {
      static: [
        { directory: path.join(__dirname, 'dist'), publicPath: '/' },
        { directory: path.join(__dirname, 'src/assets'), publicPath: '/assets' },
      ],
      hot: true,
      open: true,
      port: 8080,
    },
    optimization: {
      minimize: isProd,
    },
  };
};
