Bluebird = require('bluebird')
m = require('mochainon')
errors = require('balena-errors')

mockServer = require('mockttp').getLocal()

{ auth, request, IS_BROWSER } = require('./setup')()

RESPONSE_BODY = from: 'foobar'

describe 'responseFormat:', ->

	@timeout(10000)

	beforeEach ->
		Promise.all [
			auth.removeKey()
			mockServer.start()
		]

	afterEach ->
		mockServer.stop()

	describe 'given a JSON response with custom content-type', ->

		beforeEach ->
			mockServer.get('/').thenReply 200,
				JSON.stringify(RESPONSE_BODY)
				'Content-Type': 'application/x-my-json'

		it 'should return the plain string given no `responseFormat`', ->
			promise = request.send
				method: 'GET'
				baseUrl: mockServer.url
				url: '/'
			.then((v) -> v.body)
			m.chai.expect(promise).to.eventually.become(JSON.stringify(RESPONSE_BODY))

		it "should properly parse the response given the 'json' `responseFormat`", ->
			promise = request.send
				method: 'GET'
				baseUrl: mockServer.url
				url: '/'
				responseFormat: 'json'
			.then((v) -> v.body)
			m.chai.expect(promise).to.eventually.become(RESPONSE_BODY)

		it "should return null given the 'none' `responseFormat`", ->
			promise = request.send
				method: 'GET'
				baseUrl: mockServer.url
				url: '/'
				responseFormat: 'none'
			.then((v) -> v.body)
			m.chai.expect(promise).to.eventually.become(null)

		it "should return a blob/buffer given the 'blob' `responseFormat`", ->
			promise = request.send
				method: 'GET'
				baseUrl: mockServer.url
				url: '/'
				responseFormat: 'blob'
			.then ({ body }) ->
				# in node it's already a Buffer
				if not IS_BROWSER
					return body
				# use the FileReader to read the blob content as a string
				return new Promise (resolve) ->
					reader = new FileReader()
					reader.addEventListener 'loadend', ->
						resolve(reader.result)
					reader.readAsText(body)
			m.chai.expect(promise).to.eventually.satisfy (body) ->
				s = JSON.stringify(RESPONSE_BODY)
				if IS_BROWSER
					return body is s
				else
					b = new Buffer(s, 'utf-8')
					return b.compare(body) is 0

		it 'should throw given invalid `responseFormat`', ->
			promise = request.send
				method: 'GET'
				baseUrl: mockServer.url
				url: '/'
				responseFormat: 'uzabzabza'
			m.chai.expect(promise).to.be.rejectedWith(errors.BalenaInvalidParameterError)
