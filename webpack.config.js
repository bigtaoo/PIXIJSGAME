const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const webpack = require('webpack');
// const CopyPlugin = require('copy-webpack-plugin');

module.exports = (env, argv) => {
  const isProd = argv.mode === 'production';
  const targetPlatform = env.TARGET || 'web';

  // ── Platform-specific overrides ──────────────────────────────────
  const platformConfig = {
    web: {
      entry: './src/index.ts',
      outputPath: path.resolve(__dirname, 'dist'),
      htmlTemplate: './public/index.html',
    },
    crazygames: {
      entry: './src/crazygamesIndex.ts',
      outputPath: path.resolve(__dirname, 'crazygames'),
      htmlTemplate: './public/crazygames.html',
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
      new webpack.DefinePlugin({
        TARGET: JSON.stringify(targetPlatform),
      }),
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
