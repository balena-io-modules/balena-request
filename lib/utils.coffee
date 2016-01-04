###
Copyright 2016 Resin.io

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

Promise = require('bluebird')
_ = require('lodash')
request = require('request')
stream = require('stream')
progress = require('progress-stream')
settings = require('resin-settings-client')
token = require('resin-token')
rindle = require('rindle')

###*
# @summary Determine if the token should be updated
# @function
# @protected
#
# @description
# This function makes use of a soft user-configurable setting called `tokenRefreshInterval`.
# That setting doesn't express that the token is "invalid", but represents that it is a good time for the token to be updated *before* it get's outdated.
#
# @returns {Promise<Boolean>} the token should be updated
#
# @example
# tokenUtils.shouldUpdateToken().then (shouldUpdateToken) ->
# 	if shouldUpdateToken
# 		console.log('Updating token!')
###
exports.shouldUpdateToken = ->
	token.getAge().then (age) ->
		return age >= settings.get('tokenRefreshInterval')

###*
# @summary Get authorization header content
# @function
# @protected
#
# @description
# This promise becomes undefined if no saved token.
#
# @returns {Promise<String>} authorization header
#
# @example
# utils.getAuthorizationHeader().then (authorizationHeader) ->
#		headers =
#			Authorization: authorizationHeader
###
exports.getAuthorizationHeader = ->
	token.get().then (sessionToken) ->
		return if not sessionToken?
		return "Bearer #{sessionToken}"

###*
# @summary Get error message from response
# @function
# @protected
#
# @param {Object} response - node request response
# @returns {String} error message
#
# @example
# request
#		method: 'GET'
#		url: 'https://foo.bar'
#	, (error, response) ->
#		throw error if error?
#		message = utils.getErrorMessageFromResponse(response)
###
exports.getErrorMessageFromResponse = (response) ->
	if not response.body?
		return 'The request was unsuccessful'
	if response.body.error?
		return response.body.error.text
	return response.body

###*
# @summary Check if the status code represents an error
# @function
# @protected
#
# @param {Number} statusCode - status code
# @returns {Boolean} represents an error
#
# @example
# if utils.isErrorCode(400)
#		console.log('400 is an error code!')
###
exports.isErrorCode = (statusCode) ->
	return statusCode >= 400

###*
# @summary Make a node request with progress
# @function
# @protected
#
# @param {Object} options - request options
# @returns {Promise<Stream>} request stream
#
# @example
# utils.requestProgress(options).then (stream) ->
# 	stream.pipe(fs.createWriteStream('foo/bar'))
# 	stream.on 'progress', (state) ->
# 		console.log(state)
###
exports.requestProgress = (options) ->
	requestStream = request(options)

	rindle.onEvent(requestStream, 'response').tap (response) ->
		headers = response.headers

		# X-Transfer-Length equals the compressed size of the body.
		# This header is sent by Image Maker when downloading OS images.
		response.length = headers['content-length'] or headers['x-transfer-length']
		response.length = _.parseInt(response.length) or undefined

	.then (response) ->
		progressStream = progress
			time: 500
			length: response.length

		# Pipe to a pass through stream to modify
		# the state properties for backwards compatibility
		pass = new stream.PassThrough()
		progressStream.on 'progress', (state) ->
			if state.length is 0
				return pass.emit('progress', undefined)

			pass.emit 'progress',
				total: state.length
				received: state.transferred
				eta: state.eta
				percentage: state.percentage

		if response.headers['x-transfer-length']?
			responseData = response
		else
			responseData = requestStream

		responseData.pipe(progressStream).pipe(pass)

		pass.response = response

		return pass
