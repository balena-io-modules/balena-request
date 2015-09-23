m = require('mochainon')
ReadableStream = require('stream').Readable
utils = require('../lib/utils')

describe 'Utils:', ->

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
