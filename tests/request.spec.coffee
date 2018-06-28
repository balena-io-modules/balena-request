_ = require('lodash')
Promise = require('bluebird')
m = require('mochainon')

mockServer = require('mockttp').getLocal()

{ auth, request, getCustomRequest, IS_BROWSER } = require('./setup')()

describe 'Request:', ->

	@timeout(10000)

	beforeEach ->
		Promise.all [
			auth.removeKey()
			mockServer.start()
		]

	afterEach ->
		mockServer.stop()

	describe '.send()', ->

		describe 'given a simple absolute GET endpoint', ->

			beforeEach ->
				mockServer.get('/foo').thenJSON(200, from: 'foobar')

			it 'should preserve the absolute url', ->
				promise = request.send
					method: 'GET'
					url: mockServer.urlFor('/foo')
				.get('body')
				m.chai.expect(promise).to.eventually.become(from: 'foobar')

			it 'should allow passing a baseUrl', ->
				promise = request.send
					method: 'GET'
					baseUrl: mockServer.url
					url: '/foo'
				.get('body')
				m.chai.expect(promise).to.eventually.become(from: 'foobar')

		describe 'given multiple endpoints', ->

			beforeEach ->
				Promise.all ['get', 'post', 'put', 'patch', 'delete'].map (method) ->
					mockServer[method]('/').thenJSON(200, method: method.toUpperCase())

			it 'should default to GET', ->
				promise = request.send
					url: mockServer.url
				.get('body')
				m.chai.expect(promise).to.eventually.become(method: 'GET')

		describe 'given an endpoint that returns a non json response', ->

			beforeEach ->
				mockServer.get('/non-json').thenReply(200, 'Hello World');

			it 'should resolve with the plain body', ->
				promise = request.send
					method: 'GET'
					baseUrl: mockServer.url
					url: '/non-json'
				.get('body')
				m.chai.expect(promise).to.eventually.equal('Hello World')

		describe 'given an endpoint that accepts a non-json body', ->

			beforeEach ->
				mockServer.post('/foo').withBody('Test body').thenJSON(200, { matched: true })

			it 'should send the plain body successfully', ->
				promise = request.send
					method: 'POST'
					baseUrl: mockServer.url
					url: '/foo'
					body: 'Test body'
					json: false
				.get('body')
				m.chai.expect(promise).to.eventually.become({ matched: true })

		describe 'given simple read only endpoints', ->

			describe 'given a GET endpoint', ->

				describe 'given no response error', ->

					beforeEach ->
						mockServer.get('/hello').thenJSON(200, hello: 'world')

					it 'should correctly make the request', ->
						promise = request.send
							method: 'GET'
							baseUrl: mockServer.url
							url: '/hello'
						.get('body')
						m.chai.expect(promise).to.eventually.become(hello: 'world')

				describe 'given a response error', ->

					beforeEach ->
						mockServer.get('/500').thenJSON(500, error: text: 'Server Error')

					it 'should be rejected with the error message', ->
						promise = request.send
							method: 'GET'
							baseUrl: mockServer.url
							url: '/500'
						m.chai.expect(promise).to.be.rejectedWith('Server Error')

					it 'should have the status code in the error object', ->
						request.send
							method: 'GET'
							baseUrl: mockServer.url
							url: '/500'
						.catch (error) ->
							m.chai.expect(error.statusCode).to.equal(500)

			describe 'given a HEAD endpoint', ->

				describe 'given no response error', ->

					beforeEach ->
						mockServer.head('/foo').thenReply(200)

					it 'should correctly make the request', ->
						promise = request.send
							method: 'HEAD'
							baseUrl: mockServer.url
							url: '/foo'
						.get('statusCode')
						m.chai.expect(promise).to.eventually.equal(200)

				describe 'given a response error', ->

					beforeEach ->
						mockServer.head('/foo').thenReply(500)

					it 'should be rejected with a generic error message', ->
						promise = request.send
							method: 'HEAD'
							baseUrl: mockServer.url
							url: '/foo'
						.get('statusCode')
						m.chai.expect(promise).to.be.rejectedWith('The request was unsuccessful')

		describe 'given simple endpoints that handle a request body', ->

			['delete', 'patch', 'put', 'post'].forEach (method) ->
				describe "given a #{method.toUpperCase()} endpoint that matches the request body", ->

					beforeEach ->
						mockServer[method]('/')
						.withBody(JSON.stringify({ foo: 'bar' }))
						.thenJSON(200, { matched: true })

					it 'should eventually return the body', ->
						promise = request.send
							method: method.toUpperCase()
							baseUrl: mockServer.url
							url: '/'
							body:
								foo: 'bar'
						.get('body')
						m.chai.expect(promise).to.eventually.become(matched: true)

		describe 'given an endpoint that fails the first two times', ->

			beforeEach ->
				mockServer.get('/initially-failing').twice().thenCloseConnection()
				.then ->
					mockServer.get('/initially-failing').thenJSON(200, result: 'success')

			it 'should fail by default', ->
				promise = request.send
					method: 'GET'
					url: mockServer.urlFor('/initially-failing')
				.get('body')
				m.chai.expect(promise).to.eventually.be.rejectedWith(Error)

			it 'should retry and fail if set to retry just once', ->
				promise = request.send
					method: 'GET'
					url: mockServer.urlFor('/initially-failing')
					retries: 1
				.get('body')
				m.chai.expect(promise).to.eventually.be.rejectedWith(Error)

			it 'should retry and eventually succeed if set to retry more than once', ->
				promise = request.send
					method: 'GET'
					url: mockServer.urlFor('/initially-failing')
					retries: 2
				.get('body')
				m.chai.expect(promise).to.eventually.become(result: 'success')

			it 'should retry and eventually succeed if set to retry more than once by default', ->
				retryingRequest = getCustomRequest({ retries: 2 })
				promise = retryingRequest.send
					method: 'GET'
					url: mockServer.urlFor('/initially-failing')
				.get('body')
				m.chai.expect(promise).to.eventually.become(result: 'success')

		describe 'given an endpoint that will time out', ->

			# Grab setTimeout before we replace it with a fake, so we can still
			# do real waiting in the tests themselves
			unstubbedSetTimeout = setTimeout
			delay = (delay) -> new Promise (resolve) ->
				unstubbedSetTimeout(resolve, delay)

			beforeEach ->
				@clock = m.sinon.useFakeTimers()
				mockServer.get('/infinite-wait').thenTimeout()

			afterEach ->
				@clock.restore()

			it 'should reject the promise after 30s by default', ->
				promise = request.send
					method: 'GET'
					url: mockServer.urlFor('/infinite-wait')
				.get('body')

				# Need to wait until the (async) request setup has completed
				# before we start manually managing the clock
				delay(100).then =>
					@clock.tick(29000)
					m.chai.expect(promise.isPending()).to.equal(true)

					@clock.tick(1000)
					m.chai.expect(promise).to.eventually.be.rejectedWith(Error)

			it 'should use a provided timeout option', ->
				promise = request.send
					method: 'GET'
					url: mockServer.urlFor('/infinite-wait')
					timeout: 500
				.get('body')

				# Need to wait until the (async) request setup has completed
				# before we start manually managing the clock
				delay(100).then =>
					@clock.tick(400)
					m.chai.expect(promise.isPending()).to.equal(true)

					@clock.tick(100)
					m.chai.expect(promise).to.eventually.be.rejectedWith(Error)

			it 'should be rejected by the correct error', ->
				promise = request.send
					method: 'GET'
					url: mockServer.urlFor('/infinite-wait')
				.get('body')

				# Need to wait until the (async) request setup has completed
				# before we start manually managing the clock
				delay(100).then =>
					@clock.tick(30000)

					if IS_BROWSER
						m.chai.expect(promise).to.be.rejectedWith(Promise.TimeoutError)
					else
						m.chai.expect(promise).to.be.rejectedWith(Error, 'network timeout')
