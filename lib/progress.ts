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

import noop from 'lodash/noop';
import utils from './utils';

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
 * @returns {Stream} progress stream
 *
 * @example
 * progressStream = getProgressStream response, (state) ->
 * 	console.log(state)
 *
 * return responseStream.pipe(progressStream).pipe(output)
 */
let getProgressStream = (total, onState = noop) => {
	let progress = require('progress-stream');

	let progressStream = progress({
		time: 500,
		length: total
	});

	progressStream.on('progress', state => {
		if (state.length === 0) {
			return onState();
		}

		return onState({
			total: state.length,
			received: state.transferred,
			eta: state.eta,
			percentage: state.percentage
		});
	});

	return progressStream;
};

/**
 * @summary Make a node request with progress
 * @function
 * @protected
 *
 * @description **Not implemented for the browser.**
 *
 * @param {Object} options - request options
 * @returns {Promise<Stream>} request stream
 *
 * @example
 * progress.estimate(options).then (stream) ->
 *		stream.pipe(fs.createWriteStream('foo/bar'))
 *		stream.on 'progress', (state) ->
 *			console.log(state)
 */
export const estimate = requestAsync => {
	return options => {
		if (typeof requestAsync === 'undefined' || requestAsync === null) {
			requestAsync = utils.getRequestAsync();
		}

		const zlib = require('zlib');
		const stream = require('stream');

		options.gzip = false;
		options.headers['Accept-Encoding'] = 'gzip, deflate';

		return requestAsync(options).then(response => {
			const output = new stream.PassThrough();
			output.response = response;

			const responseLength = utils.getResponseLength(response);
			const total = responseLength.uncompressed || responseLength.compressed;

			const responseStream = response.body;

			const progressStream = getProgressStream(total, state =>
				output.emit('progress', state)
			);

			if (utils.isResponseCompressed(response)) {
				const gunzip = new zlib.createGunzip();

				// Uncompress after or before piping trough progress
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

			return output;
		});
	};
};
