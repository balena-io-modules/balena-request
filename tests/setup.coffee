_ = require('lodash')
Promise = require('bluebird')

IS_BROWSER = window?

if IS_BROWSER
	# The browser mock assumes global fetch prototypes exist
	# Can improve after https://github.com/wheresrhys/fetch-mock/issues/158
	realFetchModule = require('fetch-ponyfill')({ Promise })
	_.assign(global, _.pick(realFetchModule, 'Headers', 'Request', 'Response'))

fetchMock = require('fetch-mock').sandbox(Promise)

# Promise sandbox config needs a little help. See:
# https://github.com/wheresrhys/fetch-mock/issues/159#issuecomment-268249788
fetchMock.fetchMock.Promise = Promise

fetchMock.patch = (matcher, response, options) ->
	options = _.assign({}, options, { method: 'PATCH' })
	@mock(matcher, response, options)

utils = require('../lib/utils')
# Can probably just be 'fetchMock' after https://github.com/wheresrhys/fetch-mock/issues/159
utils.fetch = fetchMock.fetchMock

dataDirectory = null
if not IS_BROWSER
	temp = require('temp').track()
	dataDirectory = temp.mkdirSync()

token = require('resin-token')({ dataDirectory })
getRequest = require('../lib/request')

getCustomRequest = (opts) ->
	opts = _.assign({}, opts, { token, debug: false, isBrowser: IS_BROWSER })
	getRequest(opts)

module.exports = ->
	IS_BROWSER: IS_BROWSER
	fetchMock: fetchMock
	token: token
	request: getCustomRequest()
	getCustomRequest: getCustomRequest
