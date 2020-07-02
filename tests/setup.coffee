IS_BROWSER = window?

dataDirectoryPath = null
if not IS_BROWSER
	temp = require('temp').track()
	dataDirectoryPath = temp.mkdirSync()

BalenaAuth = require('balena-auth')['default']

auth = new BalenaAuth({
	dataDirectory: dataDirectoryPath,
	tokenKey: 'token'
})

# Make sure any existing tokens are removed before the tests start
auth.removeKey()

getRequest = require('../build/request')

getCustomRequest = (opts) ->
	opts = Object.assign({}, { auth, debug: false, isBrowser: IS_BROWSER }, opts)
	return getRequest(opts)

module.exports = ->
	IS_BROWSER: IS_BROWSER
	auth: auth
	request: getCustomRequest()
	getCustomRequest: getCustomRequest
