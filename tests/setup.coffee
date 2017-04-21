_ = require('lodash')

IS_BROWSER = window?

{ fetchMock, mockedFetch } = require('resin-fetch-mock')

dataDirectory = null
if not IS_BROWSER
	temp = require('temp').track()
	dataDirectory = temp.mkdirSync()

token = require('resin-token')({ dataDirectory })
getRequest = require('../lib/request')

getCustomRequest = (opts, mockFetch = true) ->
	opts = _.assign({}, { token, debug: false, isBrowser: IS_BROWSER }, opts)
	request = getRequest(opts)
	request._setFetch(mockedFetch) if mockFetch
	return request

module.exports = ->
	IS_BROWSER: IS_BROWSER
	fetchMock: fetchMock
	token: token
	request: getCustomRequest()
	getCustomRequest: getCustomRequest
