const rindle = require('rindle');
const Bluebird = require('bluebird');
const m = require('mochainon');

const mockServer = require('mockttp').getLocal();

const utils = require('../build/utils');

const { auth, request } = require('./setup')();

const { expect } = m.chai;

describe('An interceptor', function () {
	this.timeout(10000);

	beforeEach(function () {
		request.interceptors = [];

		return Promise.all([
			auth.removeKey(),
			mockServer
				.start()
				.then(() =>
					Promise.all([
						mockServer.get('/').thenJSON(200, { requested: '/' }),
						mockServer
							.get('/original')
							.thenJSON(200, { requested: 'original' }),
						mockServer.get('/changed').thenJSON(200, { requested: 'changed' }),
					]),
				),
		]);
	});

	afterEach(() => mockServer.stop());

	describe('with a request hook', function () {
		it('should be able to change a request before it is sent', function () {
			request.interceptors[0] = {
				request(req) {
					return Object.assign({}, req, {
						url: mockServer.urlFor('/changed'),
					});
				},
			};

			const promise = request
				.send({
					url: mockServer.urlFor('/original'),
				})
				.then((v) => v.body);

			return expect(promise).to.eventually.become({ requested: 'changed' });
		});

		it('should be able to asynchronously change a request before it is sent', function () {
			request.interceptors[0] = {
				request(req) {
					return Bluebird.delay(100).then(() =>
						Object.assign({}, req, { url: mockServer.urlFor('/changed') }),
					);
				},
			};

			const promise = request
				.send({
					url: mockServer.urlFor('/original'),
				})
				.then((v) => v.body);

			return expect(promise).to.eventually.become({ requested: 'changed' });
		});

		it('should be able to stop a request', function () {
			request.interceptors[0] = {
				request() {
					throw new Error('blocked');
				},
			};

			const promise = request
				.send({
					url: mockServer.url,
				})
				.then((v) => v.body);

			return expect(promise).to.be.rejectedWith('blocked');
		});

		it('should be able to change a stream request before it is sent', function () {
			request.interceptors[0] = {
				request(req) {
					return Object.assign({}, req, {
						url: mockServer.urlFor('/changed'),
					});
				},
			};

			return request
				.stream({
					url: mockServer.urlFor('/original'),
				})
				.then(rindle.extract)
				.then(function (data) {
					const body = JSON.parse(data);
					expect(body).to.deep.equal({ requested: 'changed' });
				});
		});
	});

	describe('with a requestError hook', function () {
		it('should not call requestError if there are no errors', function () {
			request.interceptors[0] = {
				request(req) {
					return Object.assign({}, req, {
						url: mockServer.urlFor('/changed'),
					});
				},
				requestError: m.sinon.mock(),
			};
			request.interceptors[1] = { requestError: m.sinon.mock() };

			return request
				.send({
					url: mockServer.urlFor('/original'),
				})
				.then(function ({ body }) {
					expect(body).to.deep.equal({ requested: 'changed' });
					request.interceptors.forEach((interceptor) =>
						expect(interceptor.requestError.called).to.equal(
							false,
							'requestError should not have been called',
						),
					);
				});
		});

		it('should call requestError only in the subsequent hook, if a previous hook fails', function () {
			request.interceptors[0] = {
				request: m.sinon.mock().throws(new Error('blocked')),
				requestError: m.sinon.mock(),
			};
			request.interceptors[1] = {
				requestError: m.sinon.mock().throws(new Error('error overridden')),
			};

			return expect(request.send({ url: mockServer.url })).to.be.rejected.then(
				function (err) {
					expect(err.message).to.deep.equal('error overridden');
					expect(request.interceptors[0].requestError.called).to.equal(
						false,
						'Preceeding requestError hooks should not be called',
					);
					expect(request.interceptors[1].requestError.called).to.equal(
						true,
						'Subsequent requestError hook should be called',
					);
				},
			);
		});

		describe('with an expired token', function () {
			beforeEach(function () {
				return (this.utilsShouldUpdateToken = m.sinon
					.stub(utils, 'shouldRefreshKey')
					.returns(true));
			});

			afterEach(function () {
				return this.utilsShouldUpdateToken.restore();
			});

			describe('when using a baseUrl', function () {
				it('should call requestError if the token is expired', function () {
					request.interceptors[0] = {
						requestError: m.sinon
							.mock()
							.throws(new Error('intercepted auth failure')),
					};

					const promise = request.send({
						baseUrl: mockServer.url,
						url: '/',
					});

					return expect(promise).to.be.rejectedWith('intercepted auth failure');
				});

				it('should call requestError if the token is expired for stream()', function () {
					request.interceptors[0] = {
						requestError: m.sinon
							.mock()
							.throws(new Error('intercepted auth failure')),
					};

					const promise = request.stream({
						baseUrl: mockServer.url,
						url: '/',
					});

					return expect(promise).to.be.rejectedWith('intercepted auth failure');
				});
			});

			describe('when using an absolute url', function () {
				it('should call requestError if the token is expired', function () {
					request.interceptors[0] = {
						requestError: m.sinon
							.mock()
							.throws(new Error('intercepted auth failure')),
					};

					const promise = request.send({
						url: mockServer.url,
					});

					return expect(promise).to.be.rejectedWith('intercepted auth failure');
				});

				it('should call requestError if the token is expired for stream()', function () {
					request.interceptors[0] = {
						requestError: m.sinon
							.mock()
							.throws(new Error('intercepted auth failure')),
					};

					const promise = request.stream({
						url: mockServer.url,
					});

					return expect(promise).to.be.rejectedWith('intercepted auth failure');
				});
			});
		});
	});

	describe('with a response hook', function () {
		it('should be able to change a response before it is returned', function () {
			request.interceptors[0] = {
				response(response) {
					return Object.assign({}, response, { body: { replaced: true } });
				},
			};

			const promise = request
				.send({
					url: mockServer.url,
				})
				.then((v) => v.body);

			return expect(promise).to.eventually.become({ replaced: true });
		});

		it('should be able to asynchronously change a response before it is returned', function () {
			request.interceptors[0] = {
				response(response) {
					return Bluebird.delay(100).then(() =>
						Object.assign({}, response, { body: { replaced: true } }),
					);
				},
			};

			const promise = request
				.send({
					url: mockServer.url,
				})
				.then((v) => v.body);

			return expect(promise).to.eventually.become({ replaced: true });
		});

		it('should call the response hook for non-200 successful responses', () =>
			mockServer
				.get('/201')
				.thenReply(201)
				.then(function () {
					request.interceptors[0] = {
						response(response) {
							return Object.assign({}, response, { body: { replaced: true } });
						},
					};

					return request
						.send({
							url: mockServer.urlFor('/201'),
						})
						.then(function (response) {
							expect(response.body).to.deep.equal({ replaced: true });
							expect(response.statusCode).to.equal(201);
						});
				}));

		it('should be able to change a stream response before it is returned', function () {
			request.interceptors[0] = {
				response(response) {
					return rindle.getStreamFromString('replacement stream');
				},
			};

			return request
				.stream({
					url: mockServer.urlFor('/original'),
				})
				.then(rindle.extract)
				.then((data) => expect(data).to.equal('replacement stream'));
		});
	});

	describe('with a responseError hook', function () {
		it('should not call responseError if there are no errors', function () {
			request.interceptors[0] = { responseError: m.sinon.mock() };

			return request
				.send({
					url: mockServer.url,
				})
				.then(function ({ body }) {
					expect(body).to.deep.equal({ requested: '/' });
					return expect(request.interceptors[0].responseError.called).to.equal(
						false,
						'responseError should not have been called',
					);
				});
		});

		it('should call responseError if the server returns a server error', () =>
			mockServer
				.get('/500')
				.thenReply(500)
				.then(function () {
					request.interceptors[0] = {
						responseError: m.sinon.mock().throws(new Error('caught error')),
					};

					const promise = request.send({
						url: mockServer.urlFor('/500'),
					});

					return expect(promise).to.be.rejectedWith('caught error');
				}));

		it('should call responseError if the server returns an authentication error', () =>
			mockServer
				.get('/401')
				.thenReply(401)
				.then(function () {
					request.interceptors[0] = {
						responseError: m.sinon
							.mock()
							.throws(new Error('caught auth error')),
					};

					const promise = request.send({
						url: mockServer.urlFor('/401'),
					});

					return expect(promise).to.be.rejectedWith('caught auth error');
				}));

		it('should let responseError retry a different request', () =>
			Promise.all([
				mockServer.get('/ok').thenReply(200),
				mockServer.get('/fail').thenReply(500),
			]).then(function () {
				request.interceptors[0] = {
					responseError(response) {
						return request.send({
							url: mockServer.urlFor('/ok'),
						});
					},
				};

				const promise = request
					.send({
						url: mockServer.urlFor('/fail'),
					})
					.then((v) => v.statusCode);

				return expect(promise).to.eventually.become(200);
			}));

		it('should give responseError the request options for server errors', () =>
			mockServer
				.get('/500')
				.thenReply(500)
				.then(function () {
					request.interceptors[0] = {
						responseError(err) {
							throw err;
						},
					};

					const targetUrl = mockServer.urlFor('/500');

					return expect(
						request.send({
							url: targetUrl,
							anotherExtraOption: true,
						}),
					).to.be.rejected.then(function (err) {
						expect(err.requestOptions.url).to.equal(targetUrl);
						return expect(err.requestOptions.anotherExtraOption).to.equal(true);
					});
				}));

		it('should give responseError the request options for network errors', () =>
			mockServer
				.get('/no-response')
				.thenCloseConnection()
				.then(function () {
					request.interceptors[0] = {
						responseError(err) {
							throw err;
						},
					};

					const targetUrl = mockServer.urlFor('/no-response');

					return expect(
						request.send({
							url: targetUrl,
							anotherExtraOption: true,
						}),
					).to.be.rejected.then(function (err) {
						expect(err.requestOptions.url).to.equal(targetUrl);
						return expect(err.requestOptions.anotherExtraOption).to.equal(true);
					});
				}));

		it('should call responseError if the server returns an error for a stream', () =>
			mockServer
				.get('/500')
				.thenReply(500)
				.then(function () {
					request.interceptors[0] = {
						responseError: m.sinon.mock().throws(new Error('caught error')),
					};

					const promise = request.stream({
						url: mockServer.urlFor('/500'),
					});

					return expect(promise).to.be.rejectedWith('caught error');
				}));
	});
});
