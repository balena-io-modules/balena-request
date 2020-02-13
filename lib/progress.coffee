###
Copyright 2016 Balena

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	 http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
###

noop = require('lodash/noop')
webStreams = require('@balena/node-web-streams')
progress = require('progress-stream')
zlib = require('zlib')
stream = require('stream')

utils = require('./utils')

###*
# @module progress
###

###*
# @summary Get progress stream
# @function
# @private
#
# @param {Number} total - response total
# @param {Function} [onState] - on state callback (state)
# @returns {Stream} progress stream
#
# @example
# progressStream = getProgressStream response, (state) ->
# 	console.log(state)
#
# return responseStream.pipe(progressStream).pipe(output)
###
getProgressStream = (total, onState = noop) ->
	progressStream = progress
		time: 500
		length: total

	progressStream.on 'progress', (state) ->
		if state.length is 0
			return onState(undefined)

		return onState
			total: state.length
			received: state.transferred
			eta: state.eta
			percentage: state.percentage

	return progressStream

###*
# @summary Make a node request with progress
# @function
# @protected
#
# @param {Object} options - request options
# @returns {Promise<Stream>} request stream
#
# @example
# progress.estimate(options).then (stream) ->
#		stream.pipe(fs.createWriteStream('foo/bar'))
#		stream.on 'progress', (state) ->
#			console.log(state)
###
exports.estimate = (requestAsync, isBrowser) -> (options) ->
	requestAsync ?= utils.getRequestAsync()

	options.gzip = false
	options.headers['Accept-Encoding'] = 'gzip, deflate'

	reader = null

	if options.signal?
		options.signal.addEventListener 'abort', ->
			# We need to react to Abort events at this level, because otherwise our
			# reader locks the stream and lower-level cancellation causes error.
			if reader
				reader.cancel().catch(->)
				reader.releaseLock()
		, once: true


	return requestAsync(options)
	.then (response) ->
		output = new stream.PassThrough()
		output.response = response

		responseLength = utils.getResponseLength(response)
		total = responseLength.uncompressed or responseLength.compressed

		if response.body.getReader
			# Convert browser (WHATWG) streams to Node streams
			responseStream = webStreams.toNodeReadable(response.body)
			reader = responseStream._reader
		else
			responseStream = response.body

		progressStream = getProgressStream total, (state) ->
			output.emit('progress', state)

		if not isBrowser and utils.isResponseCompressed(response)
			gunzip = new zlib.createGunzip()

			# Uncompress after or before piping through progress
			# depending on the response length available to us
			if responseLength.compressed? and not responseLength.uncompressed?
				responseStream.pipe(progressStream).pipe(gunzip).pipe(output)
			else
				responseStream.pipe(gunzip).pipe(progressStream).pipe(output)

		else
			responseStream.pipe(progressStream).pipe(output)

		# Stream any request errors on downstream
		responseStream.on 'error', (e) ->
			output.emit('error', e)

		return output
