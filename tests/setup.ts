import type { RequestFactoryOptions } from '../lib/request';
const IS_BROWSER = typeof window !== 'undefined' && window !== null;

let dataDirectoryPath = undefined;
if (!IS_BROWSER) {
	const temp = (await import('temp')).track();
	dataDirectoryPath = temp.mkdirSync();
}

import BalenaAuth from 'balena-auth';

const auth = new BalenaAuth({
	dataDirectory: dataDirectoryPath,
	tokenKey: 'token',
});

// Make sure any existing tokens are removed before the tests start
await auth.removeKey();

import { getRequest } from '../build/request';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
chai.use(chaiAsPromised);

const getCustomRequest = function (opts?: RequestFactoryOptions) {
	opts = Object.assign({}, { auth, debug: false, isBrowser: IS_BROWSER }, opts);
	return getRequest(opts);
};

export default function () {
	return {
		IS_BROWSER,
		auth,
		request: getCustomRequest(),
		getCustomRequest,
	};
}
