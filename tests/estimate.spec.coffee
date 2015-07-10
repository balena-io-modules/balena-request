m = require('mochainon')
timekeeper = require('timekeeper')
estimate = require('../lib/estimate')

describe 'Estimate:', ->

	describe 'given updates various updates', ->

		beforeEach ->
			@estimator = estimate.getEstimator()

		afterEach ->
			timekeeper.reset()

		it 'should return the correct eta', ->
			timekeeper.freeze(new Date(1000000000000))

			state1 = @estimator
				total: 1000
				received: 0

			m.chai.expect(state1.eta).to.be.undefined

			timekeeper.freeze(new Date(1000000000010))

			state2 = @estimator
				total: 1000
				received: 200

			m.chai.expect(state2.eta).to.equal(40)

			timekeeper.freeze(new Date(1000000000020))

			state3 = @estimator
				total: 1000
				received: 400

			m.chai.expect(state3.eta).to.equal(15)

			timekeeper.freeze(new Date(1000000000030))

			state3 = @estimator
				total: 1000
				received: 600

			m.chai.expect(state3.eta).to.equal(6)

			timekeeper.freeze(new Date(1000000000050))

			state4 = @estimator
				total: 1000
				received: 800

			m.chai.expect(state4.eta).to.equal(5)

			timekeeper.freeze(new Date(1000000000060))

			state5 = @estimator
				total: 1000
				received: 900

			m.chai.expect(state5.eta).to.equal(1)

			timekeeper.freeze(new Date(1000000000060))

			state6 = @estimator
				total: 1000
				received: 1000

			m.chai.expect(state6.eta).to.be.undefined
