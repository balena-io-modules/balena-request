const IS_BROWSER = typeof window !== 'undefined' && window !== null;

let dataDirectoryPath: string | undefined;
if (!IS_BROWSER) {
	// eslint-disable-next-line @typescript-eslint/no-var-requires
	const temp = require('temp').track();
	dataDirectoryPath = temp.mkdirSync();
}

import BalenaAuth from 'balena-auth';

const auth = new BalenaAuth({
	dataDirectory: dataDirectoryPath,
	tokenKey: 'token',
});

// Make sure any existing tokens are removed before the tests start
void auth.removeKey();

import { getRequest } from '../build/request';
import * as chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
chai.use(chaiAsPromised);

const getCustomRequest = function (opts = {}) {
	opts = { auth, debug: false, isBrowser: IS_BROWSER, ...opts };
	return getRequest(opts);
};

// Grab setTimeout before we replace it with a fake later, so
// we can still do real waiting in the tests themselves
const unstubbedSetTimeout = setTimeout;
const delay = (delayMs: number) =>
	new Promise((resolve) => unstubbedSetTimeout(resolve, delayMs));

export default () => ({
	IS_BROWSER,
	auth,
	request: getCustomRequest(),
	getCustomRequest,
	delay,
});
