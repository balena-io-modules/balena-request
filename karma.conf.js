const getKarmaConfig = require('balena-config-karma');
const packageJSON = require('./package.json');

module.exports = (config) => {
	const karmaConfig = getKarmaConfig(packageJSON);
	karmaConfig.logLevel = config.LOG_INFO;
	// polyfill required for mockttp & balena-request
	// the next major might not require them any more
	karmaConfig.webpack.resolve.fallback = {
		assert: require.resolve('assert'),
		constants: false,
		crypto: false,
		fs: false,
		os: false,
		path: false,
		querystring: require.resolve('querystring-es3'),
		stream: require.resolve('stream-browserify'),
		util: false,
		// required by mockttp -> http-encoding
		zlib: false,
	};
	karmaConfig.webpack.module.rules.push({
		test: /\.js/,
		resolve: {
			fullySpecified: false,
		},
	});
	karmaConfig.webpack.plugins = [
		new getKarmaConfig.webpack.ProvidePlugin({
			// Polyfills or mocks for various node stuff
			process: 'process/browser',
			Buffer: ['buffer', 'Buffer'],
		}),
	];
	karmaConfig.webpack.experiments = {
		asyncWebAssembly: true,
	};

	config.set(karmaConfig);
};
