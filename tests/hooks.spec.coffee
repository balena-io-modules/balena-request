rindle = require('rindle')
Bluebird = require('bluebird')
m = require('mochainon')

mockServer = require('mockttp').getLocal()

utils = require('../build/utils')

{ auth, request } = require('./setup')()

describe 'An interceptor', ->

	@timeout(10000)

	beforeEach ->
		request.interceptors = []

		Promise.all [
			auth.removeKey(),
			mockServer.start().then ->
				Promise.all [
					mockServer.get('/').thenJSON(200, { requested: '/' })
					mockServer.get('/original').thenJSON(200, { requested: 'original' })
					mockServer.get('/changed').thenJSON(200, { requested: 'changed' })
				]
		]

	afterEach ->
		mockServer.stop()

	describe 'with a request hook', ->

		it 'should be able to change a request before it is sent', ->
			request.interceptors[0] = request: (request) ->
				Object.assign({}, request, url: mockServer.urlFor('/changed'))

			promise = request.send
				url: mockServer.urlFor('/original')
			.then((v) -> v.body)

			m.chai.expect(promise).to.eventually.become(requested: 'changed')

		it 'should be able to asynchronously change a request before it is sent', ->
			request.interceptors[0] = request: (request) ->
				Bluebird.delay(100).then ->
					Object.assign({}, request, url: mockServer.urlFor('/changed'))

			promise = request.send
				url: mockServer.urlFor('/original')
			.then((v) -> v.body)

			m.chai.expect(promise).to.eventually.become(requested: 'changed')

		it 'should be able to stop a request', ->
			request.interceptors[0] = request: ->
				throw new Error('blocked')

			promise = request.send
				url: mockServer.url
			.then((v) -> v.body)

			m.chai.expect(promise).to.be.rejectedWith('blocked')

		it 'should be able to change a stream request before it is sent', ->
			request.interceptors[0] = request: (request) ->
				Object.assign({}, request, url: mockServer.urlFor('/changed'))

			request.stream
				url: mockServer.urlFor('/original')
			.then(rindle.extract).then (data) ->
				body = JSON.parse(data)
				m.chai.expect(body).to.deep.equal(requested: 'changed')

	describe 'with a requestError hook', ->

		it 'should not call requestError if there are no errors', ->
			request.interceptors[0] =
				request: (request) -> Object.assign({}, request, url: mockServer.urlFor('/changed'))
				requestError: m.sinon.mock()
			request.interceptors[1] =
				requestError: m.sinon.mock()

			request.send
				url: mockServer.urlFor('/original')
			.then ({ body }) ->
				m.chai.expect(body).to.deep.equal(requested: 'changed')
				request.interceptors.forEach (interceptor) ->
					m.chai.expect(interceptor.requestError.called).to.equal false,
						'requestError should not have been called'

		it 'should call requestError only in the subsequent hook, if a previous hook fails', ->
			request.interceptors[0] =
				request: m.sinon.mock().throws(new Error('blocked'))
				requestError: m.sinon.mock()
			request.interceptors[1] =
				requestError: m.sinon.mock().throws(new Error('error overridden'))

			m.chai.expect(request.send(url: mockServer.url))
			.to.be.rejected
			.then (err) ->
				m.chai.expect(err.message).to.deep.equal('error overridden')
				m.chai.expect(request.interceptors[0].requestError.called).to.equal false,
					'Preceeding requestError hooks should not be called'
				m.chai.expect(request.interceptors[1].requestError.called).to.equal true,
					'Subsequent requestError hook should be called'

		describe 'with an expired token', ->
			beforeEach ->
				@utilsShouldUpdateToken = m.sinon.stub(utils, 'shouldRefreshKey').returns(true)

			afterEach ->
				@utilsShouldUpdateToken.restore()

			it 'should call requestError if the token is expired', ->
				request.interceptors[0] =
					requestError: m.sinon.mock().throws(new Error('intercepted auth failure'))

				promise = request.send
					url: mockServer.url

				m.chai.expect(promise).to.be.rejectedWith('intercepted auth failure')

			it 'should call requestError if the token is expired for stream()', ->
				request.interceptors[0] =
					requestError: m.sinon.mock().throws(new Error('intercepted auth failure'))

				promise = request.stream
					url: mockServer.url

				m.chai.expect(promise).to.be.rejectedWith('intercepted auth failure')

	describe 'with a response hook', ->

		it 'should be able to change a response before it is returned', ->
			request.interceptors[0] = response: (response) ->
				Object.assign({}, response, body: replaced: true)

			promise = request.send
				url: mockServer.url
			.then((v) -> v.body)

			m.chai.expect(promise).to.eventually.become(replaced: true)

		it 'should be able to asynchronously change a response before it is returned', ->
			request.interceptors[0] = response: (response) ->
				Bluebird.delay(100).then ->
					Object.assign({}, response, body: replaced: true)

			promise = request.send
				url: mockServer.url
			.then((v) -> v.body)

			m.chai.expect(promise).to.eventually.become(replaced: true)

		it 'should call the response hook for non-200 successful responses', ->
			mockServer.get('/201').thenReply(201)
			.then ->
				request.interceptors[0] =
					response: (response) -> Object.assign({}, response, body: replaced: true)

				request.send
					url: mockServer.urlFor('/201')
				.then (response) ->
					m.chai.expect(response.body).to.deep.equal(replaced: true)
					m.chai.expect(response.statusCode).to.equal(201)

		it 'should be able to change a stream response before it is returned', ->
			request.interceptors[0] = response: (response) ->
				rindle.getStreamFromString('replacement stream')

			request.stream
				url: mockServer.urlFor('/original')
			.then(rindle.extract).then (data) ->
				m.chai.expect(data).to.equal('replacement stream')

	describe 'with a responseError hook', ->

		it 'should not call responseError if there are no errors', ->
			request.interceptors[0] = responseError: m.sinon.mock()

			request.send
				url: mockServer.url
			.then ({ body }) ->
				m.chai.expect(body).to.deep.equal(requested: '/')
				m.chai.expect(request.interceptors[0].responseError.called).to.equal false,
					'responseError should not have been called'

		it 'should call responseError if the server returns a server error', ->
			mockServer.get('/500').thenReply(500)
			.then ->
				request.interceptors[0] = responseError:
					m.sinon.mock().throws(new Error('caught error'))

				promise = request.send
					url: mockServer.urlFor('/500')

				m.chai.expect(promise).to.be.rejectedWith('caught error')

		it 'should call responseError if the server returns an authentication error', ->
			mockServer.get('/401').thenReply(401)
			.then ->
				request.interceptors[0] = responseError:
					m.sinon.mock().throws(new Error('caught auth error'))

				promise = request.send
					url: mockServer.urlFor('/401')

				m.chai.expect(promise).to.be.rejectedWith('caught auth error')

		it 'should let responseError retry a different request', ->
			Promise.all [
				mockServer.get('/ok').thenReply(200)
				mockServer.get('/fail').thenReply(500)
			]
			.then ->
				request.interceptors[0] = responseError: (response) ->
					request.send
						url: mockServer.urlFor('/ok')

				promise = request.send
					url: mockServer.urlFor('/fail')
				.then((v) -> v.status)

				m.chai.expect(promise).to.eventually.become(200)

		it 'should give responseError the request options for server errors', ->
			mockServer.get('/500').thenReply(500)
			.then ->
				request.interceptors[0] = responseError: (err) ->
					throw err

				targetUrl = mockServer.urlFor('/500')

				m.chai.expect request.send
					url: targetUrl
					anotherExtraOption: true
				.to.be.rejected
				.then (err) ->
					m.chai.expect(err.requestOptions.url).to.equal(targetUrl)
					m.chai.expect(err.requestOptions.anotherExtraOption).to.equal(true)

		it 'should give responseError the request options for network errors', ->
			mockServer.get('/no-response').thenCloseConnection()
			.then ->
				request.interceptors[0] = responseError: (err) ->
					throw err

				targetUrl = mockServer.urlFor('/no-response')

				m.chai.expect request.send
					url: targetUrl
					anotherExtraOption: true
				.to.be.rejected
				.then (err) ->
					m.chai.expect(err.requestOptions.url).to.equal(targetUrl)
					m.chai.expect(err.requestOptions.anotherExtraOption).to.equal(true)

		it 'should call responseError if the server returns an error for a stream', ->
			mockServer.get('/500').thenReply(500)
			.then ->
				request.interceptors[0] = responseError:
					m.sinon.mock().throws(new Error('caught error'))

				promise = request.stream
					url: mockServer.urlFor('/500')

				m.chai.expect(promise).to.be.rejectedWith('caught error')
