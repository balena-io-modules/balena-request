Promise = require('bluebird')
m = require('mochainon')
token = require('resin-token')
utils = require('../lib/utils')

describe 'Utils:', ->

	describe '.getAuthorizationHeader()', ->

		describe 'given there is a token', ->

			beforeEach (done) ->
				token.set('asdf').then(done)

			it 'should eventually become the authorization header', ->
				m.chai.expect(utils.getAuthorizationHeader()).to.eventually.equal('Bearer asdf')

		describe 'given there is no token', ->

			beforeEach (done) ->
				token.remove().then(done)

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
