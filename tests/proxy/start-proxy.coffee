fs = require('fs')
path = require('path')
https = require('https')
Proxy = require('proxy')

module.exports = (secure) ->
	console.log("init:#{secure}")

	server = if secure
		options =
			key: fs.readFileSync(path.join(__dirname, 'ssl-cert-snakeoil.key'))
			cert: fs.readFileSync(path.join(__dirname, 'ssl-cert-snakeoil.pem'))
		https.createServer(options)
	else null

	proxy = Proxy(server)

	proxy.authenticate = (req, fn) ->
		console.log('request')
		fn(null, true)

	proxy.listen ->
		proxyPort = proxy.address().port
		proxyAddr = "http#{if secure then 's' else ''}://127.0.0.1:#{proxyPort}"
		console.log("start:#{proxyAddr}")

	process.on 'SIGTERM', ->
		proxy.close()
