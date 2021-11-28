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

const {
	fetch: normalFetch,
	Headers: HeadersPonyfill,
} = (require('fetch-ponyfill') as typeof import('fetch-ponyfill'))({ Promise });

import * as urlLib from 'url';
import * as qs from 'qs';
import * as errors from 'balena-errors';
import type BalenaAuth from 'balena-auth';
import { TokenType } from 'balena-auth/build/token';
import type { BalenaRequestOptions, BalenaRequestResponse } from './request';

const IS_BROWSER = typeof window !== 'undefined' && window !== null;

/**
 * @module utils
 */

export const TOKEN_REFRESH_INTERVAL = 1 * 60 * 60 * 1000; // 1 hour in milliseconds

/**
 * @summary Determine if the token should be updated
 * @function
 * @protected
 *
 * @description
 * This function makes use of a soft user-configurable setting called `tokenRefreshInterval`.
 * That setting doesn't express that the token is "invalid", but represents that it is a good time for the token to be updated *before* it get's outdated.
 *
 * @param {import('balena-auth').default} auth - an instance of `balena-auth`
 * @returns {Promise<Boolean>} the token should be updated
 *
 * @example
 * tokenUtils.shouldRefreshKey(tokenInstance).then (shouldRefreshKey) ->
 * 		if shouldRefreshKey
 * 			console.log('Updating token!')
 */
export async function shouldRefreshKey(auth: BalenaAuth) {
	const hasKey = await auth.hasKey();
	if (!hasKey) {
		return false;
	}
	const type = await auth.getType();
	if (type !== TokenType.JWT) {
		return false;
	}
	const age = (await auth.getAge()) ?? 0;

	return age >= TOKEN_REFRESH_INTERVAL;
}

/**
 * @summary Get authorization header content
 * @function
 * @protected
 *
 * @description
 * This promise becomes undefined if no saved token.
 *
 * @param {import('balena-auth').default} auth - an instance of `balena-auth`
 * @returns {Promise<string | undefined>} authorization header
 *
 * @example
 * utils.getAuthorizationHeader(tokenInstance).then (authorizationHeader) ->
 * 		headers =
 * 			Authorization: authorizationHeader
 */
export async function getAuthorizationHeader(auth: BalenaAuth) {
	if (auth == null) {
		return;
	}
	const hasKey = await auth.hasKey();
	if (!hasKey) {
		return;
	}
	const key = await auth.getKey();
	return `Bearer ${key}`;
}

/**
 * @summary Get error message from response
 * @function
 * @protected
 *
 * @param {Object} response - node request response
 * @returns {String} error message
 *
 * @example
 * request
 * 		method: 'GET'
 * 		url: 'https://foo.bar'
 * 	, (error, response) ->
 * 		throw error if error?
 * 		message = utils.getErrorMessageFromResponse(response)
 */
export function getErrorMessageFromResponse(response: BalenaRequestResponse) {
	if (!response.body) {
		return 'The request was unsuccessful';
	}

	const errorText = response.body.error?.text;
	if (errorText != null) {
		return errorText;
	}

	return response.body;
}

/**
 * @summary Check if the status code represents an error
 * @function
 * @protected
 *
 * @param {Number} statusCode - status code
 * @returns {Boolean} represents an error
 *
 * @example
 * if utils.isErrorCode(400)
 * 		console.log('400 is an error code!')
 */
export function isErrorCode(statusCode: number) {
	return statusCode >= 400;
}

/**
 * @summary Check whether a response body is compressed
 * @function
 * @protected
 *
 * @param {Object} response - request response object
 * @returns {Boolean} whether the response body is compressed
 *
 * @example
 * if utils.isResponseCompressed(response)
 * 	console.log('The response body is compressed')
 */
export function isResponseCompressed(response: BalenaRequestResponse) {
	return response.headers.get('Content-Encoding') === 'gzip';
}

/**
 * @summary Get response compressed/uncompressed length
 * @function
 * @protected
 *
 * @param {Object} response - request response object
 * @returns {Object} response length
 *
 * @example
 * responseLength = utils.getResponseLength(response)
 * console.log(responseLength.compressed)
 * console.log(responseLength.uncompressed)
 */
export function getResponseLength(response: BalenaRequestResponse) {
	return {
		uncompressed:
			parseInt(response.headers.get('Content-Length')!, 10) || undefined,
		// X-Transfer-Length equals the compressed size of the body.
		// This header is sent by Image Maker when downloading OS images.
		compressed:
			parseInt(response.headers.get('X-Transfer-Length')!, 10) || undefined,
	};
}

/**
 * @summary Print debug information about a request/response.
 * @function
 * @protected
 *
 * @param {Object} options - request options
 * @param {Object} response - request response
 *
 * @example
 * options = {
 * 	method: 'GET'
 * 	 url: '/foo'
 * }
 *
 * request(options).spread (response) ->
 * 	utils.debugRequest(options, response)
 */
export function debugRequest(
	options: BalenaRequestOptions,
	response: BalenaRequestResponse,
) {
	return console.error({
		statusCode: response.statusCode,
		duration: response.duration,
		...options,
	});
}

// fetch adapter

const UNSUPPORTED_REQUEST_PARAMS = [
	'qsParseOptions',
	'qsStringifyOptions',
	'useQuerystring',
	'form',
	'formData',
	'multipart',
	'preambleCRLF',
	'postambleCRLF',
	'jsonReviver',
	'jsonReplacer',
	'auth',
	'oauth',
	'aws',
	'httpSignature',
	'followAllRedirects',
	'maxRedirects',
	'removeRefererHeader',
	'encoding',
	'jar',
	'agent',
	'agentClass',
	'agentOptions',
	'forever',
	'pool',
	'localAddress',
	'proxy',
	'proxyHeaderWhiteList',
	'proxyHeaderExclusiveList',
	'time',
	'har',
	'callback',
];

interface ProcessedRequestOptions extends RequestInit {
	headers: Headers;
	timeout?: number;
	retries: number;
	compress?: boolean;
}

const processRequestOptions = function (options: BalenaRequestOptions) {
	let url = options.url || options.uri;
	if (url == null) {
		throw new Error('url option not provided');
	}
	if (options.baseUrl) {
		url = urlLib.resolve(options.baseUrl, url);
	}
	if (options.qs) {
		const params = qs.stringify(options.qs);
		url += (url.indexOf('?') >= 0 ? '&' : '?') + params;
	}

	let { body, headers } = options;
	if (headers == null) {
		headers = {} as Record<string, string>;
	}
	if (options.json && body) {
		body = JSON.stringify(body);
		headers['Content-Type'] = 'application/json';
	}

	if (!IS_BROWSER) {
		if (!headers['Accept-Encoding']) {
			headers['Accept-Encoding'] = 'compress, gzip';
		}
	}

	if (options.strictSSL === false) {
		throw new Error('`strictSSL` must be true or absent');
	}

	for (const key of UNSUPPORTED_REQUEST_PARAMS) {
		const unsupportedOptionValue = options[key as keyof typeof options];
		if (unsupportedOptionValue != null) {
			throw new Error(
				`The ${key} param is not supported. Value: ${unsupportedOptionValue}`,
			);
		}
	}

	const opts: ProcessedRequestOptions = {
		timeout: options.timeout,
		retries: options.retries!,
		method: options.method,
		compress: options.gzip,
		signal: options.signal,
		body,
		headers: new HeadersPonyfill(headers),
		mode: 'cors',
		...(options.followRedirect && { redirect: 'follow' }),
	};

	return [url, opts] as const;
};

/**
 * @summary Extract the body from the server response
 * @function
 * @protected
 *
 * @param {Response} response
 * @param {String} [responseFormat] - explicit expected response format,
 * can be one of 'blob', 'json', 'text', 'none'. Defaults to sniffing the content-type
 *
 * @example
 * utils.getBody(response).then (body) ->
 * 	console.log(body)
 */
export async function getBody(
	response: BalenaRequestResponse,
	responseFormat?: string,
) {
	if (responseFormat === 'none') {
		return null;
	}

	const contentType = response.headers.get('Content-Type');

	if (
		responseFormat === 'blob' ||
		(responseFormat == null && contentType?.includes('binary/octet-stream'))
	) {
		// this is according to the standard
		if (typeof response.blob === 'function') {
			return response.blob();
		}
		// https://github.com/bitinn/node-fetch/blob/master/lib/body.js#L66
		// @ts-expect-error
		if (typeof response.buffer === 'function') {
			// @ts-expect-error
			return response.buffer();
		}
		throw new Error(
			'This `fetch` implementation does not support decoding binary streams.',
		);
	}

	if (
		responseFormat === 'json' ||
		(responseFormat == null && contentType?.includes('application/json'))
	) {
		return response.json();
	}

	if (responseFormat == null || responseFormat === 'text') {
		return response.text();
	}

	throw new errors.BalenaInvalidParameterError(
		'responseFormat',
		responseFormat,
	);
}

// This is the actual implementation that hides the internal `retriesRemaining` parameter

async function requestAsync(
	fetch: typeof normalFetch,
	options: BalenaRequestOptions,
	retriesRemaining?: number,
): Promise<BalenaRequestResponse> {
	const [url, opts] = processRequestOptions(options);
	if (retriesRemaining == null) {
		retriesRemaining = opts.retries;
	}

	// When streaming, prefer using the native Headers object if available
	if (fetch !== normalFetch && typeof Headers === 'function') {
		// Edge's Headers(args) ctor doesn't work as expected when passed in a headers object
		// from fetch-ponyfill, treating it as a plain object instead of using the iterator symbol.
		// As a result when fetch-readablestream uses the native fetch on Edge, the headers sent
		// to the server only contain a `map` property and not the actual headers that we want.
		const nativeHeaders = new Headers();
		opts.headers.forEach((value, name) => nativeHeaders.append(name, value));
		opts.headers = nativeHeaders;
	}

	try {
		const requestTime = Date.now();
		let p = fetch(url, opts);
		if (opts.timeout && IS_BROWSER) {
			p = new Promise((resolve, reject) => {
				setTimeout(() => {
					reject(new Error('network timeout'));
				}, opts.timeout);
				p.then(resolve, reject);
			});
		}

		const response = (await p) as BalenaRequestResponse;

		if (opts.signal) {
			handleAbortIfNotSupported(opts.signal, response);
		}

		const responseTime = Date.now();
		response.duration = responseTime - requestTime;
		response.statusCode = response.status;
		response.request = {
			headers: options.headers,
			uri: urlLib.parse(url),
		};
		return response;
	} catch (err) {
		if (retriesRemaining > 0) {
			return await requestAsync(fetch, options, retriesRemaining - 1);
		}
		throw err;
	}
}

function handleAbortIfNotSupported(
	signal: AbortSignal,
	response: BalenaRequestResponse,
) {
	const emulateAbort = (() => {
		if (response.body?.cancel) {
			// We have an XHR-emulated stream - cancel kills the underlying XHR
			// Context: https://github.com/jonnyreeves/fetch-readablestream/issues/6
			return () =>
				response.body.cancel().catch(function () {
					// ignore
				});
		} else if (response.body?.destroy) {
			// We have a Node stream - destroy kills the stream, and seems to kill
			// the underlying connection (hard to confirm - but it definitely stops streaming)
			// Once https://github.com/bitinn/node-fetch/issues/95 is released, we should
			// use that instead.
			return () => response.body.destroy();
		}
	})();

	if (emulateAbort) {
		if (signal.aborted) {
			return emulateAbort();
		} else {
			return signal.addEventListener('abort', () => emulateAbort(), {
				once: true,
			});
		}
	}
}

/**
 * @summary The factory that returns the `requestAsync` function.
 * @function
 * @protected
 *
 * @param {Function} [fetch] - the fetch implementation, defaults to that returned by `fetch-ponyfill`.
 *
 * @description The returned function keeps partial compatibility with promisified `request`
 * but uses `fetch` behind the scenes.
 * It accepts the `options` object.
 *
 * @example
 * utils.getRequestAsync()({ url: 'http://example.com' }).then (response) ->
 * 	console.log(response)
 */
export function getRequestAsync($fetch: typeof fetch = normalFetch) {
	return (options: BalenaRequestOptions) => requestAsync($fetch, options);
}
