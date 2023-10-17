module.exports = {
	extends: ['./node_modules/@balena/lint/config/.eslintrc.js'],
	parserOptions: {
		project: 'tsconfig.dev.json',
	},
	root: true,
	env: {
		jest: true
	}
};