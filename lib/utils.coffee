progress = require('request-progress')
errors = require('resin-errors')
token = require('resin-token')
connection = require('./connection')
ProgressState = require('./progress-state')

exports.checkIfOnline = (callback) ->
	connection.isOnline (error, isOnline) ->
		return callback(error) if error?
		return callback() if isOnline
		return callback(new errors.ResinNoInternetConnection())

exports.addAuthorizationHeader = (headers = {}, token) ->
	if not token?
		throw new errors.ResinMissingParameter('token')

	headers.Authorization = "Bearer #{token}"
	return headers

exports.authenticate = (options, callback) ->

	if not options?
		throw new errors.ResinMissingParameter('options')

	sessionToken = token.get()

	if sessionToken?
		options.headers = exports.addAuthorizationHeader(options.headers, sessionToken)

	return callback()

exports.pipeRequest = (options, callback, onProgress) ->

	if not options?
		throw new errors.ResinMissingParameter('options')

	if not options.pipe?
		throw new errors.ResinMissingOption('pipe')

	# TODO: Find a way to test this
	progress(connection.request(options))
		.on('progress', ProgressState.createFromNodeRequestProgress(onProgress))
		.on('error', callback)
		.pipe(options.pipe)
		.on('error', callback)
		.on('close', callback)

exports.sendRequest = (options, callback) ->
	connection.request options, (error, response) ->
		return callback(error) if error?

		if response.statusCode >= 400
			return callback(new errors.ResinRequestError(response.body))

		try
			response.body = JSON.parse(response.body)

		return callback(null, response, response.body)
