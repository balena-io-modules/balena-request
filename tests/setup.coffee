_ = require('lodash')
Promise = require('bluebird')

IS_BROWSER = window?

{ fetchMock, mockedFetch } = require('resin-fetch-mock')

dataDirectory = null
if not IS_BROWSER
	temp = require('temp').track()
	dataDirectory = temp.mkdirSync()

token = require('resin-token')({ dataDirectory })
getRequest = require('../lib/request')
getRequest._setFetch(mockedFetch)

getCustomRequest = (opts) ->
	opts = _.assign({}, opts, { token, debug: false, isBrowser: IS_BROWSER })
	getRequest(opts)

module.exports = ->
	IS_BROWSER: IS_BROWSER
	fetchMock: fetchMock
	token: token
	request: getCustomRequest()
	getCustomRequest: getCustomRequest
