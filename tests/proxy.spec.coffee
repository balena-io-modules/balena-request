_ = require('lodash')
m = require('mochainon')
globalTunnel = require('global-tunnel-ng')
EventEmitter = require('events')
child_process = require('child_process')
path = require('path')

IS_BROWSER = window?

{ auth, getCustomRequest } = require('./setup')()
request = getCustomRequest(null, false)

startProxy = (secure) ->
	events = new EventEmitter()
	scriptPath = path.join(__dirname, 'proxy', 'start-proxy.js')
	proxy = child_process.spawn('node', [ scriptPath, if secure then '1' else '' ])

	proxy.stdout.on 'data', (line) ->
		line = line.toString().trim()
		sep = line.indexOf(':')
		if sep >= 0
			event = line.substring(0, sep)
			arg = line.substring(sep + 1)
		else
			event = line
			arg = null
		events.emit(event, arg)

	proxy.on 'exit', ->
		events.emit('stop')

	return {
		on: events.on.bind(events)
		stop: ->
			proxy.kill()
	}

describe 'Proxy support', ->
	return if IS_BROWSER
	@timeout(10000)

	describe 'HTTP proxy', ->
		proxy = null
		proxyReached = false

		beforeEach (done) ->
			proxyReached = false
			proxy = startProxy()
			proxy.on 'request', ->
				proxyReached = true
			proxy.on 'start', (proxyAddr) ->
				globalTunnel.initialize(proxyAddr)
				done()

		afterEach (done) ->
			globalTunnel.end()
			proxy.on 'stop', -> done()
			proxy.stop()

		it 'should make requests', ->
			url = 'http://api.resin.io/ping'
			request.send({ url, refreshToken: false })
			.then (res) ->
				m.chai.expect(proxyReached).to.be.true
				m.chai.expect(res.body).to.equal('OK')

	describe 'HTTPS proxy', ->
		proxy = null
		proxyReached = false
		NODE_TLS_REJECT_UNAUTHORIZED = null

		before ->
			NODE_TLS_REJECT_UNAUTHORIZED = process.env.NODE_TLS_REJECT_UNAUTHORIZED
			process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

		beforeEach (done) ->
			proxy = startProxy(true)
			proxyReached = false
			proxy.on 'request', ->
				proxyReached = true
			proxy.on 'start', (proxyAddr) ->
				globalTunnel.initialize(proxyAddr)
				done()

		afterEach (done) ->
			proxy.on 'stop', -> done()
			proxy.stop()
			globalTunnel.end()

		after ->
			process.env.NODE_TLS_REJECT_UNAUTHORIZED = NODE_TLS_REJECT_UNAUTHORIZED

		it 'should make requests', ->
			url = 'https://api.resin.io/ping'
			request.send({ url, refreshToken: false })
			.then (res) ->
				m.chai.expect(proxyReached).to.be.true
				m.chai.expect(res.body).to.equal('OK')


