const IS_BROWSER = typeof window !== 'undefined' && window !== null;

let dataDirectoryPath = null;
if (!IS_BROWSER) {
	const temp = require('temp').track();
	dataDirectoryPath = temp.mkdirSync();
}

const BalenaAuth = require('balena-auth')['default'];

const auth = new BalenaAuth({
	dataDirectory: dataDirectoryPath,
	tokenKey: 'token',
});

// Make sure any existing tokens are removed before the tests start
auth.removeKey();

const { getRequest } = require('../build/request');

const getCustomRequest = function (opts) {
	opts = Object.assign({}, { auth, debug: false, isBrowser: IS_BROWSER }, opts);
	return getRequest(opts);
};

module.exports = () => ({
	IS_BROWSER,
	auth,
	request: getCustomRequest(),
	getCustomRequest,
});
