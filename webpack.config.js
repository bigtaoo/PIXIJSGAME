const path = require('path');
const webpack = require('webpack');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = (env, argv) => {
    const isProd = argv.mode === 'production';
    const target = env.TARGET || 'wechat';

    return {
        mode: isProd ? 'production' : 'development',
        entry: './src/wechatIndex.ts',
        devtool: isProd ? false : 'source-map',

        module: {
            rules: [
                { test: /\.ts$/, use: 'ts-loader', exclude: /node_modules/ },
                {
                    test: /\.m?js$/,
                    include: /node_modules\/pixi.js-legacy/,
                    resolve: { fullySpecified: false },
                    type: 'javascript/auto',
                },
                {
                    test: /\.(png|jpg|gif|webp|mp3|wav|ogg|json)$/i,
                    type: 'asset/resource',
                    generator: {
                        filename: 'assets/[name][ext]', // keep original names
                    },
                },
                { test: /\.css$/i, use: ['style-loader', 'css-loader'] },
            ],
        },

        resolve: {
            extensions: ['.ts', '.js'],
        },
        // externals: {
        //     'pixi.js': 'PIXI',
        // },
        output: {
            filename: 'pixigame.js', // single file for WeChat
            path: path.resolve(__dirname, 'wechatgame'),
            clean: true,
            library: {
                name: 'game',
                type: 'var', // export as global variable
            },
            libraryTarget: 'window',
        },

        optimization: {
            minimize: false,//isProd,
            splitChunks: false,  // disable chunk splitting
            runtimeChunk: false, // disable runtime chunk
        },

        plugins: [
            new webpack.DefinePlugin({
                TARGET: JSON.stringify(target),
            }),
            new CopyPlugin({
              patterns: [
          //         {
          //             from: path.resolve(__dirname, 'node_modules/pixi.js-legacy/dist/pixi-legacy.min.js'),
          //             to: 'pixi.js',
          //             transform(content) {
          //                 return content.toString() + `
          // if (typeof GameGlobal !== 'undefined') {
          //     GameGlobal.PIXI = PIXI;
          // } else if (typeof globalThis !== 'undefined') {
          //     globalThis.PIXI = PIXI;
          // }
          // `;}
          //         },
                  {
                      from: path.resolve(__dirname, 'src/assets'),
                      to: 'assets'
                  },
                  {
                      from: path.resolve(__dirname, 'src/wechat'),
                      to: './'
                  },
              ],
          }),
        ],

        experiments: {
            outputModule: false,
        },
    };
};
