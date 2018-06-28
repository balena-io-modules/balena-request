_ = require('lodash')

IS_BROWSER = window?

dataDirectoryPath = null
if not IS_BROWSER
	temp = require('temp').track()
	dataDirectoryPath = temp.mkdirSync()

ResinAuth = require('resin-auth')['default']

auth = new ResinAuth({
	dataDirectory: dataDirectoryPath,
	tokenKey: 'token'
})

# Make sure any existing tokens are removed before the tests start
auth.removeKey()

getRequest = require('../lib/request')

getCustomRequest = (opts) ->
	opts = _.assign({}, { auth, debug: false, isBrowser: IS_BROWSER }, opts)
	return getRequest(opts)

module.exports = ->
	IS_BROWSER: IS_BROWSER
	auth: auth
	request: getCustomRequest()
	getCustomRequest: getCustomRequest
