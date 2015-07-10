###
The MIT License

Copyright (c) 2015 Resin.io, Inc. https://resin.io.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
###

###*
# @module request
###

Promise = require('bluebird')
request = require('request')
requestAsync = Promise.promisify(request)
progress = require('request-progress')
url = require('url')
_ = require('lodash')

errors = require('resin-errors')
settings = require('resin-settings-client')
utils = require('./utils')
estimate = require('./estimate')

prepareOptions = (options = {}) ->

	_.defaults options,
		method: 'GET'
		gzip: true
		json: true
		headers: {}

	options.url = url.resolve(settings.get('remoteUrl'), options.url)

	utils.getAuthorizationHeader().then (authorizationHeader) ->
		options.headers.Authorization = authorizationHeader
		return options

###*
# @summary Perform an HTTP request to Resin.io
# @function
# @public
#
# @description
# This function automatically handles authorizacion with Resin.io.
# If you don't have a token, the request is made anonymously.
# This function automatically prepends the Resin.io host, therefore you should pass relative urls.
#
# @param {Object} options - options
# @param {String} [options.method='GET'] - method
# @param {String} options.url - relative url
# @param {*} [options.body] - body
#
# @returns {Promise<Object>} response
#
# @example
# request.send
# 	method: 'GET'
# 	url: '/foo'
# .get('body')
#
# @example
# request.send
# 	method: 'POST'
# 	url: '/bar'
# 	data:
# 		hello: 'world'
# .get('body')
###
exports.send = (options = {}) ->
	prepareOptions(options).then(requestAsync).spread (response) ->

		if utils.isErrorCode(response.statusCode)
			responseError = utils.getErrorMessageFromResponse(response)
			throw new errors.ResinRequestError(responseError)

		return response

###*
# @summary Stream an HTTP response from Resin.io.
# @function
# @public
#
# @description
# This function emits a `progress` event, passing an object with the following properties:
#
# - `Number percent`: from 0 to 100.
# - `Number total`: total bytes to be transmitted.
# - `Number received`: number of bytes transmitted.
# - `Number eta`: estimated remaining time, in seconds.
#
# @param {Object} options - options
# @param {String} [options.method='GET'] - method
# @param {String} options.url - relative url
# @param {*} [options.body] - body
#
# @returns {Promise<Stream>} response
#
# @example
# request.stream
# 	method: 'GET'
# 	url: '/download/foo'
# .then (stream) ->
# 	stream.on 'progress', (state) ->
# 		console.log(state)
#
#		stream.pipe(fs.createWriteStream('/opt/download'))
###
exports.stream = (options = {}) ->
	prepareOptions(options).then (processedOptions) ->

		return new Promise (resolve, reject) ->

			download = progress(request(processedOptions))

			# Workaround to intercept the "progress" event emitted by
			# request-progress with our custom "eta" property.
			estimator = estimate.getEstimator()
			emit = download.emit
			download.emit = ->
				args = Array::slice.apply(arguments)
				args[1] = estimator(args[1]) if args[0] is 'progress'
				emit.apply(download, args)

			download.on 'response', (response) ->
				if not utils.isErrorCode(response.statusCode)
					return resolve(this)

				# If status code is an error code, interpret
				# the body of the request as an error.
				utils.getStreamData(this).then (data) ->
					responseError = data or utils.getErrorMessageFromResponse(response)
					return reject(new errors.ResinRequestError(responseError))
