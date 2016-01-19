Promise = require('bluebird')
m = require('mochainon')
nock = require('nock')
zlib = require('zlib')
PassThrough = require('stream').PassThrough
settings = require('resin-settings-client')
rindle = require('rindle')
token = require('resin-token')
tokens = require('./tokens.json')
johnDoeFixture = tokens.johndoe
janeDoeFixture = tokens.janedoe
request = require('../lib/request')
utils = require('../lib/utils')

describe 'Request:', ->

	describe 'given the token is always fresh', ->

		beforeEach ->
			@utilsShouldUpdateToken = m.sinon.stub(utils, 'shouldUpdateToken')
			@utilsShouldUpdateToken.returns(Promise.resolve(false))

		afterEach ->
			@utilsShouldUpdateToken.restore()

		describe '.send()', ->

			describe 'given a simple GET endpoint', ->

				beforeEach ->
					nock(settings.get('apiUrl')).get('/foo').reply(200, from: 'resin')

				afterEach ->
					nock.cleanAll()

				describe 'given an absolute url', ->

					beforeEach ->
						nock('https://foobar.baz').get('/foo').reply(200, from: 'foobar')

					afterEach ->
						nock.cleanAll()

					it 'should preserve the absolute url', ->
						promise = request.send
							method: 'GET'
							url: 'https://foobar.baz/foo'
						.get('body')
						m.chai.expect(promise).to.eventually.become(from: 'foobar')

				describe 'given there is a token', ->

					beforeEach ->
						token.set(johnDoeFixture.token)

					it 'should send an Authorization header', ->
						promise = request.send
							method: 'GET'
							url: '/foo'
						.get('request')
						.get('headers')
						.get('Authorization')
						m.chai.expect(promise).to.eventually.equal("Bearer #{johnDoeFixture.token}")

				describe 'given there is no token', ->

					beforeEach ->
						token.remove()

					it 'should not send an Authorization header', ->
						promise = request.send
							method: 'GET'
							url: '/foo'
						.get('request')
						.get('headers')
						.get('Authorization')
						m.chai.expect(promise).to.eventually.not.exist

			describe 'given multiple endpoints', ->

				beforeEach ->
					nock(settings.get('apiUrl'))
						.get('/foo').reply(200, method: 'GET')
						.post('/foo').reply(200, method: 'POST')
						.put('/foo').reply(200, method: 'PUT')
						.patch('/foo').reply(200, method: 'PATCH')
						.delete('/foo').reply(200, method: 'DELETE')

				afterEach ->
					nock.cleanAll()

				it 'should default to GET', ->
					promise = request.send
						url: '/foo'
					.get('body')
					m.chai.expect(promise).to.eventually.become(method: 'GET')

			describe 'given an endpoint that returns a non json response', ->

				beforeEach ->
					nock(settings.get('apiUrl')).get('/foo').reply(200, 'Hello World')

				afterEach ->
					nock.cleanAll()

				it 'should resolve with the plain body', ->
					promise = request.send
						method: 'GET'
						url: '/foo'
					.get('body')
					m.chai.expect(promise).to.eventually.equal('Hello World')

			describe 'given an endpoint that accepts a non json body', ->

				beforeEach ->
					nock(settings.get('apiUrl')).post('/foo').reply 200, (uri, body) ->
						return "The body is: #{body}"

				afterEach ->
					nock.cleanAll()

				it 'should take the plain body successfully', ->
					promise = request.send
						method: 'POST'
						url: '/foo'
						body: 'Qux'
					.get('body')
					m.chai.expect(promise).to.eventually.equal('The body is: Qux')

			describe 'given simple read only endpoints', ->

				describe 'given a GET endpoint', ->

					describe 'given no response error', ->

						beforeEach ->
							nock(settings.get('apiUrl')).get('/foo').reply(200, hello: 'world')

						afterEach ->
							nock.cleanAll()

						it 'should correctly make the request', ->
							promise = request.send
								method: 'GET'
								url: '/foo'
							.get('body')
							m.chai.expect(promise).to.eventually.become(hello: 'world')

					describe 'given a response error', ->

						beforeEach ->
							nock(settings.get('apiUrl')).get('/foo').reply(500, error: text: 'Server Error')

						afterEach ->
							nock.cleanAll()

						it 'should be rejected with the error message', ->
							promise = request.send
								method: 'GET'
								url: '/foo'
							m.chai.expect(promise).to.be.rejectedWith('Server Error')

				describe 'given a HEAD endpoint', ->

					describe 'given no response error', ->

						beforeEach ->
							nock(settings.get('apiUrl')).head('/foo').reply(200)

						afterEach ->
							nock.cleanAll()

						it 'should correctly make the request', ->
							promise = request.send
								method: 'HEAD'
								url: '/foo'
							.get('statusCode')
							m.chai.expect(promise).to.eventually.equal(200)

					describe 'given a response error', ->

						beforeEach ->
							nock(settings.get('apiUrl')).head('/foo').reply(500)

						afterEach ->
							nock.cleanAll()

						it 'should be rejected with a generic error message', ->
							promise = request.send
								method: 'HEAD'
								url: '/foo'
							.get('statusCode')
							m.chai.expect(promise).to.be.rejectedWith('The request was unsuccessful')

			describe 'given simple endpoints that handle a request body', ->

				describe 'given a POST endpoint that mirrors the request body', ->

					beforeEach ->
						nock(settings.get('apiUrl')).post('/foo').reply 200, (uri, body) ->
							return body

					afterEach ->
						nock.cleanAll()

					it 'should eventually return the body', ->
						promise = request.send
							method: 'POST'
							url: '/foo'
							body:
								foo: 'bar'
						.get('body')
						m.chai.expect(promise).to.eventually.become(foo: 'bar')

				describe 'given a PUT endpoint that mirrors the request body', ->

					beforeEach ->
						nock(settings.get('apiUrl')).put('/foo').reply 200, (uri, body) ->
							return body

					afterEach ->
						nock.cleanAll()

					it 'should eventually return the body', ->
						promise = request.send
							method: 'PUT'
							url: '/foo'
							body:
								foo: 'bar'
						.get('body')
						m.chai.expect(promise).to.eventually.become(foo: 'bar')

				describe 'given a PATCH endpoint that mirrors the request body', ->

					beforeEach ->
						nock(settings.get('apiUrl')).patch('/foo').reply 200, (uri, body) ->
							return body

					afterEach ->
						nock.cleanAll()

					it 'should eventually return the body', ->
						promise = request.send
							method: 'PATCH'
							url: '/foo'
							body:
								foo: 'bar'
						.get('body')
						m.chai.expect(promise).to.eventually.become(foo: 'bar')

				describe 'given a DELETE endpoint that mirrors the request body', ->

					beforeEach ->
						nock(settings.get('apiUrl')).delete('/foo').reply 200, (uri, body) ->
							return body

					afterEach ->
						nock.cleanAll()

					it 'should eventually return the body', ->
						promise = request.send
							method: 'DELETE'
							url: '/foo'
							body:
								foo: 'bar'
						.get('body')
						m.chai.expect(promise).to.eventually.become(foo: 'bar')

		describe '.stream()', ->

			describe 'given a simple endpoint that responds with an error', ->

				beforeEach ->
					nock(settings.get('apiUrl')).get('/foo').reply(400, 'Something happened')

				afterEach ->
					nock.cleanAll()

				it 'should reject with the error message', ->
					promise = request.stream
						method: 'GET'
						url: '/foo'

					m.chai.expect(promise).to.be.rejectedWith('Something happened')

			describe 'given a simple endpoint that responds with a string', ->

				beforeEach ->
					nock(settings.get('apiUrl')).get('/foo').reply(200, 'Lorem ipsum dolor sit amet')

				afterEach ->
					nock.cleanAll()

				it 'should be able to pipe the response', (done) ->
					request.stream
						method: 'GET'
						url: '/foo'
					.then(rindle.extract).then (data) ->
						m.chai.expect(data).to.equal('Lorem ipsum dolor sit amet')
					.nodeify(done)

				it 'should be able to pipe the response after a delay', (done) ->
					request.stream
						method: 'GET'
						url: '/foo'
					.then (stream) ->
						return Promise.delay(200).return(stream)
					.then (stream) ->
						pass = new PassThrough()
						stream.pipe(pass)

						rindle.extract(pass).then (data) ->
							m.chai.expect(data).to.equal('Lorem ipsum dolor sit amet')
						.nodeify(done)

				describe 'given there is a token', ->

					beforeEach ->
						token.set(johnDoeFixture.token)

					it 'should send an Authorization header', (done) ->
						request.stream
							method: 'GET'
							url: '/foo'
						.then (stream) ->
							stream.on 'response', (response) ->
								m.chai.expect(response.request.headers.Authorization).to.equal("Bearer #{johnDoeFixture.token}")
								done()

							rindle.extract(stream).return(undefined).nodeify(done)

				describe 'given there is no token', ->

					beforeEach ->
						token.remove()

					it 'should not send an Authorization header', (done) ->
						request.stream
							method: 'GET'
							url: '/foo'
						.then (stream) ->
							stream.on 'response', (response) ->
								m.chai.expect(response.request.headers.Authorization).to.not.exist

							rindle.extract(stream).return(undefined).nodeify(done)

			describe 'given multiple endpoints', ->

				beforeEach ->
					nock(settings.get('apiUrl'))
						.get('/foo').reply(200, 'GET')
						.post('/foo').reply(200, 'POST')
						.put('/foo').reply(200, 'PUT')
						.patch('/foo').reply(200, 'PATCH')
						.delete('/foo').reply(200, 'DELETE')

				afterEach ->
					nock.cleanAll()

				describe 'given no method option', ->

					it 'should default to GET', (done) ->
						request.stream
							url: '/foo'
						.then(rindle.extract).then (data) ->
							m.chai.expect(data).to.equal('GET')
						.nodeify(done)

			describe 'given an endpoint with a content-length header', ->

				beforeEach ->
					message = 'Lorem ipsum dolor sit amet'
					nock(settings.get('apiUrl'))
						.get('/foo').reply(200, message, 'Content-Length': String(message.length))

				afterEach ->
					nock.cleanAll()

				it 'should become a stream with a length property', (done) ->
					request.stream
						url: '/foo'
					.then (stream) ->
						m.chai.expect(stream.length).to.equal(26)
					.nodeify(done)

			describe 'given an gzip endpoint with a x-transfer-length header', ->

				beforeEach (done) ->
					message = 'Lorem ipsum dolor sit amet'
					zlib.gzip message, (error, compressedMessage) ->
						return done(error) if error?
						nock(settings.get('apiUrl'))
							.get('/foo')
							.reply 200, compressedMessage,
								'X-Transfer-Length': String(compressedMessage.length)
								'Content-Length': undefined
								'Content-Encoding': 'gzip'
						done()

				afterEach ->
					nock.cleanAll()

				it 'should correctly uncompress the body', (done) ->
					request.stream
						url: '/foo'
					.then (stream) ->
						return rindle.extract(stream)
					.then (data) ->
						m.chai.expect(data).to.equal('Lorem ipsum dolor sit amet')
						m.chai.expect(data.length).to.equal(26)
					.nodeify(done)

				it 'should set no .length property', (done) ->
					request.stream
						url: '/foo'
					.then (stream) ->
						m.chai.expect(stream.length).to.be.undefined
					.nodeify(done)

			describe 'given an gzip endpoint with a content-length header', ->

				beforeEach (done) ->
					message = 'Lorem ipsum dolor sit amet'
					zlib.gzip message, (error, compressedMessage) ->
						return done(error) if error?
						nock(settings.get('apiUrl'))
							.get('/foo')
							.reply 200, compressedMessage,
								'Content-Length': String(message.length)
								'Content-Encoding': 'gzip'
						done()

				afterEach ->
					nock.cleanAll()

				it 'should correctly uncompress the body', (done) ->
					request.stream
						url: '/foo'
					.then (stream) ->
						return rindle.extract(stream)
					.then (data) ->
						m.chai.expect(data).to.equal('Lorem ipsum dolor sit amet')
						m.chai.expect(data.length).to.equal(26)
					.nodeify(done)

				it 'should set a .length property', (done) ->
					request.stream
						url: '/foo'
					.then (stream) ->
						m.chai.expect(stream.length).to.equal(26)
					.nodeify(done)

			describe 'given an gzip endpoint with a content-length and x-transfer-length headers', ->

				beforeEach (done) ->
					message = 'Lorem ipsum dolor sit amet'
					zlib.gzip message, (error, compressedMessage) ->
						return done(error) if error?
						nock(settings.get('apiUrl'))
							.get('/foo')
							.reply 200, compressedMessage,
								'X-Transfer-Length': String(compressedMessage.length)
								'Content-Length': String(message.length)
								'Content-Encoding': 'gzip'
						done()

				afterEach ->
					nock.cleanAll()

				it 'should correctly uncompress the body', (done) ->
					request.stream
						url: '/foo'
					.then (stream) ->
						return rindle.extract(stream)
					.then (data) ->
						m.chai.expect(data).to.equal('Lorem ipsum dolor sit amet')
						m.chai.expect(data.length).to.equal(26)
					.nodeify(done)

				it 'should set a .length property', (done) ->
					request.stream
						url: '/foo'
					.then (stream) ->
						m.chai.expect(stream.length).to.equal(26)
					.nodeify(done)

			describe 'given an endpoint with an invalid content-length header', ->

				beforeEach ->
					message = 'Lorem ipsum dolor sit amet'
					nock(settings.get('apiUrl'))
						.get('/foo').reply(200, message, 'Content-Length': 'Hello')

				afterEach ->
					nock.cleanAll()

				it 'should become a stream with an undefined length property', (done) ->
					request.stream
						url: '/foo'
					.then (stream) ->
						m.chai.expect(stream.length).to.be.undefined
					.nodeify(done)

			describe 'given an endpoint with a content-type header', ->

				beforeEach ->
					message = 'Lorem ipsum dolor sit amet'
					nock(settings.get('apiUrl'))
						.get('/foo').reply(200, message, 'Content-Type': 'application/octet-stream')

				afterEach ->
					nock.cleanAll()

				it 'should become a stream with a mime property', (done) ->
					request.stream
						url: '/foo'
					.then (stream) ->
						m.chai.expect(stream.mime).to.equal('application/octet-stream')
					.nodeify(done)

	describe 'given the token needs to be updated', ->

		beforeEach (done) ->
			@utilsShouldUpdateToken = m.sinon.stub(utils, 'shouldUpdateToken')
			@utilsShouldUpdateToken.returns(Promise.resolve(true))

			token.set(johnDoeFixture.token).nodeify(done)


		afterEach ->
			@utilsShouldUpdateToken.restore()

		describe 'given a simplet GET endpoint', ->

			beforeEach ->
				nock(settings.get('apiUrl')).get('/foo').reply(200, 'bar')

			afterEach ->
				nock.cleanAll()

			describe 'given a working /whoami endpoint', ->

				beforeEach ->
					nock(settings.get('apiUrl'))
						.get('/whoami')
						.reply(200, janeDoeFixture.token)

				afterEach ->
					nock.cleanAll()

				it 'should refresh the token', (done) ->
					m.chai.expect(token.get()).to.eventually.equal(johnDoeFixture.token)

					request.send(url: '/foo').then (response) ->
						m.chai.expect(response.body).to.equal('bar')
						m.chai.expect(token.get()).to.eventually.equal(janeDoeFixture.token)
					.nodeify(done)

				# We could make the token request in parallel to avoid
				# having to wait for it to make the actual request.
				# Given the impact is minimal, the implementation aims
				# to simplicity.
				it 'should use the new token in the same request', (done) ->
					m.chai.expect(token.get()).to.eventually.equal(johnDoeFixture.token)
					request.send(url: '/foo').then (response) ->
						authorizationHeader = response.request.headers.Authorization
						m.chai.expect(authorizationHeader).to.equal("Bearer #{janeDoeFixture.token}")
					.nodeify(done)

			describe 'given a non working /whoami endpoint', ->

				beforeEach ->
					nock(settings.get('apiUrl'))
						.get('/whoami')
						.reply(401, 'Unauthorized')

				afterEach ->
					nock.cleanAll()

				it 'should be rejected with an error', ->
					promise = request.send(url: '/foo')
					m.chai.expect(promise).to.be.eventually.rejectedWith('Unauthorized')
