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
url = require('url')
_ = require('lodash')
rindle = require('rindle')

errors = require('resin-errors')
settings = require('resin-settings-client')
token = require('resin-token')
utils = require('./utils')

prepareOptions = (options = {}) ->

	_.defaults options,
		method: 'GET'
		gzip: true
		json: true
		headers: {}
		refreshToken: true

	options.url = url.resolve(settings.get('apiUrl'), options.url)

	Promise.try ->
		return if not options.refreshToken

		utils.shouldUpdateToken().then (shouldUpdateToken) ->
			return if not shouldUpdateToken

			exports.send
				url: '/whoami'
				refreshToken: false
			.get('body').then(token.set)

	.then(utils.getAuthorizationHeader).then (authorizationHeader) ->
		if authorizationHeader?
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
# The stream may also contain the following custom properties:
#
# - `Number .length`: Calculated from the `Content-Length` HTTP header.
# - `String .mime`: Equals the value of the `Content-Type` HTTP header.
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
	prepareOptions(options).then(utils.requestProgress).then (download) ->
		if not utils.isErrorCode(download.response.statusCode)

			# TODO: Move this to resin-image-manager
			download.length = download.response.length
			download.mime = download.response.headers['content-type']

			return download

		# If status code is an error code, interpret
		# the body of the request as an error.
		return rindle.extract(download).then (data) ->
			responseError = data or utils.getErrorMessageFromResponse(download.response)
			throw new errors.ResinRequestError(responseError)
