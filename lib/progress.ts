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

const IS_BROWSER = typeof window !== 'undefined' && window !== null;

export interface BalenaRequestStreamProgressEvent {
	total: number;
	received: number;
	eta: number;
	percentage: number;
}

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
	onState: (chunk: BalenaRequestStreamProgressEvent | undefined) => void,
) {
	const progress =
		// eslint-disable-next-line @typescript-eslint/no-var-requires
		require('progress-stream') as typeof import('progress-stream');
	const progressStream = progress({
		time: 500,
		length: total,
	});

	progressStream.on('progress', function (state) {
		onState(
			state.length === 0
				? undefined
				: {
						total: state.length,
						received: state.transferred,
						eta: state.eta,
						percentage: state.percentage,
					},
		);
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
export function estimate(requestAsync: ReturnType<typeof getRequestAsync>) {
	return async function (
		options: BalenaRequestOptions,
	): Promise<BalenaRequestPassThroughStream> {
		options.gzip = false;
		options.headers!['Accept-Encoding'] = 'gzip, deflate';

		let reader: ReadableStreamDefaultReader;

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
						reader.releaseLock();
						return;
					}
				},
				{ once: true },
			);
		}

		const response = await requestAsync(options);

		// eslint-disable-next-line @typescript-eslint/no-var-requires
		const stream = require('stream') as typeof Stream;
		const output = new stream.PassThrough() as BalenaRequestPassThroughStream;

		output.response = response;

		const responseLength = utils.getResponseLength(response);
		const total = responseLength.uncompressed ?? responseLength.compressed;

		let responseStream: any;
		if (response.body.getReader) {
			reader = response.body.getReader();
			// Convert browser (WHATWG) streams to Node streams
			responseStream = new stream.Readable({
				async read() {
					try {
						const { done, value } = await reader.read();
						if (done) {
							this.push(null);
							reader.releaseLock();
						} else {
							this.push(value);
						}
					} catch (e) {
						this.destroy(e as Error);
						reader.releaseLock();
					}
				},
			});
		} else {
			responseStream = response.body;
		}

		const progressStream = getProgressStream(total, (state) =>
			output.emit('progress', state),
		);

		if (!IS_BROWSER && utils.isResponseCompressed(response)) {
			const { createGunzip } =
				// eslint-disable-next-line @typescript-eslint/no-var-requires
				require('./conditional-imports') as typeof import('./conditional-imports');

			const gunzip = createGunzip();
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
