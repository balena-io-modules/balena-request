import * as errors from 'balena-errors';
import { expect } from 'chai';
import setup from './setup';
import * as sinon from 'sinon';
import * as mockhttp from 'mockttp';

const mockServer = mockhttp.getLocal();

const { auth, request, getCustomRequest, IS_BROWSER, delay } = setup();

class TestFile extends Blob {
	constructor(
		blobParts: BlobPart[],
		public name: string,
		type?: string,
	) {
		super(blobParts, { type });
	}
}

const writeMethods = [
	['DELETE', 'Delete'],
	['PATCH', 'Patch'],
	['PUT', 'Put'],
	['POST', 'Post'],
] as const;
const methods = [['GET', 'Get'], ...writeMethods] as const;

describe('Request:', function () {
	this.timeout(10000);

	beforeEach(() => Promise.all([auth.removeKey(), mockServer.start()]));

	afterEach(() => mockServer.stop());

	describe('.send()', function () {
		describe('given a simple absolute GET endpoint', function () {
			beforeEach(() =>
				mockServer.forGet('/foo').thenJson(200, { from: 'foobar' }),
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
					methods.map(([upperMethod, camelMethod]) =>
						mockServer[`for${camelMethod}`]('/foo').thenJson(200, {
							method: upperMethod,
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
				mockServer.forGet('/non-json').thenReply(200, 'Hello World'),
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
					.forPost('/foo')
					.withBody('Test body')
					.thenJson(200, { matched: true }),
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
						mockServer.forGet('/hello').thenJson(200, { hello: 'world' }),
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
							.forGet('/500')
							.thenJson(500, { error: { text: 'Server Error' } }),
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

				describe('given a ratelimiting response error without a Retry-After header', function () {
					beforeEach(() =>
						mockServer.forGet('/429').thenReply(429, '"Too Many Requests"', {
							'Content-Length': '19',
							'Content-Type': 'application/json',
							Date: 'Tue, 31 Oct 2023 14:28:22 GMT',
						}),
					);

					it('should not include Retry-After in the headers', async function () {
						await expect(
							request.send({
								method: 'GET',
								baseUrl: mockServer.url,
								url: '/429',
							}),
						).to.be.rejected.then((error) => {
							expect(error).to.be.an.instanceOf(errors.BalenaRequestError);
							expect(error).to.have.property('statusCode', 429);
							expect(error).to.have.property('name', 'BalenaRequestError');
							expect(error).to.have.property('body', 'Too Many Requests');
							expect(error).to.have.property('responseHeaders');
							expect(error.responseHeaders.get('Retry-After')).to.equal(null);
						});
					});
				});

				describe('given a ratelimiting response error with a Retry-After header', function () {
					const responseHeadersWithRetryAfter = {
						'Retry-After': '60',
						'Content-Length': '19',
						'Content-Type': 'application/json',
						Date: 'Tue, 31 Oct 2023 14:28:22 GMT',
					};

					describe('when the http server does not specify the Retry-After in the Access-Control-Expose-Headers', function () {
						beforeEach(async () => {
							await mockServer
								.forGet('/429')
								.thenReply(
									429,
									'"Too Many Requests"',
									responseHeadersWithRetryAfter,
								);
						});

						if (IS_BROWSER) {
							it('should not include Retry-After in the headers', async function () {
								await expect(
									request.send({
										method: 'GET',
										baseUrl: mockServer.url,
										url: '/429',
									}),
								).to.be.rejected.then((error) => {
									expect(error).to.be.an.instanceOf(errors.BalenaRequestError);
									expect(error).to.have.property('statusCode', 429);
									expect(error).to.have.property('name', 'BalenaRequestError');
									expect(error).to.have.property('body', 'Too Many Requests');
									expect(error).to.have.property('responseHeaders');
									expect(error.responseHeaders.get('Retry-After')).to.equal(
										null,
									);
								});
							});
						} else {
							it('should include Retry-After in the headers', async function () {
								await expect(
									request.send({
										method: 'GET',
										baseUrl: mockServer.url,
										url: '/429',
									}),
								).to.be.rejected.then((error) => {
									expect(error).to.be.an.instanceOf(errors.BalenaRequestError);
									expect(error).to.have.property('statusCode', 429);
									expect(error).to.have.property('name', 'BalenaRequestError');
									expect(error).to.have.property('body', 'Too Many Requests');
									expect(error).to.have.property('responseHeaders');
									expect(error.responseHeaders.get('Retry-After')).to.equal(
										'60',
									);
								});
							});
						}
					});

					describe('when the http server specifies the Access-Control-Expose-Headers=Retry-After in the GET response headers', function () {
						beforeEach(async () => {
							await mockServer
								.forGet('/429')
								.thenReply(429, '"Too Many Requests"', {
									...responseHeadersWithRetryAfter,
									'Access-Control-Expose-Headers': 'Retry-After',
								});
						});

						it('should include Retry-After in the headers', async function () {
							await expect(
								request.send({
									method: 'GET',
									baseUrl: mockServer.url,
									url: '/429',
								}),
							).to.be.rejected.then((error) => {
								expect(error).to.be.an.instanceOf(errors.BalenaRequestError);
								expect(error).to.have.property('statusCode', 429);
								expect(error).to.have.property('name', 'BalenaRequestError');
								expect(error).to.have.property('body', 'Too Many Requests');
								expect(error).to.have.property('responseHeaders');
								expect(error.responseHeaders.get('Retry-After')).to.equal('60');
							});
						});
					});

					describe('when the http server specifies the Access-Control-Expose-Headers=Retry-After in the OPTIONS response headers', function () {
						let mockServer2: mockhttp.Mockttp;

						beforeEach(async () => {
							await mockServer.stop();
							mockServer2 = mockhttp.getLocal({
								cors: {
									exposedHeaders: 'Retry-After',
								},
							});
							await mockServer2.start();
							await mockServer2
								.forGet('/429')
								.thenReply(
									429,
									'"Too Many Requests"',
									responseHeadersWithRetryAfter,
								);
						});

						afterEach(async function () {
							await mockServer2.stop();
							await mockServer.start();
						});

						it('should include Retry-After in the headers', async function () {
							await expect(
								request.send({
									method: 'GET',
									baseUrl: mockServer2.url,
									url: '/429',
								}),
							).to.be.rejected.then((error) => {
								expect(error).to.be.an.instanceOf(errors.BalenaRequestError);
								expect(error).to.have.property('statusCode', 429);
								expect(error).to.have.property('name', 'BalenaRequestError');
								expect(error).to.have.property('body', 'Too Many Requests');
								expect(error).to.have.property('responseHeaders');
								expect(error.responseHeaders.get('Retry-After')).to.equal('60');
							});
						});
					});
				});
			});

			describe('given a HEAD endpoint', function () {
				describe('given no response error', function () {
					beforeEach(() => mockServer.forHead('/foo').thenReply(200));

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
					beforeEach(() => mockServer.forHead('/foo').thenReply(500));

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
			writeMethods.forEach(([upperMethod, camelMethod]) =>
				describe(`given a ${upperMethod} endpoint that matches the request body`, function () {
					beforeEach(() =>
						mockServer[`for${camelMethod}`]('/')
							.withBody(JSON.stringify({ foo: 'bar' }))
							.thenJson(200, { matched: true }),
					);

					it('should eventually return the body', function () {
						const promise = request
							.send({
								method: upperMethod,
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

		describe('given a body with a Blob data', function () {
			beforeEach(async () => {
				await mockServer
					.forPost('/multipart-endpoint')
					.thenCallback(async (req) => {
						return { statusCode: 200, body: req.headers['content-type'] };
					});
			});
			it('should send the request as multipart/form-data with boundary', async function () {
				const fileName = 'testfile.txt';
				let body;
				if (IS_BROWSER) {
					body = {
						content: new File(['a', 'test', 'blob'], fileName),
					};
				} else {
					body = {
						content: new TestFile(['a', 'test', 'blob'], fileName),
					};
				}

				const res = await request.send({
					method: 'POST',
					baseUrl: mockServer.url,
					url: '/multipart-endpoint',
					body: body,
				});

				expect(res.body.startsWith('multipart/form-data; boundary=')).to.be
					.true;
			});
		});

		describe('given an endpoint that fails the first two times', function () {
			beforeEach(() =>
				mockServer
					.forGet('/initially-failing')
					.twice()
					.thenCloseConnection()
					.then(() =>
						mockServer
							.forGet('/initially-failing')
							.thenJson(200, { result: 'success' }),
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
			beforeEach(async function () {
				this.clock = sinon.useFakeTimers();
				await mockServer.forGet('/infinite-wait').thenTimeout();
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
