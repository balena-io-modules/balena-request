const Bluebird = require('bluebird');
const { expect } = require('chai');
const sinon = require('sinon');

const mockServer = require('mockttp').getLocal();

const { auth, request, getCustomRequest, IS_BROWSER } = require('./setup')();

// Grab setTimeout before we replace it with a fake later, so
// we can still do real waiting in the tests themselves
const unstubbedSetTimeout = setTimeout;
const delay = (delayMs) =>
	new Promise((resolve) => unstubbedSetTimeout(resolve, delayMs));

describe('Request:', function () {
	this.timeout(10000);

	beforeEach(() => Promise.all([auth.removeKey(), mockServer.start()]));

	afterEach(() => mockServer.stop());

	describe('.send()', function () {
		describe('given a simple absolute GET endpoint', function () {
			beforeEach(() =>
				mockServer.get('/foo').thenJSON(200, { from: 'foobar' }),
			);

			it('should preserve the absolute url', function () {
				const promise = request
					.send({
						method: 'GET',
						url: mockServer.urlFor('/foo'),
					})
					.then((v) => v.body);
				return expect(promise).to.eventually.become({ from: 'foobar' });
			});

			it('should allow passing a baseUrl', function () {
				const promise = request
					.send({
						method: 'GET',
						baseUrl: mockServer.url,
						url: '/foo',
					})
					.then((v) => v.body);
				return expect(promise).to.eventually.become({ from: 'foobar' });
			});
		});

		describe('given multiple endpoints', function () {
			beforeEach(() =>
				Promise.all(
					['get', 'post', 'put', 'patch', 'delete'].map((method) =>
						mockServer[method]('/foo').thenJSON(200, {
							method: method.toUpperCase(),
						}),
					),
				),
			);

			it('should default to GET', function () {
				const promise = request
					.send({
						baseUrl: mockServer.url,
						url: '/foo',
					})
					.then((v) => v.body);
				return expect(promise).to.eventually.become({ method: 'GET' });
			});
		});

		describe('given an endpoint that returns a non json response', function () {
			beforeEach(() =>
				mockServer.get('/non-json').thenReply(200, 'Hello World'),
			);

			it('should resolve with the plain body', function () {
				const promise = request
					.send({
						method: 'GET',
						baseUrl: mockServer.url,
						url: '/non-json',
					})
					.then((v) => v.body);
				return expect(promise).to.eventually.equal('Hello World');
			});
		});

		describe('given an endpoint that accepts a non-json body', function () {
			beforeEach(() =>
				mockServer
					.post('/foo')
					.withBody('Test body')
					.thenJSON(200, { matched: true }),
			);

			it('should send the plain body successfully', function () {
				const promise = request
					.send({
						method: 'POST',
						baseUrl: mockServer.url,
						url: '/foo',
						body: 'Test body',
						json: false,
					})
					.then((v) => v.body);
				return expect(promise).to.eventually.become({ matched: true });
			});
		});

		describe('given simple read only endpoints', function () {
			describe('given a GET endpoint', function () {
				describe('given no response error', function () {
					beforeEach(() =>
						mockServer.get('/hello').thenJSON(200, { hello: 'world' }),
					);

					it('should correctly make the request', function () {
						const promise = request
							.send({
								method: 'GET',
								baseUrl: mockServer.url,
								url: '/hello',
							})
							.then((v) => v.body);
						return expect(promise).to.eventually.become({ hello: 'world' });
					});
				});

				describe('given a response error', function () {
					beforeEach(() =>
						mockServer
							.get('/500')
							.thenJSON(500, { error: { text: 'Server Error' } }),
					);

					it('should be rejected with the error message', function () {
						const promise = request.send({
							method: 'GET',
							baseUrl: mockServer.url,
							url: '/500',
						});
						return expect(promise).to.be.rejectedWith('Server Error');
					});

					it('should have the status code in the error object', () =>
						expect(
							request.send({
								method: 'GET',
								baseUrl: mockServer.url,
								url: '/500',
							}),
						).to.be.rejected.then((error) =>
							expect(error.statusCode).to.equal(500),
						));
				});
			});

			describe('given a HEAD endpoint', function () {
				describe('given no response error', function () {
					beforeEach(() => mockServer.head('/foo').thenReply(200));

					it('should correctly make the request', function () {
						const promise = request
							.send({
								method: 'HEAD',
								baseUrl: mockServer.url,
								url: '/foo',
							})
							.then((v) => v.statusCode);
						return expect(promise).to.eventually.equal(200);
					});
				});

				describe('given a response error', function () {
					beforeEach(() => mockServer.head('/foo').thenReply(500));

					it('should be rejected with a generic error message', function () {
						const promise = request
							.send({
								method: 'HEAD',
								baseUrl: mockServer.url,
								url: '/foo',
							})
							.then((v) => v.statusCode);
						return expect(promise).to.be.rejectedWith(
							'The request was unsuccessful',
						);
					});
				});
			});
		});

		describe('given simple endpoints that handle a request body', () =>
			['delete', 'patch', 'put', 'post'].forEach((method) =>
				describe(`given a ${method.toUpperCase()} endpoint that matches the request body`, function () {
					beforeEach(() =>
						mockServer[method]('/')
							.withBody(JSON.stringify({ foo: 'bar' }))
							.thenJSON(200, { matched: true }),
					);

					it('should eventually return the body', function () {
						const promise = request
							.send({
								method: method.toUpperCase(),
								baseUrl: mockServer.url,
								url: '/',
								body: {
									foo: 'bar',
								},
							})
							.then((v) => v.body);
						return expect(promise).to.eventually.become({ matched: true });
					});
				}),
			));

		describe('given an endpoint that fails the first two times', function () {
			beforeEach(() =>
				mockServer
					.get('/initially-failing')
					.twice()
					.thenCloseConnection()
					.then(() =>
						mockServer
							.get('/initially-failing')
							.thenJSON(200, { result: 'success' }),
					),
			);

			it('should fail by default', function () {
				const promise = request.send({
					method: 'GET',
					url: mockServer.urlFor('/initially-failing'),
				});
				return expect(promise).to.eventually.be.rejectedWith(Error);
			});

			it('should retry and fail if set to retry just once', function () {
				const promise = request.send({
					method: 'GET',
					url: mockServer.urlFor('/initially-failing'),
					retries: 1,
				});
				return expect(promise).to.eventually.be.rejectedWith(Error);
			});

			it('should retry and eventually succeed if set to retry more than once', function () {
				const promise = request
					.send({
						method: 'GET',
						url: mockServer.urlFor('/initially-failing'),
						retries: 2,
					})
					.then((v) => v.body);
				return expect(promise).to.eventually.become({ result: 'success' });
			});

			it('should retry and eventually succeed if set to retry more than once by default', function () {
				const retryingRequest = getCustomRequest({ retries: 2 });
				const promise = retryingRequest
					.send({
						method: 'GET',
						url: mockServer.urlFor('/initially-failing'),
					})
					.then((v) => v.body);
				return expect(promise).to.eventually.become({ result: 'success' });
			});
		});

		describe('given an endpoint that will time out', function () {
			beforeEach(function () {
				this.clock = sinon.useFakeTimers();
				return mockServer.get('/infinite-wait').thenTimeout();
			});

			afterEach(function () {
				return this.clock.restore();
			});

			const waitForRequestConnection = () =>
				// Need to wait until the (async) request setup has completed
				// for real, before we assume the timeout has started and start
				// manually ticking the clock
				delay(100);

			it('should reject the promise after 59s by default', function () {
				let pending = true;
				const promise = request
					.send({
						method: 'GET',
						url: mockServer.urlFor('/infinite-wait'),
					})
					.then(function (v) {
						pending = false;
						return v.body;
					});

				return waitForRequestConnection().then(() => {
					this.clock.tick(58000);
					expect(pending).to.equal(true);

					this.clock.tick(1000);
					return expect(promise).to.eventually.be.rejectedWith(Error);
				});
			});

			it('should use a provided timeout option', function () {
				let pending = true;
				const promise = request
					.send({
						method: 'GET',
						url: mockServer.urlFor('/infinite-wait'),
						timeout: 500,
					})
					.then(function (v) {
						pending = false;
						return v.body;
					});

				return waitForRequestConnection().then(() => {
					this.clock.tick(400);
					expect(pending).to.equal(true);

					this.clock.tick(100);
					return expect(promise).to.eventually.be.rejectedWith(Error);
				});
			});

			it('should be rejected by the correct error', function () {
				const promise = request
					.send({
						method: 'GET',
						url: mockServer.urlFor('/infinite-wait'),
					})
					.then((v) => v.body);

				return waitForRequestConnection().then(() => {
					this.clock.tick(59000);

					return expect(promise).to.be.rejectedWith(Error, 'network timeout');
				});
			});
		});
	});
});
