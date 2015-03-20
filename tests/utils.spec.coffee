_ = require('lodash')
expect = require('chai').expect
sinon = require('sinon')
token = require('resin-token')
utils = require('../lib/utils')
connection = require('../lib/connection')

describe 'utils:', ->

	describe '.checkIfOnline()', ->

		describe 'given user is online', ->

			beforeEach ->
				@connectionIsOnlineStub = sinon.stub(connection, 'isOnline')
				@connectionIsOnlineStub.yields(null, true)

			afterEach ->
				@connectionIsOnlineStub.restore()

			it 'should call callback without errors', (done) ->
				utils.checkIfOnline (error) ->
					expect(error).to.not.exist
					done()

		describe 'given user is not online', ->

			beforeEach ->
				@connectionIsOnlineStub = sinon.stub(connection, 'isOnline')
				@connectionIsOnlineStub.yields(null, false)

			afterEach ->
				@connectionIsOnlineStub.restore()

			it 'should return an error', (done) ->
				utils.checkIfOnline (error) ->
					expect(error).to.be.an.instanceof(Error)
					expect(error.message).to.equal('You need internet connection to perform this task')
					done()

		describe 'given there was an error checking the connection status', ->

			beforeEach ->
				@connectionIsOnlineStub = sinon.stub(connection, 'isOnline')
				@connectionIsOnlineStub.yields(new Error('Connection Error'))

			afterEach ->
				@connectionIsOnlineStub.restore()

			it 'should return an error', (done) ->
				utils.checkIfOnline (error) ->
					expect(error).to.be.an.instanceof(Error)
					expect(error.message).to.equal('Connection Error')
					done()

	describe '.addAuthorizationHeader()', ->

		describe 'given no token', ->

			it 'should throw error', ->
				expect ->
					utils.addAuthorizationHeader({})
				.to.throw('Missing parameter: token')

		describe 'given a valid token', ->

			beforeEach ->
				@result = utils.addAuthorizationHeader({}, '1234')

			it 'should add an Authorization key', ->
				expect(@result.Authorization).to.exist

			it 'should equal to Bearer <token>', ->
				expect(@result.Authorization).to.equal('Bearer 1234')

		describe 'given no headers', ->

			beforeEach ->
				@result = utils.addAuthorizationHeader(null, '1234')

			it 'should add an Authorization key anyway', ->
				expect(@result.Authorization).to.exist

		describe 'given a headers object with an Authorization key', ->

			beforeEach ->
				@headers =
					Authorization: '1234'

			it 'should override the Authorization header', ->
				expect(@headers.Authorization).to.equal('1234')
				result = utils.addAuthorizationHeader(@headers, '1234')
				expect(result.Authorization).to.equal('Bearer 1234')

	describe '.authenticate()', ->

		describe 'given no options', ->

			it 'should throw an error', ->
				expect ->
					utils.authenticate(null, _.noop)
				.to.throw('Missing parameter: options')

		describe 'given there is a token', ->

			beforeEach ->
				token.set('1234')

			it 'should add the Authorization header', (done) ->
				options = {}
				utils.authenticate options, (error) ->
					expect(error).to.not.exist
					expect(options.headers.Authorization).to.equal('Bearer 1234')
					done()

		describe 'given there is no saved token', ->

			beforeEach ->
				token.remove()

			it 'should not add the Authorization header', (done) ->
				options = {}

				utils.authenticate options, (error) ->
					expect(error).to.not.exist
					expect(options).to.deep.equal({})
					done()

	describe '.pipeRequest()', ->

		describe 'if no options object', ->

			it 'should throw an error', ->
				expect ->
					utils.pipeRequest(null, _.noop, _.noop)
				.to.throw('Missing parameter: options')

		describe 'if no pipe option', ->

			it 'should throw an error', ->
				expect ->
					utils.pipeRequest({}, _.noop, _.noop)
				.to.throw('Missing option: pipe')

	describe '.sendRequest()', ->

		describe 'if request threw error', ->

			beforeEach ->
				@requestStub = sinon.stub(connection, 'request')
				@requestStub.yields(new Error('Request Error'))

			afterEach ->
				@requestStub.restore()

			it 'return the error', (done) ->
				utils.sendRequest {}, (error, response, body) ->
					expect(error).to.be.an.instanceof(Error)
					expect(error.message).to.equal('Request Error')
					expect(response).to.not.exist
					expect(body).to.not.exist
					done()

		describe 'if body contains stringified JSON', ->

			beforeEach ->
				@requestStub = sinon.stub(connection, 'request')
				@requestStub.yields null,
					statusCode: 200
					body: JSON.stringify(hello: 'world')

			afterEach ->
				@requestStub.restore()

			it 'should parse the body', (done) ->
				utils.sendRequest {}, (error, response, body) ->
					expect(error).to.not.exist
					expect(response.body).to.deep.equal(hello: 'world')
					expect(body).to.deep.equal(hello: 'world')
					done()

		describe 'if status code is equal or higher than 400', ->

			describe 'if the body is an object', ->
				beforeEach ->
					@requestStub = sinon.stub(connection, 'request')
					@requestStub.yields null,
						statusCode: 400
						body:
							error:
								text: 'Hello World Error'

				afterEach ->
					@requestStub.restore()

				it 'should return error.text', (done) ->
					utils.sendRequest {}, (error, response, body) ->
						expect(error).to.be.an.instanceof(Error)
						expect(error.message).to.equal('Request error: Hello World Error')
						expect(response).to.not.exist
						expect(body).to.not.exist
						done()

			describe 'if the body is a string', ->

				beforeEach ->
					@requestStub = sinon.stub(connection, 'request')
					@requestStub.yields null,
						statusCode: 400
						body: 'Status Code Error'

				afterEach ->
					@requestStub.restore()

				it 'should wrap the body as an error', (done) ->
					utils.sendRequest {}, (error, response, body) ->
						expect(error).to.be.an.instanceof(Error)
						expect(error.message).to.equal('Request error: Status Code Error')
						expect(response).to.not.exist
						expect(body).to.not.exist
						done()

		describe 'if body contains stringified JSON and status code is >= 400', ->

			beforeEach ->
				@requestStub = sinon.stub(connection, 'request')
				@requestStub.yields null,
					statusCode: 400
					body: JSON.stringify(hello: 'world')

			afterEach ->
				@requestStub.restore()

			it 'should not parse the body and send it stringified as an error', (done) ->
				utils.sendRequest {}, (error, response, body) ->
					expect(error).to.be.an.instanceof(Error)
					expect(error.message).to.deep.equal('Request error: ' + JSON.stringify(hello: 'world'))
					expect(response).to.not.exist
					expect(body).to.not.exist
					done()
