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

###*
# @module request
###
Promise = require('bluebird')
fetch = require('isomorphic-fetch')
fetch.Promise = Promise
# https://github.com/bitinn/node-fetch/blob/master/LIMITS.md

url = require('url')
_ = require('lodash')
rindle = require('rindle')

errors = require('resin-errors')
token = require('resin-token')
utils = require('./utils')
progress = require('./progress')

prepareResponse = (response, options) ->
	#map fetch response to a requestjs response
	response.request = {}
	response.request.headers = options.headers
	path = options.url.split('/')[options.url.split('/').length - 1]
	query = if options.url.includes('?')
    options.url.split('?')[options.url.split('?').length - 1]
  else null

	response.request.uri =
		url: options.url,
		query: query
		path: "/#{path}"

	response.statusCode = response.status
	contentType = response.headers._headers['content-type']

	switch
	 when _.includes(contentType, 'binary/octet-stream')
	  return response
	 when _.includes(contentType, 'application/json')
     response.json().then (body) ->
      # rea
      response.body = body
      response.from = response.body.from
      response.method = response.body.method
      return response
	 else
  	 response.text().then (body) ->
  		 response.body = body
  		 response.from = response.body.from
  		 response.method = response.body.method
  		 if not body
  			 response.body = options.body
  		 else
  			 response.body = body
  		 return response

prepareOptions = (options = {}) ->

	_.defaults options,
		method: 'GET'
		headers: {
			"Content-Type": "application/json",
			"Accept-Encoding": "compress, gzip"
		},
		refreshToken: true


	Promise.try ->
		return if not options.refreshToken

		utils.shouldUpdateToken().then (shouldUpdateToken) ->
			return if not shouldUpdateToken

			exports.send
				url: options.baseUrl + '/whoami'
				refreshToken: false

			# At this point we're sure there is a saved token,
			# however the fact that /whoami returns 401 allows
			# us to safely assume the token is expired
			.catch
				name: 'ResinRequestError'
				statusCode: 401
			, ->
				return token.get().tap(token.remove).then (sessionToken) ->
					throw new errors.ResinExpiredToken(sessionToken)
			.get('body')
			.then(token.set)

	.then(utils.getAuthorizationHeader).then (authorizationHeader) ->
		# console.log 'authheader', authorizationHeader
		if authorizationHeader?
			options.headers.Authorization = authorizationHeader

		if not _.isEmpty(options.apiKey)
			# Using `request` qs object results in dollar signs, or other
			# special characters used to query our OData API, being escaped
			# and thus leading to all sort of weird error.
			# The workaround is to append the `api_key` query string manually
			# to prevent affecting the rest of the query strings.
			# See https://github.com/request/request/issues/2129
			options.url += if url.parse(options.url).query? then '&' else '?'
			options.url += "api_key=#{options.apiKey}"

		# fetch doesn't support baseUrl
		if options.baseUrl
			options.url = options.baseUrl + options.url

		# check if body is plain text
		if !utils.isJson(options.body)
			delete options.headers['Content-Type']

		# console.log('prepareOptions', options)
		return options

###*
# @summary Perform an HTTP request to Resin.io
# @function
# @public
#
# @description
# This function automatically handles authorization with Resin.io.
#
# The module scans your environment for a saved session token. Alternatively, you may pass the `apiKey` options. Otherwise, the request is made anonymously.
#
# @param {Object} options - options
# @param {String} [options.method='GET'] - method
# @param {String} options.url - relative url
# @param {String} [options.apiKey] - api key
# @param {*} [options.body] - body
#
# @returns {Promise<Object>} response
#
# @example
# request.send
#	 method: 'GET'
#	 baseUrl: 'https://api.resin.io'
#	 url: '/foo'
# .get('body')
#
# @example
# request.send
#	 method: 'POST'
#	 baseUrl: 'https://api.resin.io'
#	 url: '/bar'
#	 data:
#		 hello: 'world'
# .get('body')
###
exports.send = (options = {}) ->

	# Only set a default timeout when doing a normal HTTP
	# request and not also when streaming since in the latter
	# case we might cause unnecessary ESOCKETTIMEDOUT errors.
	options.timeout ?= 30000

	prepareOptions(options).then((options) ->
		fetch(options.url, options)
		).then (response) ->
			if utils.isErrorCode(response.status)
				utils.getErrorMessageFromResponse(response).then (responseError) ->
					throw new errors.ResinRequestError(responseError, response.status)
			else
				return prepareResponse(response, options)

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
# - `String .mime`: Equals the value of the `Content-Type` HTTP header.
#
# See `request.send()` for an explanation on how this function handles authentication.
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
#	 method: 'GET'
#	 baseUrl: 'https://img.resin.io'
#	 url: '/download/foo'
# .then (stream) ->
#	 stream.on 'progress', (state) ->
#		 console.log(state)
#
#	 stream.pipe(fs.createWriteStream('/opt/download'))
###
exports.stream = (options = {}) ->
	prepareOptions(options).then(progress.estimate).then (download) ->
    prepareResponse(download.response, options).then (response) ->
      download.response = response

  		if not utils.isErrorCode(download.response.status)

  			# TODO: Move this to resin-image-manager
  			download.mime = download.response.headers._headers['content-type']

  			return download

  		# If status code is an error code, interpret
  		# the body of the request as an error.
  		return rindle.extract(download).then (data) ->
  			responseError = data or utils.getErrorMessageFromResponse(download.response)
  			utils.debugRequest(options, download.response)
  			throw new errors.ResinRequestError(responseError, download.response.status)
