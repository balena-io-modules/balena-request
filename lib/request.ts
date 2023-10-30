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

import type BalenaAuth from 'balena-auth';
import type * as Stream from 'stream';

import * as urlLib from 'url';
import * as errors from 'balena-errors';
import * as utils from './utils';

export interface BalenaRequestOptions {
	method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';
	baseUrl?: string;
	uri?: string;
	url: string;
	apiKey?: string;
	sendToken?: boolean;
	refreshToken?: boolean;
	retries?: number;
	body?: any;
	json?: boolean;
	strictSSL?: boolean;
	responseFormat?: 'none' | 'blob' | 'json' | 'text';
	headers?: Record<string, string>;
	signal?: any;
	timeout?: number;
	qs?: any;
	gzip?: boolean;
	followRedirect?: boolean;
}

export interface BalenaRequestResponse<T = any> extends Omit<Response, 'body'> {
	statusCode: number;
	body: T;
	duration: number;
	request: {
		headers: BalenaRequestOptions['headers'];
		uri: urlLib.UrlWithStringQuery;
	};
}

export interface BalenaRequestPassThroughStream extends Stream.PassThrough {
	response: BalenaRequestResponse;
	mime?: string | null;
}

export interface BalenaRequestStreamResult extends Stream.Readable {
	mime: string;
}

export interface WebResourceFile extends Blob {
	name: string;
}

export interface Interceptor {
	request?(response: any): Promise<any>;
	response?(response: any): Promise<any>;
	requestError?(error: Error): Promise<any>;
	responseError?(error: Error): Promise<any>;
}

export interface RequestFactoryOptions {
	auth?: BalenaAuth;
	debug?: boolean;
	retries?: number;
	isBrowser?: boolean;
	interceptors?: Interceptor[];
}

export type BalenaRequest = ReturnType<typeof getRequest>;

/**
 * @module request
 */

/**
 * @summary Creates a new balena-request instance.
 *
 * @param {object} options
 * @param {object} options.auth
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
	interceptors: $interceptors = [],
}: RequestFactoryOptions) {
	const requestAsync = utils.getRequestAsync();
	const requestStream = isBrowser
		? // eslint-disable-next-line @typescript-eslint/no-var-requires
		  utils.getRequestAsync(require('fetch-readablestream') as typeof fetch)
		: requestAsync;

	const debugRequest = !debug
		? function () {
				// noop
		  }
		: utils.debugRequest;

	const prepareOptions = async function (options: BalenaRequestOptions) {
		if (options == null) {
			options = {} as BalenaRequestOptions;
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
		const isAbsoluteUrl = urlLib.parse(options.url).protocol != null;
		if (isAbsoluteUrl) {
			delete options.baseUrl;
		}

		// Only refresh if we have balena-auth, we're going to use it to send a
		// token, and we haven't opted out of refresh
		if (
			auth != null &&
			options.sendToken &&
			options.refreshToken &&
			(await utils.shouldRefreshKey(auth))
		) {
			if (baseUrl && !isAbsoluteUrl) {
				await refreshToken({ baseUrl });
			}
			if (await auth.isExpired()) {
				throw new errors.BalenaExpiredToken(await auth.getKey());
			}
		}
		const authorizationHeader = options.sendToken
			? await utils.getAuthorizationHeader(auth)
			: undefined;

		if (authorizationHeader != null) {
			options.headers!.Authorization = authorizationHeader;
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

	const interceptRequestOptions = (requestOptions: BalenaRequestOptions) =>
		interceptRequestOrError(Promise.resolve(requestOptions));

	const interceptRequestError = (requestError: errors.BalenaRequestError) =>
		interceptRequestOrError(Promise.reject(requestError));

	const interceptResponse = <
		T extends BalenaRequestResponse | BalenaRequestPassThroughStream,
	>(
		response: T,
	): Promise<T> => interceptResponseOrError(Promise.resolve(response));

	const interceptResponseError = (responseError: errors.BalenaRequestError) =>
		interceptResponseOrError(Promise.reject(responseError));

	const interceptRequestOrError = async (initialPromise: Promise<any>) => {
		let promise = initialPromise;
		for (const { request, requestError } of exports.interceptors) {
			if (request != null || requestError != null) {
				promise = promise.then(request, requestError);
			}
		}
		return promise;
	};

	const interceptResponseOrError = async function (
		initialPromise: Promise<any>,
	) {
		let promise = initialPromise;
		for (const { response, responseError } of exports.interceptors
			.slice()
			.reverse()) {
			if (response != null || responseError != null) {
				promise = promise.then(response, responseError);
			}
		}
		return promise;
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
	async function send<T = any>(
		options: BalenaRequestOptions,
	): Promise<BalenaRequestResponse<T>> {
		// Only set the default timeout when doing a normal HTTP
		// request and not also when streaming since in the latter
		// case we might cause unnecessary ESOCKETTIMEDOUT errors.
		if (options.timeout == null) {
			options.timeout = 59000;
		}

		return prepareOptions(options)
			.then(interceptRequestOptions, interceptRequestError)
			.then(async (opts) => {
				let response: BalenaRequestResponse | undefined;
				try {
					response = await requestAsync(opts);
				} catch (err: any) {
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
	}

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
	function stream(
		options: BalenaRequestOptions,
	): Promise<BalenaRequestStreamResult> {
		// eslint-disable-next-line @typescript-eslint/no-var-requires
		const progress = require('./progress') as typeof import('./progress');
		return prepareOptions(options)
			.then(interceptRequestOptions, interceptRequestError)
			.then(async (opts) => {
				const download = await progress.estimate(
					requestStream,
					isBrowser,
				)(opts);

				if (!utils.isErrorCode(download.response.statusCode)) {
					// TODO: Move this to balena-image-manager
					download.mime = download.response.headers.get('Content-Type');

					return download;
				}

				// If status code is an error code, interpret the body of the request as an error.
				const chunks: unknown[] = [];
				download.on('data', function (chunk: unknown) {
					chunks.push(chunk);
				});
				await new Promise((resolve, reject) => {
					download.on('error', reject);
					download.on('close', resolve);
					download.on('end', resolve);
					download.on('done', resolve);
				});
				const responseError = chunks.join() || 'The request was unsuccessful';

				debugRequest(options, download.response);
				// @ts-expect-error error without request options
				throw new errors.BalenaRequestError(
					responseError,
					download.response.statusCode,
				);
			})
			.then((x) => interceptResponse(x), interceptResponseError);
	}

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
	 * @summary Array of interceptor
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
	// Shortcut to get the correct jsdoc readme generated
	const interceptors = $interceptors;

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
	async function refreshToken({
		baseUrl,
	}: Pick<BalenaRequestOptions, 'baseUrl'>): Promise<string> {
		// Only refresh if we have balena-auth
		if (auth == null) {
			throw new Error('Auth module not provided in initializer');
		}

		let response: BalenaRequestResponse<string>;
		try {
			response = await send<string>({
				url: '/user/v1/refresh-token',
				baseUrl,
				refreshToken: false,
			});
		} catch (err: any) {
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
	}

	const exports = {
		send,
		stream,
		interceptors,
		refreshToken,
	};
	return exports;
}
