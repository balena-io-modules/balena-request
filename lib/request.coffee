_ = require('lodash')
async = require('async')
errors = require('resin-errors')
utils = require('./utils')

urlResolve = require('url').resolve

exports.request = (options = {}, callback, onProgress = _.noop) ->

	if not options.url?
		throw new errors.ResinMissingOption('url')

	# Instead of having to pass remoteUrl earh time, expose
	# a defaults object that gets merged to options each time.
	if not options.remoteUrl?
		throw new errors.ResinMissingOption('remoteUrl')

	options.url = urlResolve(options.remoteUrl, options.url)
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
