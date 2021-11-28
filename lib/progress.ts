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

import * as utils from './utils';
import type { BalenaRequestOptions, BalenaRequestResponse } from './request';
import type { getRequestAsync } from './utils';
import type * as Stream from 'stream';

/**
 * @module progress
 */

/**
 * @summary Get progress stream
 * @function
 * @private
 *
 * @param {Number} total - response total
 * @param {Function} [onState] - on state callback (state)
 * @returns {NodeJS.ReadableStream} progress stream
 *
 * @example
 * progressStream = getProgressStream response, (state) ->
 * 	console.log(state)
 *
 * return responseStream.pipe(progressStream).pipe(output)
 */
const getProgressStream = function (
	total: number | undefined,
	onState?: (chunk: any) => void,
) {
	const progress =
		require('progress-stream') as typeof import('progress-stream');
	const progressStream = progress({
		time: 500,
		length: total,
	});

	progressStream.on('progress', function (state) {
		if (state.length === 0) {
			return typeof onState === 'function' ? onState(undefined) : undefined;
		}

		return typeof onState === 'function'
			? onState({
					total: state.length,
					received: state.transferred,
					eta: state.eta,
					percentage: state.percentage,
			  })
			: undefined;
	});

	return progressStream;
};

export interface BalenaRequestPassThroughStream extends Stream.PassThrough {
	response: BalenaRequestResponse;
	mime?: string | null;
}

/**
 * This callback is displayed as a global member.
 * @callback estimateStreamCallback
 * @param {BalenaRequestOptions} options
 *
 * @returns {Promise<NodeJS.ReadableStream>} request stream
 */

/**
 * @summary Make a node request with progress
 * @function
 * @protected
 *
 * @returns {estimateStreamCallback} request stream callback
 *
 * @example
 * progress.estimate(options).then (stream) ->
 * 		stream.pipe(fs.createWriteStream('foo/bar'))
 * 		stream.on 'progress', (state) ->
 * 			console.log(state)
 */
export function estimate(
	requestAsync?: ReturnType<typeof getRequestAsync>,
	isBrowser?: boolean,
) {
	return async function (
		options: BalenaRequestOptions,
	): Promise<BalenaRequestPassThroughStream> {
		if (requestAsync == null) {
			requestAsync = utils.getRequestAsync();
		}

		options.gzip = false;
		options.headers!['Accept-Encoding'] = 'gzip, deflate';

		let reader: any = null;

		if (options.signal != null) {
			options.signal.addEventListener(
				'abort',
				function () {
					// We need to react to Abort events at this level, because otherwise our
					// reader locks the stream and lower-level cancellation causes error.
					if (reader) {
						reader.cancel().catch(function () {
							// ignore
						});
						return reader.releaseLock();
					}
				},
				{ once: true },
			);
		}

		const response = await requestAsync(options);

		const stream = require('stream') as typeof Stream;
		const output = new stream.PassThrough() as BalenaRequestPassThroughStream;

		output.response = response;

		const responseLength = utils.getResponseLength(response);
		const total = responseLength.uncompressed || responseLength.compressed;

		let responseStream: any;
		if (response.body.getReader) {
			const webStreams = require('@balena/node-web-streams') as {
				toNodeReadable(body: any): any;
			};
			// Convert browser (WHATWG) streams to Node streams
			responseStream = webStreams.toNodeReadable(response.body);
			reader = responseStream._reader;
		} else {
			responseStream = response.body;
		}

		const progressStream = getProgressStream(total, (state) =>
			output.emit('progress', state),
		);

		if (!isBrowser && utils.isResponseCompressed(response)) {
			const zlib = require('zlib') as typeof import('zlib');

			// Be more lenient with decoding compressed responses, since (very rarely)
			// servers send slightly invalid gzip responses that are still accepted
			// by common browsers.
			// Always using Z_SYNC_FLUSH is what cURL does.
			let zlibOptions = {
				flush: zlib.constants.Z_SYNC_FLUSH,
				finishFlush: zlib.constants.Z_SYNC_FLUSH,
			};

			// Allow overriding this behaviour by setting the ZLIB_FLUSH env var
			// to one of the allowed zlib flush values (process.env.ZLIB_FLUSH="Z_NO_FLUSH").
			// https://github.com/nodejs/node/blob/master/doc/api/zlib.md#zlib-constants
			if (process.env.ZLIB_FLUSH && process.env.ZLIB_FLUSH in zlib.constants) {
				zlibOptions = {
					flush:
						zlib.constants[
							process.env.ZLIB_FLUSH as keyof typeof zlib.constants
						],
					finishFlush:
						zlib.constants[
							process.env.ZLIB_FLUSH as keyof typeof zlib.constants
						],
				};
			}

			const gunzip = zlib.createGunzip(zlibOptions);
			gunzip.on('error', (e) => output.emit('error', e));

			// Uncompress after or before piping through progress
			// depending on the response length available to us
			if (
				responseLength.compressed != null &&
				responseLength.uncompressed == null
			) {
				responseStream.pipe(progressStream).pipe(gunzip).pipe(output);
			} else {
				responseStream.pipe(gunzip).pipe(progressStream).pipe(output);
			}
		} else {
			responseStream.pipe(progressStream).pipe(output);
		}

		// Stream any request errors on downstream
		responseStream.on('error', (e: Error) => output.emit('error', e));

		return output;
	};
}
