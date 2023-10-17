module.exports = {
	extends: ['./node_modules/@balena/lint/config/.eslintrc.js'],
	parserOptions: {
		project: 'tsconfig.dev.json',
		sourceType: 'module',
	},
	root: true,
	env: {
		mocha: true
	}
}
