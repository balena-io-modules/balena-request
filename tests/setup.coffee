_ = require('lodash')
Promise = require('bluebird')

IS_BROWSER = window?

if (IS_BROWSER)
	# The browser mock assumes global fetch prototypes exist
	realFetchModule = require('fetch-ponyfill')({ Promise })
	global.Promise = Promise
	global.Headers = realFetchModule.Headers
	global.Request = realFetchModule.Request
	global.Response = realFetchModule.Response

fetchMock = require('fetch-mock').sandbox(Promise)
fetchMock.patch = (matcher, response, options) ->
	options = _.assign({}, options, { method: 'PATCH' })
	@mock(matcher, response, options)

utils = require('../lib/utils')
utils.fetch = fetchMock.fetchMock

getToken = require('resin-token')
getRequest = require('../lib/request')

dataDirectory = null
if not IS_BROWSER
	settings = require('resin-settings-client')
	dataDirectory = settings.get('dataDirectory')

getCustomRequest = (opts) ->
	opts = _.assign({}, opts, { dataDirectory, debug: false, isBrowser: IS_BROWSER })
	getRequest(opts)

module.exports = ->
	IS_BROWSER: IS_BROWSER
	fetchMock: fetchMock
	token: getToken({ dataDirectory })
	request: getCustomRequest()
	getCustomRequest: getCustomRequest
