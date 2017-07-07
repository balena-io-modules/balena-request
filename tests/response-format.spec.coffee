_ = require('lodash')
Promise = require('bluebird')
m = require('mochainon')
errors = require('resin-errors')

{ token, request, fetchMock, IS_BROWSER } = require('./setup')()

RESPONSE_BODY = from: 'foobar'

describe 'responseFormat:', ->

	@timeout(10000)

	beforeEach ->
		token.remove()

	afterEach ->
		fetchMock.restore()

	describe 'given a JSON response with custom content-type', ->

		beforeEach ->
			fetchMock.get 'https://foobar.baz/foo',
				body: RESPONSE_BODY
				headers:
					'Content-Type': 'application/x-my-json'

		it 'should return the plain string given no `responseFormat`', ->
			promise = request.send
				method: 'GET'
				baseUrl: 'https://foobar.baz'
				url: '/foo'
			.get('body')
			m.chai.expect(promise).to.eventually.become(JSON.stringify(RESPONSE_BODY))

		it "should properly parse the response given the 'json' `responseFormat`", ->
			promise = request.send
				method: 'GET'
				baseUrl: 'https://foobar.baz'
				url: '/foo'
				responseFormat: 'json'
			.get('body')
			m.chai.expect(promise).to.eventually.become(RESPONSE_BODY)

		it "should return null given the 'none' `responseFormat`", ->
			promise = request.send
				method: 'GET'
				baseUrl: 'https://foobar.baz'
				url: '/foo'
				responseFormat: 'none'
			.get('body')
			m.chai.expect(promise).to.eventually.become(null)

		it "should return a blob/buffer given the 'blob' `responseFormat`", ->
			promise = request.send
				method: 'GET'
				baseUrl: 'https://foobar.baz'
				url: '/foo'
				responseFormat: 'blob'
			.get('body')
			.then (body) ->
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
				baseUrl: 'https://foobar.baz'
				url: '/foo'
				responseFormat: 'uzabzabza'
			.get('body')
			m.chai.expect(promise).to.be.rejectedWith(errors.ResinInvalidParameterError)
