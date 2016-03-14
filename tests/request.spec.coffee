Promise = require('bluebird')
m = require('mochainon')
nock = require('nock')
zlib = require('zlib')
PassThrough = require('stream').PassThrough
settings = require('resin-settings-client')
errors = require('resin-errors')
rindle = require('rindle')
token = require('resin-token')
request = require('../lib/request')

describe 'Request:', ->

	@timeout(10000)

	describe 'given no token', ->

		beforeEach ->
			token.remove()

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

					it 'should allow passing a baseUrl', ->
						promise = request.send
							method: 'GET'
							baseUrl: 'https://foobar.baz'
							url: '/foo'
						.get('body')
						m.chai.expect(promise).to.eventually.become(from: 'foobar')

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

						it 'should have the status code in the error object', (done) ->
							request.send
								method: 'GET'
								url: '/foo'
							.catch (error) ->
								m.chai.expect(error.statusCode).to.equal(500)
								done()

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

				it 'should have the status code in the error object', (done) ->
					request.stream
						method: 'GET'
						url: '/foo'
					.catch (error) ->
						m.chai.expect(error.statusCode).to.equal(400)
						done()

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
