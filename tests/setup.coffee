Promise = require('bluebird')
global.Promise = Promise
require('isomorphic-fetch')

_ = require('lodash')

fetchMock = require('fetch-mock')
fetchMock.patch = (matcher, response, options) ->
	options = _.assign({}, options, { method: 'PATCH' })
	@mock(matcher, response, options)

getToken = require('resin-token')
getRequest = require('../lib/request')

IS_BROWSER = window?

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
