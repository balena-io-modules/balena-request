_ = require('lodash')
expect = require('chai').expect
fs = require('fs')
token = require('resin-token')
settings = require('resin-settings-client')
nock = require('nock')
url = require('url')
sinon = require('sinon')
mockFs = require('mock-fs')

request = require('../lib/request')
utils = require('../lib/utils')
connection = require('../lib/connection')

REMOTE_URL = settings.get('remoteUrl')

METHODS = [
	'GET'
	'HEAD'
	'POST'
	'PUT'
	'DELETE'
	'PATCH'
]

describe 'Request:', ->

	before ->
		@connectionIsOnlineStub = sinon.stub(connection, 'isOnline')
		@connectionIsOnlineStub.yields(null, true)

	after ->
		@connectionIsOnlineStub.restore()

	beforeEach ->
		@uris =
			ok: '/ok'
			nojson: '/nojson'
			error: '/error'

		@responses =
			nojson: 'NO JSON @responses'

		@status =
			ok: 'ok'
			error: 'error'

		nock(REMOTE_URL).get(@uris.nojson).reply(200, @responses.nojson)
		nock(REMOTE_URL).get(@uris.error).reply(400, status: @status.error)

		for method in METHODS
			lowercaseMethod = method.toLowerCase()
			nock(REMOTE_URL)[lowercaseMethod](@uris.ok).reply(200, status: @status.ok)

	describe '#request()', ->

		it 'should make a real HTTP request', (done) ->
			request.request {
				method: 'GET'
				url: @uris.ok
			}, (error, response) =>
				return done(error) if error?
				expect(response.body.status).to.equal(@status.ok)
				expect(response.statusCode).to.equal(200)
				done()

		it 'should make a GET request if method is omitted', (done) ->
			request.request {
				url: @uris.ok
			}, (error, response) ->
				return done(error) if error?
				expect(response.request.method).to.equal('GET')
				done()

		checkRequestType = (type) ->
			return (done) ->
				request.request {
					method: type
					url: @uris.ok
				}, (error, response) ->
					return done(error) if error?
					expect(response.request.method).to.equal(type)
					done()

		for method in METHODS
			it("should make a #{method} request if method is #{method}", checkRequestType(method))

		it 'should get a raw response of response is not JSON', (done) ->
			request.request {
				method: 'GET'
				url: @uris.nojson
			}, (error, response) =>
				return done(error) if error?
				expect(response.body).to.equal(@responses.nojson)
				done()

		it 'should parse the body', (done) ->
			request.request {
				method: 'GET'
				url: @uris.ok
			}, (error, response, body) ->
				expect(error).to.not.exist
				expect(body).to.be.an.object
				expect(body).not.to.be.a.string
				done()

		it 'should be able to send data in the body', (done) ->
			body = { hello: 'world' }

			request.request {
				method: 'POST'
				url: @uris.ok
				json: body
			}, (error, response) ->
				return done(error) if error?
				expect(response.request.body.toString()).to.equal(JSON.stringify(body))
				done()

		it 'should throw an error if method is unknown', (done) ->
			request.request {
				method: 'FOO'
				url: @uris.ok
			}, (error, response) ->
				expect(error).to.exist
				expect(error).to.be.an.instanceof(Error)
				done()

		it 'should throw an error if the status code is >= 400', (done) ->
			request.request {
				method: 'GET'
				url: @uris.error
			}, (error, response) ->
				expect(error).to.exist
				expect(error).to.be.an.instanceof(Error)
				done()

		it 'should accept a full url', (done) ->
			request.request {
				method: 'GET'
				url: url.resolve(REMOTE_URL, @uris.ok)
			}, (error, response) =>
				expect(error).to.not.exist
				expect(response.body.status).to.equal(@status.ok)
				done()

		it 'should allow piping files', (done) ->
			outputFile = '/hello'

			mockFs()
			request.request {
				method: 'GET'
				url: @uris.nojson
				pipe: fs.createWriteStream(outputFile)
				onProgress: _.noop
			}, (error) =>
				expect(error).to.not.exist
				fs.readFile outputFile, { encoding: 'utf8' }, (error, contents) =>
					expect(error).to.not.exist
					expect(contents).to.equal(@responses.nojson)
					mockFs.restore()
					done()

	describe 'given there is a token', ->

		beforeEach ->
			token.set('1234')

		describe '#request()', ->

			it 'should send the Authorization header', (done) ->

				request.request {
					method: 'GET'
					url: @uris.ok
				}, (error, response) ->
					authorizationHeader = response?.request.headers.Authorization

					expect(error).to.not.exist
					expect(authorizationHeader).to.exist
					expect(authorizationHeader).to.equal("Bearer #{1234}")
					done()

	describe 'given there is not a token', ->

		beforeEach ->
			token.remove()

		describe '#request()', ->

			it 'should not send the Authorization header', (done) ->
				request.request {
					method: 'GET'
					url: @uris.ok
				}, (error, response) ->
					expect(error).to.not.exist
					authorizationHeader = response?.request.headers.Authorization
					expect(authorizationHeader).to.not.exist
					done()

