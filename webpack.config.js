const path = require('path')
const HTMLWebpackPlugin = require('html-webpack-plugin')
const CopyWebpackPlugin = require('copy-webpack-plugin')
const TerserWebpackPlugin = require('terser-webpack-plugin')
const { CleanWebpackPlugin } = require('clean-webpack-plugin')

module.exports = {
	mode: 'none',
	entry: './src/index.js',
	module: {
		rules: [
			{
				test: /\.tsx?$/,
				use: 'ts-loader',
				exclude: /node_modules/,
			},
			{
				test: /\.scss$/,
				use: ['style-loader', 'css-loader', 'sass-loader'],
				exclude: /node_modules/,
			},
		],
	},
	resolve: {
		extensions: ['.tsx', '.ts', '.js'],
	},
	optimization: {
		usedExports: true,
	},
	output: {
		filename: 'main.js',
		path: path.resolve(__dirname, 'www'),
		clean: true,
	},
	plugins: [
		new CleanWebpackPlugin(),
		new CopyWebpackPlugin({
			patterns: [
				{
					from: path.resolve(__dirname, 'public'),
					to: path.resolve(__dirname, 'www'),
				},
			],
		}),
		new HTMLWebpackPlugin({
			template: 'src/index.html',
			minify: true,
		}),
	],
}
