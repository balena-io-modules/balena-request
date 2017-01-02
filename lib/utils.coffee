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
{ fetch, Headers } = require('fetch-ponyfill')({ Promise })
urlLib = require('url')
qs = require('qs')
parseInt = require('lodash/parseInt')
assign = require('lodash/assign')
includes = require('lodash/includes')

IS_BROWSER = window?

###*
# @module utils
###

# Expose for testing purposes
exports.fetch = fetch
exports.TOKEN_REFRESH_INTERVAL = 1 * 1000 * 60 * 60 # 1 hour in milliseconds

###*
# @summary Determine if the token should be updated
# @function
# @protected
#
# @description
# This function makes use of a soft user-configurable setting called `tokenRefreshInterval`.
# That setting doesn't express that the token is "invalid", but represents that it is a good time for the token to be updated *before* it get's outdated.
#
# @param {Object} tokenInstance - an instance of `resin-token`
# @returns {Promise<Boolean>} the token should be updated
#
# @example
# tokenUtils.shouldUpdateToken(tokenInstance).then (shouldUpdateToken) ->
#		if shouldUpdateToken
#			console.log('Updating token!')
###
exports.shouldUpdateToken = (token) ->
	token.getAge().then (age) ->
		return age >= exports.TOKEN_REFRESH_INTERVAL

###*
# @summary Get authorization header content
# @function
# @protected
#
# @description
# This promise becomes undefined if no saved token.
#
# @param {Object} tokenInstance - an instance of `resin-token`
# @returns {Promise<String>} authorization header
#
# @example
# utils.getAuthorizationHeader(tokenInstance).then (authorizationHeader) ->
#		headers =
#			Authorization: authorizationHeader
###
exports.getAuthorizationHeader = (token) ->
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
	if not response.body
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
# @summary Check whether a response body is compressed
# @function
# @protected
#
# @param {Object} response - request response object
# @returns {Boolean} whether the response body is compressed
#
# @example
# if utils.isResponseCompressed(response)
# 	console.log('The response body is compressed')
###
exports.isResponseCompressed = (response) ->
	return response.headers.get('Content-Encoding') is 'gzip'

###*
# @summary Get response compressed/uncompressed length
# @function
# @protected
#
# @param {Object} response - request response object
# @returns {Object} response length
#
# @example
# responseLength = utils.getResponseLength(response)
# console.log(responseLength.compressed)
# console.log(responseLength.uncompressed)
###
exports.getResponseLength = (response) ->
	return {
		uncompressed: parseInt(response.headers.get('Content-Length'), 10) or undefined
		# X-Transfer-Length equals the compressed size of the body.
		# This header is sent by Image Maker when downloading OS images.
		compressed: parseInt(response.headers.get('X-Transfer-Length'), 10) or undefined
	}

###*
# @summary Print debug information about a request/response.
# @function
# @protected
#
# @param {Object} options - request options
# @param {Object} response - request response
#
# @example
# options = {
# 	method: 'GET'
#	 url: '/foo'
# }
#
# request(options).spread (response) ->
# 	utils.debugRequest(options, response)
###
exports.debugRequest = (options, response) ->
	console.error(assign(
		statusCode: response.statusCode
		duration: response.duration
	, options))

# fetch adapter

UNSUPPORTED_REQUEST_PARAMS = [
	'qsParseOptions'
	'qsStringifyOptions'
	'useQuerystring'
	'form'
	'formData'
	'multipart'
	'preambleCRLF'
	'postambleCRLF'
	'jsonReviver'
	'jsonReplacer'
	'auth'
	'oauth'
	'aws'
	'httpSignature'
	'followAllRedirects'
	'maxRedirects'
	'removeRefererHeader'
	'encoding'
	'jar'
	'agent'
	'agentClass'
	'agentOptions'
	'forever'
	'pool'
	'localAddress'
	'proxy'
	'proxyHeaderWhiteList'
	'proxyHeaderExclusiveList'
	'time'
	'har'
	'callback'
]

processRequestOptions = (options = {}) ->
	url = options.url or options.uri
	if options.baseUrl
		url = urlLib.resolve(options.baseUrl, url)
	if options.qs
		params = qs.stringify(options.qs)
		url += (if url.indexOf('?') >= 0 then '&' else '?') + params

	opts = {}

	opts.timeout = options.timeout
	opts.retries = options.retries
	opts.method = options.method
	opts.compress = options.gzip

	{ body, headers } = options
	headers ?= {}
	if options.json and body
		body = JSON.stringify(body)
		headers['Content-Type'] = 'application/json'

	opts.body = body

	headers['Accept-Encoding'] or= 'compress, gzip'

	if options.followRedirect
		opts.redirect = 'follow'

	opts.headers = new Headers(headers)

	if options.strictSSL is false
		throw new Error('`strictSSL` must be true or absent')

	for key in UNSUPPORTED_REQUEST_PARAMS
		if options[key]?
			throw new Error("The #{key} param is not supported. Value: #{options[key]}")

	opts.mode = 'cors'

	return [ url, opts ]

###*
# @summary Extract the body from the server response
# @function
# @protected
#
# @param {Response} response
#
# @example
# utils.getBody(response).then (body) ->
# 	console.log(body)
###
exports.getBody = processBody = (response) ->
	# wrap in Bluebird promise for extra methods
	return Promise.try ->
		contentType = response.headers.get('Content-Type')

		if includes(contentType, 'binary/octet-stream')
			# this is according to the standard
			if typeof response.blob is 'function'
				return response.blob()
			# https://github.com/bitinn/node-fetch/blob/master/lib/body.js#L66
			if typeof response.buffer is 'function'
				return response.buffer()
			throw new Error('This `fetch` implementation does not support decoding binary streams.')

		if includes(contentType, 'application/json')
			return response.json()

		return response.text()

###*
# @summary The method that keeps partial compatibility with promisified `request` but uses `fetch` behind the scenes.
# @function
# @protected
#
# @param {Object} options
# @param {number} [retriesRemaining=undefined] Number of retries remaining for this request
#
# @example
# utils.requestAsync({ url: 'http://example.com' }).then (response) ->
# 	console.log(response)
###
exports.requestAsync = (options, retriesRemaining) ->
	[ url, opts ] = processRequestOptions(options)
	retriesRemaining ?= opts.retries

	requestTime = new Date()
	p = exports.fetch(url, opts)
	if opts.timeout and IS_BROWSER
		p = p.timeout(opts.timeout)

	p = p.then (response) ->
		responseTime = new Date()
		response.duration = responseTime - requestTime
		response.statusCode = response.status
		response.request =
			headers: options.headers
			uri: urlLib.parse(url)
		return response

	if retriesRemaining > 0 then p.catch ->
		exports.requestAsync(options, retriesRemaining - 1)
	else p

exports.notImplemented = notImplemented = ->
	throw new Error('The method is not implemented.')

exports.onlyIf = (cond) -> (fn) -> if cond then fn else notImplemented
