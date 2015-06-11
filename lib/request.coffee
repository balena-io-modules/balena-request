_ = require('lodash')
async = require('async')
errors = require('resin-errors')
settings = require('resin-settings-client')
utils = require('./utils')

urlResolve = require('url').resolve

exports.request = (options = {}, callback) ->

	if not options.url?
		throw new errors.ResinMissingOption('url')

	options.url = urlResolve(settings.get('remoteUrl'), options.url)
	options.method = options.method.toUpperCase() if options.method?

	_.defaults options,
		method: 'GET'
		gzip: true
		onProgress: _.noop

	async.waterfall([

		(callback) ->
			utils.checkIfOnline(callback)

		(callback) ->
			utils.authenticate(options, callback)

		(callback) ->
			if options.pipe?
				utils.pipeRequest(options, callback)
			else
				utils.sendRequest(options, callback)

	], callback)
