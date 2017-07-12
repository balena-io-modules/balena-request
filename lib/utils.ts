/*
Copyright 2016-17 Resin.io

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

import * as Promise from 'bluebird';
import * as fetchPonyfill from 'fetch-ponyfill';
import urlLib from 'url';
import qs from 'qs';
import parseInt from 'lodash/parseInt';
import includes from 'lodash/includes';
import errors from 'resin-errors';

const { fetch: normalFetch, Headers } = fetchPonyfill({ Promise });

const IS_BROWSER = typeof window !== 'undefined' && window !== null;

/**
 * @module utils
 */

export const TOKEN_REFRESH_INTERVAL = 1 * 1000 * 60 * 60; // 1 hour in milliseconds

/**
 * @summary Determine if the token should be updated
 * @function
 * @protected
 *
 * @description
 * This function makes use of a soft user-configurable setting called `tokenRefreshInterval`.
 * That setting doesn't express that the token is "invalid", but represents that it is a good time for the token to be updated *before* it get's outdated.
 *
 * @param {Object} tokenInstance - an instance of `resin-token`
 * @returns {Promise<Boolean>} the token should be updated
 *
 * @example
 * tokenUtils.shouldUpdateToken(tokenInstance).then (shouldUpdateToken) ->
 *		if shouldUpdateToken
 *			console.log('Updating token!')
 */
export const shouldUpdateToken = token =>
	token.getAge().then(age => age >= TOKEN_REFRESH_INTERVAL);

/**
 * @summary Get authorization header content
 * @function
 * @protected
 *
 * @description
 * This promise becomes undefined if no saved token.
 *
 * @param {Object} tokenInstance - an instance of `resin-token`
 * @returns {Promise<String>} authorization header
 *
 * @example
 * utils.getAuthorizationHeader(tokenInstance).then (authorizationHeader) ->
 *		headers =
 *			Authorization: authorizationHeader
 */
export const getAuthorizationHeader = Promise.method(token => {
	if (token == null) {
		return;
	}
	return token.get().then(sessionToken => {
		if (sessionToken == null) {
			return;
		}
		return `Bearer ${sessionToken}`;
	});
});

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
 *		method: 'GET'
 *		url: 'https://foo.bar'
 *	, (error, response) ->
 *		throw error if error?
 *		message = utils.getErrorMessageFromResponse(response)
 */
export const getErrorMessageFromResponse = response => {
	if (!response.body) {
		return 'The request was unsuccessful';
	}
	if (response.body.error != null) {
		return response.body.error.text;
	}

	return response.body;
};

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
 *		console.log('400 is an error code!')
 */
export const isErrorCode = statusCode => statusCode >= 400;

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
export const isResponseCompressed = response =>
	response.headers.get('Content-Encoding') === 'gzip';

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
export const getResponseLength = response => {
	return {
		uncompressed:
			parseInt(response.headers.get('Content-Length'), 10) || undefined,
		// X-Transfer-Length equals the compressed size of the body.
		// This header is sent by Image Maker when downloading OS images.
		compressed:
			parseInt(response.headers.get('X-Transfer-Length'), 10) || undefined
	};
};

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
 *	 url: '/foo'
 * }
 *
 * request(options).spread (response) ->
 * 	utils.debugRequest(options, response)
 */
export const debugRequest = (options, response) => {
	return console.error(
		Object.assign(
			{
				statusCode: response.statusCode,
				duration: response.duration
			},
			options
		)
	);
};

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
	'callback'
];

const processRequestOptions = (options = {}) => {
	let url = options.url || options.uri;
	if (options.baseUrl) {
		url = urlLib.resolve(options.baseUrl, url);
	}
	if (options.qs) {
		const params = qs.stringify(options.qs);
		url += (url.indexOf('?') >= 0 ? '&' : '?') + params;
	}

	const opts = {};

	opts.timeout = options.timeout;
	opts.retries = options.retries;
	opts.method = options.method;
	opts.compress = options.gzip;

	let { body, headers } = options;
	if (typeof headers === 'undefined' || headers === null) {
		headers = {};
	}
	if (options.json && body) {
		body = JSON.stringify(body);
		headers['Content-Type'] = 'application/json';
	}

	opts.body = body;

	if (!IS_BROWSER) {
		if (!headers['Accept-Encoding']) {
			headers['Accept-Encoding'] = 'compress, gzip';
		}
	}

	if (options.followRedirect) {
		opts.redirect = 'follow';
	}

	opts.headers = new Headers(headers);

	if (options.strictSSL === false) {
		throw new Error('`strictSSL` must be true or absent');
	}

	for (const i = 0; i < UNSUPPORTED_REQUEST_PARAMS.length; i++) {
		const key = UNSUPPORTED_REQUEST_PARAMS[i];
		if (options[key] != null) {
			throw new Error(
				`The ${key} param is not supported. Value: ${options[key]}`
			);
		}
	}

	opts.mode = 'cors';

	return [url, opts];
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
export const getBody = (response, responseFormat) =>
	// wrap in Bluebird promise for extra methods
	Promise.try(() => {
		if (responseFormat === 'none') {
			return null;
		}

		const contentType = response.headers.get('Content-Type');

		if (
			responseFormat === 'blob' ||
			(responseFormat == null && includes(contentType, 'binary/octet-stream'))
		) {
			// this is according to the standard
			if (typeof response.blob === 'function') {
				return response.blob();
			}
			// https://github.com/bitinn/node-fetch/blob/master/lib/body.js#L66
			if (typeof response.buffer === 'function') {
				return response.buffer();
			}
			throw new Error(
				'This `fetch` implementation does not support decoding binary streams.'
			);
		}

		if (
			responseFormat === 'json' ||
			(responseFormat == null && includes(contentType, 'application/json'))
		) {
			return response.json();
		}

		if (responseFormat == null || responseFormat === 'text') {
			return response.text();
		}

		throw new errors.ResinInvalidParameterError(
			'responseFormat',
			responseFormat
		);
	});

// This is the actual implementation that hides the internal `retriesRemaining` parameter

const requestAsync = (fetch, options, retriesRemaining?: number) => {
	let [url, opts] = processRequestOptions(options);
	if (typeof retriesRemaining === 'undefined' || retriesRemaining === null) {
		retriesRemaining = opts.retries;
	}

	const requestTime = new Date().getTime();
	let p = fetch(url, opts);
	if (opts.timeout && IS_BROWSER) {
		p = p.timeout(opts.timeout);
	}

	p = p.then(response => {
		const responseTime = new Date().getTime();
		response.duration = responseTime - requestTime;
		response.statusCode = response.status;
		response.request = {
			headers: options.headers,
			uri: urlLib.parse(url)
		};
		return response;
	});

	if (retriesRemaining > 0) {
		return p.catch(() => requestAsync(fetch, options, retriesRemaining - 1));
	} else {
		return p;
	}
};

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
export const getRequestAsync = (fetch = normalFetch) => {
	return options => requestAsync(fetch, options);
};

export const notImplemented = () => {
	throw new Error('The method is not implemented.');
};

export const onlyIf = cond => fn => {
	if (cond) {
		return fn;
	} else {
		return notImplemented;
	}
};
