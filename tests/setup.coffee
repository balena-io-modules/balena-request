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

module.exports = ->
	IS_BROWSER: IS_BROWSER
	fetchMock: fetchMock
	token: getToken({ dataDirectory })
	request: getRequest({ dataDirectory, debug: false, isBrowser: IS_BROWSER })
