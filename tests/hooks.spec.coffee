_ = require('lodash')
Promise = require('bluebird')
m = require('mochainon')

utils = require('../lib/utils')

{ token, request, fetchMock } = require('./setup')()

describe 'An interceptor', ->

	@timeout(10000)

	beforeEach ->
		token.remove()
		fetchMock.get '*', (url, opts) ->
			body: requested: url
			headers:
				'Content-Type': 'application/json'

		request.interceptors = [
			request: undefined
			requestError: undefined
			response: undefined
			responseError: undefined
		]

	afterEach ->
		fetchMock.restore()

	describe 'with a request hook', ->

		it 'should be able to change a request before it is sent', ->
			request.interceptors[0].request = (request) ->
				_.assign({}, request, url: 'https://changed.com')

			promise = request.send
				url: 'https://original.com'
			.get('body')

			m.chai.expect(promise).to.eventually.become(requested: 'https://changed.com')

		it 'should be able to asynchronously change a request before it is sent', ->
			request.interceptors[0].request = (request) ->
				Promise.fromCallback (callback) ->
					setTimeout ->
						callback(null, _.assign({}, request, url: 'https://changed.com'))
					, 100

			promise = request.send
				url: 'https://original.com'
			.get('body')

			m.chai.expect(promise).to.eventually.become(requested: 'https://changed.com')

		it 'should be able to stop a request', ->
			request.interceptors[0].request = ->
				throw new Error('blocked')

			promise = request.send
				url: 'https://example.com'
			.get('body')

			m.chai.expect(promise).to.be.rejectedWith('blocked')

	describe 'with a requestError hook', ->

		it 'should not call requestError if there are no errors', ->
			request.interceptors[0] =
				request: (request) -> _.assign({}, request, url: 'https://changed.com')
				requestError: m.sinon.mock()
			request.interceptors[1] =
				requestError: m.sinon.mock()

			promise = request.send
				url: 'https://original.com'
			.get('body')
			.then (body) ->
				m.chai.expect(body).to.deep.equal(requested: 'https://changed.com')
				request.interceptors.forEach (interceptor) ->
					m.chai.expect(interceptor.requestError.called).to.equal false,
						'requestError should not have been called'

		it 'should call requestError only in the subsequent hook, if a previous hook fails', ->
			request.interceptors[0] =
				request: m.sinon.mock().throws(new Error('blocked'))
				requestError: m.sinon.mock()
			request.interceptors[1] =
				requestError: m.sinon.mock().throws(new Error('error overridden'))

			promise = request.send
				url: 'https://example.com'
			.get('body')
			.catch (err) ->
				m.chai.expect(err.message).to.deep.equal('error overridden')
				m.chai.expect(request.interceptors[0].requestError.called).to.equal false,
					'Preceeding requestError hooks should not be called'
				m.chai.expect(request.interceptors[1].requestError.called).to.equal true,
					'Subsequent requestError hook should be called'

	describe 'with a response hook', ->

		it 'should be able to change a response before it is returned', ->
			request.interceptors[0] =
				response: (response) -> _.assign({}, response, body: replaced: true)

			promise = request.send
				url: 'https://example.com'
			.get('body')

			m.chai.expect(promise).to.eventually.become(replaced: true)

		it 'should be able to asynchronously change a response before it is returned', ->
			request.interceptors[0] =
				response: (response) -> Promise.fromCallback (callback) ->
					setTimeout ->
						callback(null, _.assign({}, response, body: replaced: true))
					, 100

			promise = request.send
				url: 'https://example.com'
			.get('body')

			m.chai.expect(promise).to.eventually.become(replaced: true)

		it 'should call the response hook for non-200 successful responses', ->
			fetchMock.restore()
			fetchMock.get 'https://201.com', (url, opts) ->
				status: 201
				body: requested: url
				headers:
					'Content-Type': 'application/json'

			request.interceptors[0] =
				response: (response) -> _.assign({}, response, body: replaced: true)

			promise = request.send
				url: 'https://201.com'
			.then (response) ->
				m.chai.expect(response.body).to.deep.equal(replaced: true)
				m.chai.expect(response.statusCode).to.equal(201)

	describe 'with a responseError hook', ->

		it 'should not call requestError if there are no errors', ->
			request.interceptors[0] = responseError: m.sinon.mock()

			promise = request.send
				url: 'https://example.com'
			.get('body')
			.then (body) ->
				m.chai.expect(body).to.deep.equal(requested: 'https://example.com')
				m.chai.expect(request.interceptors[0].responseError.called).to.equal false,
					'responseError should not have been called'

		it 'should call requestError if the server returns a server error', ->
			fetchMock.restore()
			fetchMock.get 'https://500.com', (url, opts) ->
				status: 500

			request.interceptors[0] = responseError: m.sinon.mock().throws(new Error('caught error'))

			promise = request.send
				url: 'https://500.com'

			m.chai.expect(promise).to.be.rejectedWith('caught error')

		it 'should call requestError if the server returns an authentication error', ->
			fetchMock.restore()
			fetchMock.get 'https://401.com', (url, opts) ->
				status: 401

			request.interceptors[0] = responseError: m.sinon.mock().throws(new Error('caught auth error'))

			promise = request.send
				url: 'https://401.com'

			m.chai.expect(promise).to.be.rejectedWith('caught auth error')

		it 'should let requestError retry a different request', ->
			fetchMock.restore()
			fetchMock.get '*', (url, opts) ->
				if url is 'https://ok.com'
					status: 200
				else
					status: 500

			request.interceptors[0] = responseError: (response) ->
				request.send
					url: 'https://ok.com'

			promise = request.send
				url: 'https://error.com'
			.get('status')

			m.chai.expect(promise).to.eventually.become(200)

