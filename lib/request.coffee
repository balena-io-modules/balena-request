_ = require('lodash')
async = require('async')
errors = require('resin-errors')
settings = require('resin-settings-client')
utils = require('./utils')

urlResolve = require('url').resolve

exports.request = (options = {}, callback, onProgress = _.noop) ->

	if not options.url?
		throw new errors.ResinMissingOption('url')

	options.url = urlResolve(settings.get('remoteUrl'), options.url)
	options.method = options.method.toUpperCase() if options.method?

	_.defaults options,
		method: 'GET'
		gzip: true

	async.waterfall([

		(callback) ->
			utils.checkIfOnline(callback)

		(callback) ->
			utils.authenticate(options, callback)

		(callback) ->
			if options.pipe?
				utils.pipeRequest(options, callback, onProgress)
			else
				utils.sendRequest(options, callback)

	], callback)
