/*
Copyright 2016-2020 Balena Ltd.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

   http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

/**
 * @module request
 */

import * as urlLib from 'url';
import * as fetchReadableStream from 'fetch-readablestream';
import * as errors from 'balena-errors';
import * as utils from './utils';
import * as progress from './progress';

/**
 * @param {object} options
 * @param {import('balena-auth').default} options.auth
 * @param {boolean} options.debug
 * @param {number} options.retries
 * @param {boolean} options.isBrowser
 * @param {array} options.interceptors
 */
export function getRequest({
	auth,
	debug = false,
	retries = 0,
	isBrowser = false,
	interceptors = [],
}) {
	const requestAsync = utils.getRequestAsync();
	const requestBrowserStream = utils.getRequestAsync(fetchReadableStream);

	const debugRequest = !debug
		? function () {
				// noop
		  }
		: utils.debugRequest;

	const exports = {};

	const prepareOptions = async function (options) {
		if (options == null) {
			options = {};
		}

		const { baseUrl } = options;

		options = {
			method: 'GET',
			json: true,
			strictSSL: true,
			headers: {},
			sendToken: true,
			refreshToken: true,
			retries,
			...options,
		};

		if (options.uri) {
			options.url = options.uri;
			delete options.uri;
		}
		if (urlLib.parse(options.url).protocol != null) {
			delete options.baseUrl;
		}

		// Only refresh if we have balena-auth, we're going to use it to send a
		// token, and we haven't opted out of refresh
		if (auth != null && options.sendToken && options.refreshToken) {
			const shouldRefreshKey = await utils.shouldRefreshKey(auth);
			if (shouldRefreshKey) {
				await exports.refreshToken({ baseUrl });
			}
		}
		const authorizationHeader = options.sendToken
			? await utils.getAuthorizationHeader(auth)
			: undefined;

		if (authorizationHeader != null) {
			options.headers.Authorization = authorizationHeader;
		}

		if (typeof options.apiKey === 'string' && options.apiKey.length > 0) {
			// Using `request` qs object results in dollar signs, or other
			// special characters used to query our OData API, being escaped
			// and thus leading to all sort of weird error.
			// The workaround is to append the `apikey` query string manually
			// to prevent affecting the rest of the query strings.
			// See https://github.com/request/request/issues/2129
			options.url += urlLib.parse(options.url).query != null ? '&' : '?';
			options.url += `apikey=${options.apiKey}`;
		}

		return options;
	};

	const interceptRequestOptions = (requestOptions) =>
		interceptRequestOrError(Promise.resolve(requestOptions));

	const interceptRequestError = (requestError) =>
		interceptRequestOrError(Promise.reject(requestError));

	const interceptResponse = (response) =>
		interceptResponseOrError(Promise.resolve(response));

	const interceptResponseError = (responseError) =>
		interceptResponseOrError(Promise.reject(responseError));

	var interceptRequestOrError = async (initialPromise) =>
		exports.interceptors.reduce(function (promise, { request, requestError }) {
			if (request != null || requestError != null) {
				return promise.then(request, requestError);
			} else {
				return promise;
			}
		}, initialPromise);

	var interceptResponseOrError = async function (initialPromise) {
		interceptors = exports.interceptors.slice().reverse();
		return interceptors.reduce(function (promise, { response, responseError }) {
			if (response != null || responseError != null) {
				return promise.then(response, responseError);
			} else {
				return promise;
			}
		}, initialPromise);
	};

	/**
	 * @summary Perform an HTTP request to balena
	 * @function
	 * @public
	 *
	 * @description
	 * This function automatically handles authorization with balena.
	 *
	 * The module scans your environment for a saved session token. Alternatively, you may pass the `apiKey` option. Otherwise, the request is made anonymously.
	 *
	 * Requests can be aborted using an AbortController (with a polyfill like https://www.npmjs.com/package/abortcontroller-polyfill
	 * if necessary). This is not well supported everywhere yet, is on a best-efforts basis, and should not be relied upon.
	 *
	 * @param {Object} options - options
	 * @param {String} [options.method='GET'] - method
	 * @param {String} options.url - relative url
	 * @param {String} [options.apiKey] - api key
	 * @param {String} [options.responseFormat] - explicit expected response format,
	 * can be one of 'blob', 'json', 'text', 'none'. Defaults to sniffing the content-type
	 * @param {AbortSignal} [options.signal] - a signal from an AbortController
	 * @param {*} [options.body] - body
	 * @param {number} [options.timeout] - body
	 *
	 * @returns {Promise<Object>} response
	 *
	 * @example
	 * request.send
	 * 	method: 'GET'
	 * 	baseUrl: 'https://api.balena-cloud.com'
	 * 	url: '/foo'
	 * .get('body')
	 *
	 * @example
	 * request.send
	 * 	method: 'POST'
	 * 	baseUrl: 'https://api.balena-cloud.com'
	 * 	url: '/bar'
	 * 	data:
	 * 		hello: 'world'
	 * .get('body')
	 */
	exports.send = async function (options) {
		// Only set the default timeout when doing a normal HTTP
		// request and not also when streaming since in the latter
		// case we might cause unnecessary ESOCKETTIMEDOUT errors.
		if (options.timeout == null) {
			options.timeout = 59000;
		}

		return prepareOptions(options)
			.then(interceptRequestOptions, interceptRequestError)
			.then(async (opts) => {
				let response;
				try {
					response = await requestAsync(opts);
				} catch (err) {
					err.requestOptions = opts;
					throw err;
				}

				const body = await utils.getBody(response, options.responseFormat);
				// We have to use Object.defineProperty in order to overwrite the body property
				// for node-fetch without losing all the other properties/methods
				Object.defineProperty(response, 'body', {
					get() {
						return body;
					},
				});

				if (utils.isErrorCode(response.statusCode)) {
					const responseError = utils.getErrorMessageFromResponse(response);
					debugRequest(options, response);
					throw new errors.BalenaRequestError(
						responseError,
						response.statusCode,
						options,
					);
				}

				return response;
			})
			.then(interceptResponse, interceptResponseError);
	};

	/**
	 * @summary Stream an HTTP response from balena.
	 * @function
	 * @public
	 *
	 * @description
	 * This function emits a `progress` event, passing an object with the following properties:
	 *
	 * - `Number percent`: from 0 to 100.
	 * - `Number total`: total bytes to be transmitted.
	 * - `Number received`: number of bytes transmitted.
	 * - `Number eta`: estimated remaining time, in seconds.
	 *
	 * The stream may also contain the following custom properties:
	 *
	 * - `String .mime`: Equals the value of the `Content-Type` HTTP header.
	 *
	 * See `request.send()` for an explanation on how this function handles authentication, and details
	 * on how to abort requests.
	 *
	 * @param {Object} options - options
	 * @param {String} [options.method='GET'] - method
	 * @param {String} options.url - relative url
	 * @param {*} [options.body] - body
	 *
	 * @returns {Promise<NodeJS.ReadableStream>} response
	 *
	 * @example
	 * request.stream
	 * 	method: 'GET'
	 * 	baseUrl: 'https://img.balena-cloud.com'
	 * 	url: '/download/foo'
	 * .then (stream) ->
	 * 	stream.on 'progress', (state) ->
	 * 		console.log(state)
	 *
	 * 	stream.pipe(fs.createWriteStream('/opt/download'))
	 */
	exports.stream = function (options) {
		const requestStream = isBrowser ? requestBrowserStream : requestAsync;

		return prepareOptions(options)
			.then(interceptRequestOptions, interceptRequestError)
			.then(async (opts) => {
				const download = await progress.estimate(
					requestStream,
					isBrowser,
				)(opts);
				// @ts-expect-error
				if (!utils.isErrorCode(download.response.statusCode)) {
					// TODO: Move this to balena-image-manager
					// @ts-expect-error
					download.mime = download.response.headers.get('Content-Type');

					return download;
				}

				// If status code is an error code, interpret the body of the request as an error.
				const chunks = [];
				download.on('data', function (chunk) {
					chunks.push(chunk);
				});
				await new Promise((resolve, reject) => {
					download.on('error', reject);
					download.on('close', resolve);
					download.on('end', resolve);
					download.on('done', resolve);
				});
				const responseError = chunks.join() || 'The request was unsuccessful';
				// @ts-expect-error
				debugRequest(options, download.response);
				// @ts-expect-error
				throw new errors.BalenaRequestError(
					responseError,
					// @ts-expect-error
					download.response.statusCode,
				);
			})
			.then(interceptResponse, interceptResponseError);
	};

	/**
	 * @summary Array of interceptors
	 * @type {Interceptor[]}
	 * @public
	 *
	 * @description
	 * The current array of interceptors to use. Interceptors intercept requests made
	 * by calls to `.stream()` and `.send()` (some of which are made internally) and
	 * are executed in the order they appear in this array for requests, and in the
	 * reverse order for responses.
	 *
	 * @example
	 * request.interceptors.push(
	 * 	requestError: (error) ->
	 * 		console.log(error)
	 * 		throw error
	 * )
	 */
	exports.interceptors = interceptors;

	/**
	 * @typedef Interceptor
	 * @type {object}
	 *
	 * @description
	 * An interceptor implements some set of the four interception hook callbacks.
	 * To continue processing, each function should return a value or a promise that
	 * successfully resolves to a value.
	 *
	 * To halt processing, each function should throw an error or return a promise that
	 * rejects with an error.
	 *
	 * @property {function} [request] - Callback invoked before requests are made. Called with
	 * the request options, should return (or resolve to) new request options, or throw/reject.
	 *
	 * @property {function} [response] - Callback invoked before responses are returned. Called with
	 * the response, should return (or resolve to) a new response, or throw/reject.
	 *
	 * @property {function} [requestError] - Callback invoked if an error happens before a request.
	 * Called with the error itself, caused by a preceeding request interceptor rejecting/throwing
	 * an error for the request, or a failing in preflight token validation. Should return (or resolve
	 * to) new request options, or throw/reject.
	 *
	 * @property {function} [responseError] - Callback invoked if an error happens in the response.
	 * Called with the error itself, caused by a preceeding response interceptor rejecting/throwing
	 * an error for the request, a network error, or an error response from the server. Should return
	 * (or resolve to) a new response, or throw/reject.
	 */

	/**
	 * @summary Refresh token on user request
	 * @function
	 * @public
	 *
	 * @description
	 * This function automatically refreshes the authentication token.
	 *
	 * @param {object} options
	 * @param {String} options.baseUrl - relative url
	 *
	 * @returns {Promise<String>} token - new token
	 *
	 * @example
	 * request.refreshToken
	 * 	baseUrl: 'https://api.balena-cloud.com'
	 */

	exports.refreshToken = async function ({ baseUrl }) {
		// Only refresh if we have balena-auth
		if (auth == null) {
			throw new Error('Auth module not provided in initializer');
		}

		let response;
		try {
			response = await exports.send({
				url: '/whoami',
				baseUrl,
				refreshToken: false,
			});
		} catch (err) {
			if (err.code === 'BalenaRequestError' && err.statusCode === 401) {
				const expiredKey = await auth.getKey();
				await auth.removeKey();
				throw new errors.BalenaExpiredToken(expiredKey);
			}
			throw err;
		}
		const refreshedKey = response.body;
		await auth.setKey(refreshedKey);
		return refreshedKey;
	};

	return exports;
}
