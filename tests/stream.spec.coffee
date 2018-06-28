Promise = require('bluebird')
m = require('mochainon')
zlib = require('zlib-browserify')
PassThrough = require('stream').PassThrough
rindle = require('rindle')

mockServer = require('mockttp').getLocal()

{ auth, request, IS_BROWSER } = require('./setup')()

describe 'Request (stream):', ->

	beforeEach ->
		Promise.all [
			auth.removeKey()
			mockServer.start()
		]

	afterEach ->
		mockServer.stop()

	describe 'given a simple endpoint that responds with an error', ->

		beforeEach ->
			mockServer.get('/foo').thenReply(400, 'Something happened')

		it 'should reject with the error message', ->
			promise = request.stream
				method: 'GET'
				baseUrl: mockServer.url
				url: '/foo'

			m.chai.expect(promise).to.be.rejectedWith('Something happened')

		it 'should have the status code in the error object', ->
			request.stream
				method: 'GET'
				baseUrl: mockServer.url
				url: '/foo'
			.catch (error) ->
				m.chai.expect(error.statusCode).to.equal(400)

	describe 'given a simple endpoint that responds with a string', ->

		beforeEach ->
			mockServer.get('/foo').thenReply(200, 'Lorem ipsum dolor sit amet')

		it 'should be able to pipe the response', ->
			request.stream
				method: 'GET'
				baseUrl: mockServer.url
				url: '/foo'
			.then(rindle.extract).then (data) ->
				m.chai.expect(data).to.equal('Lorem ipsum dolor sit amet')

		it 'should be able to pipe the response after a delay', ->
			request.stream
				method: 'GET'
				baseUrl: mockServer.url
				url: '/foo'
			.then (stream) ->
				return Promise.delay(200).return(stream)
			.then (stream) ->
				pass = new PassThrough()
				stream.pipe(pass)

				rindle.extract(pass).then (data) ->
					m.chai.expect(data).to.equal('Lorem ipsum dolor sit amet')

	describe 'given multiple endpoints', ->

		beforeEach ->
			['get', 'post', 'put', 'patch', 'delete'].forEach (method) ->
				mockServer[method]('/foo').thenReply(200, method.toUpperCase())

		describe 'given no method option', ->

			it 'should default to GET', ->
				request.stream
					baseUrl: mockServer.url
					url: '/foo'
				.then(rindle.extract).then (data) ->
					m.chai.expect(data).to.equal('GET')

	describe 'given a gzip endpoint with an x-transfer-length header', ->

		beforeEach (done) ->
			message = 'Lorem ipsum dolor sit amet'
			zlib.gzip message, (error, compressedMessage) ->
				return done(error) if error?
				mockServer.get('/foo').thenReply 200, compressedMessage,
					'Content-Type': 'text/plain'
					'X-Transfer-Length': '' + compressedMessage.length
					'Content-Encoding': 'gzip'
				.then(-> done())

		it 'should correctly uncompress the body', ->
			request.stream
				baseUrl: mockServer.url
				url: '/foo'
			.then (stream) ->
				return rindle.extract(stream)
			.then (data) ->
				m.chai.expect(data).to.equal('Lorem ipsum dolor sit amet')
				m.chai.expect(data.length).to.equal(26)

		it 'should set no .length property', ->
			request.stream
				baseUrl: mockServer.url
				url: '/foo'
			.then (stream) ->
				m.chai.expect(stream.length).to.be.undefined

	describe 'given an gzip endpoint with a content-length header', ->

		beforeEach (done) ->
			message = 'Lorem ipsum dolor sit amet'
			zlib.gzip message, (error, compressedMessage) ->
				return done(error) if error?
				mockServer.get('/foo').thenReply 200, compressedMessage,
					'Content-Type': 'text/plain'
					'Content-Length': '' + compressedMessage.length
					'Content-Encoding': 'gzip'
				.then(-> done())

		it 'should correctly uncompress the body', ->
			request.stream
				baseUrl: mockServer.url
				url: '/foo'
			.then (stream) ->
				return rindle.extract(stream)
			.then (data) ->
				m.chai.expect(data).to.equal('Lorem ipsum dolor sit amet')
				m.chai.expect(data.length).to.equal(26)

	describe 'given an gzip endpoint with a content-length and x-transfer-length headers', ->

		beforeEach (done) ->
			message = 'Lorem ipsum dolor sit amet'
			zlib.gzip message, (error, compressedMessage) ->
				return done(error) if error?
				mockServer.get('/foo').thenReply 200, compressedMessage,
					'Content-Type': 'text/plain'
					'X-Transfer-Length': '' + compressedMessage.length
					'Content-Length': '' + compressedMessage.length
					'Content-Encoding': 'gzip'
				.then(-> done())

		it 'should correctly uncompress the body', ->
			request.stream
				baseUrl: mockServer.url
				url: '/foo'
			.then (stream) ->
				return rindle.extract(stream)
			.then (data) ->
				m.chai.expect(data).to.equal('Lorem ipsum dolor sit amet')
				m.chai.expect(data.length).to.equal(26)

	describe 'given an endpoint with a content-type header', ->

		beforeEach ->
			message = 'Lorem ipsum dolor sit amet'
			mockServer.get('/foo').thenReply 200, message,
				'Content-Type': 'application/octet-stream'

		it 'should become a stream with a mime property', ->
			request.stream
				baseUrl: mockServer.url
				url: '/foo'
			.then (stream) ->
				m.chai.expect(stream.mime).to.equal('application/octet-stream')
