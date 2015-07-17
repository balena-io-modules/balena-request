ReadableStream = require('stream').Readable
Promise = require('bluebird')
m = require('mochainon')
token = require('resin-token')
settings = require('resin-settings-client')
johnDoeFixture = require('./tokens.json').johndoe
utils = require('../lib/utils')

describe 'Utils:', ->

	describe '.shouldUpdateToken()', ->

		describe 'given the token is older than the specified validity time', ->

			beforeEach ->
				@tokenGetAgeStub = m.sinon.stub(token, 'getAge')
				@tokenGetAgeStub.returns(Promise.resolve(settings.get('tokenRefreshInterval') + 1))

			afterEach ->
				@tokenGetAgeStub.restore()

			it 'should return true', ->
				m.chai.expect(utils.shouldUpdateToken()).to.eventually.be.true

		describe 'given the token is newer than the specified validity time', ->

			beforeEach ->
				@tokenGetAgeStub = m.sinon.stub(token, 'getAge')
				@tokenGetAgeStub.returns(Promise.resolve(settings.get('tokenRefreshInterval') - 1))

			afterEach ->
				@tokenGetAgeStub.restore()

			it 'should return false', ->
				m.chai.expect(utils.shouldUpdateToken()).to.eventually.be.false

		describe 'given the token is equal to the specified validity time', ->

			beforeEach ->
				@tokenGetAgeStub = m.sinon.stub(token, 'getAge')
				@tokenGetAgeStub.returns(Promise.resolve(settings.get('tokenRefreshInterval')))

			afterEach ->
				@tokenGetAgeStub.restore()

			it 'should return true', ->
				m.chai.expect(utils.shouldUpdateToken()).to.eventually.be.true

	describe '.getAuthorizationHeader()', ->

		describe 'given there is a token', ->

			beforeEach  ->
				token.set(johnDoeFixture.token)

			it 'should eventually become the authorization header', ->
				m.chai.expect(utils.getAuthorizationHeader()).to.eventually.equal("Bearer #{johnDoeFixture.token}")

		describe 'given there is no token', ->

			beforeEach ->
				token.remove()

			it 'should eventually be undefined', ->
				m.chai.expect(utils.getAuthorizationHeader()).to.eventually.be.undefined

	describe '.getErrorMessageFromResponse()', ->

		describe 'given no body', ->

			beforeEach ->
				@response = {}

			it 'should return a generic error message', ->
				error = utils.getErrorMessageFromResponse(@response)
				m.chai.expect(error).to.equal('The request was unsuccessful')

		describe 'given a response with an error object', ->

			beforeEach ->
				@response =
					body:
						error:
							text: 'An error happened'

			it 'should print the error.text property', ->
				error = utils.getErrorMessageFromResponse(@response)
				m.chai.expect(error).to.equal('An error happened')

		describe 'given a response without an error object', ->

			beforeEach ->
				@response =
					body: 'An error happened'

			it 'should print the body', ->
				error = utils.getErrorMessageFromResponse(@response)
				m.chai.expect(error).to.equal('An error happened')

	describe '.isErrorCode()', ->

		it 'should return false for 200', ->
			m.chai.expect(utils.isErrorCode(200)).to.be.false

		it 'should return false for 399', ->
			m.chai.expect(utils.isErrorCode(399)).to.be.false

		it 'should return true for 400', ->
			m.chai.expect(utils.isErrorCode(400)).to.be.true

		it 'should return true for 500', ->
			m.chai.expect(utils.isErrorCode(500)).to.be.true

	describe '.getStreamData()', ->

		describe 'given no error', ->

			beforeEach ->
				@stream = new ReadableStream(encoding: 'utf8')
				@stream._read = ->
					@push('Hello')
					@push(null)

			it 'should eventually equal the stream data', ->
				promise = utils.getStreamData(@stream)
				m.chai.expect(promise).to.eventually.equal('Hello')

		describe 'given an error', ->

			beforeEach ->
				@stream = new ReadableStream(encoding: 'utf8')
				@stream._read = ->

					# If we don't emit an error event with a slight timeout
					# then the error is emitted before an error listener
					# is attached. This causes the error to be thrown
					# directly in Node v0.10.
					setTimeout =>
						@emit('error', new Error('stream error'))
					, 1

			it 'should be rejected with the correct error message', ->
				promise = utils.getStreamData(@stream)
				m.chai.expect(promise).to.be.rejectedWith('stream error')
