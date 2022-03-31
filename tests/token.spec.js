const { expect } = require('chai');
const sinon = require('sinon');
const errors = require('balena-errors');
const rindle = require('rindle');
const tokens = require('./tokens.json');

const johnDoeFixture = tokens.johndoe;
const janeDoeFixture = tokens.janedoe;
const utils = require('../build/utils');

const mockServer = require('mockttp').getLocal();

const { auth, request } = require('./setup')();

describe('Request (token):', function () {
	this.timeout(10000);

	beforeEach(() => mockServer.start());

	afterEach(() => mockServer.stop());

	describe('.send()', () =>
		describe('given a simple GET endpoint', function () {
			beforeEach(() => mockServer.get(/^\/foo/).thenReply(200, 'bar'));

			describe('given the token is always fresh', function () {
				beforeEach(function () {
					this.utilsShouldUpdateToken = sinon.stub(utils, 'shouldRefreshKey');
					return this.utilsShouldUpdateToken.returns(Promise.resolve(false));
				});

				afterEach(function () {
					return this.utilsShouldUpdateToken.restore();
				});

				describe('given there is a token', function () {
					beforeEach(() => auth.setKey(johnDoeFixture.token));

					it('should send an Authorization header', function () {
						const promise = request
							.send({
								method: 'GET',
								baseUrl: mockServer.url,
								url: '/foo',
							})
							.then((v) => v.request.headers.Authorization);
						return expect(promise).to.eventually.equal(
							`Bearer ${johnDoeFixture.token}`,
						);
					});

					it('should not send an Authorization header if sendToken is false', function () {
						const promise = request
							.send({
								method: 'GET',
								baseUrl: mockServer.url,
								url: '/foo',
								sendToken: false,
							})
							.then((v) => v.request.headers.Authorization);
						return expect(promise).to.eventually.equal(undefined);
					});
				});

				describe('given there is no token', function () {
					beforeEach(() => auth.removeKey());

					it('should not send an Authorization header', function () {
						const promise = request
							.send({
								method: 'GET',
								baseUrl: mockServer.url,
								url: '/foo',
							})
							.then((v) => v.request.headers.Authorization);
						return expect(promise).to.eventually.not.exist;
					});
				});
			});

			describe('given the token needs to be updated', function () {
				beforeEach(function () {
					this.utilsShouldUpdateToken = sinon.stub(utils, 'shouldRefreshKey');
					this.utilsShouldUpdateToken.returns(Promise.resolve(true));

					this.authIsExpired = sinon.stub(auth, 'isExpired');
					this.authIsExpired.returns(Promise.resolve(false));

					return auth.setKey(johnDoeFixture.token);
				});

				afterEach(function () {
					this.utilsShouldUpdateToken.restore();
					return this.authIsExpired.restore();
				});

				describe('given a working /user/v1/refresh-token endpoint', function () {
					beforeEach(() =>
						mockServer
							.get('/user/v1/refresh-token')
							.thenReply(200, janeDoeFixture.token),
					);

					describe('given no base url', () =>
						it('should not refresh the token', () =>
							auth
								.getKey()
								.then(function (savedToken) {
									expect(savedToken).to.equal(johnDoeFixture.token);
									return request.send({
										url: mockServer.url + '/foo',
									});
								})
								.then(function (response) {
									expect(response.body).to.equal('bar');
									return auth.getKey();
								})
								.then((savedToken) =>
									expect(savedToken).to.equal(johnDoeFixture.token),
								)));

					describe('given a base url', () =>
						it('should refresh the token', () =>
							auth
								.getKey()
								.then(function (savedToken) {
									expect(savedToken).to.equal(johnDoeFixture.token);
									return request.send({
										baseUrl: mockServer.url,
										url: '/foo',
									});
								})
								.then(function (response) {
									expect(response.body).to.equal('bar');
									return auth.getKey();
								})
								.then((savedToken) =>
									expect(savedToken).to.equal(janeDoeFixture.token),
								)));

					// We could make the token request in parallel to avoid
					// having to wait for it to make the actual request.
					// Given the impact is minimal, the implementation aims
					// to simplicity.
					it('should use the new token in the same request', function () {
						expect(auth.getKey()).to.eventually.equal(johnDoeFixture.token);
						return request
							.send({
								baseUrl: mockServer.url,
								url: '/foo',
							})
							.then(function (response) {
								const authorizationHeader =
									response.request.headers.Authorization;
								return expect(authorizationHeader).to.equal(
									`Bearer ${janeDoeFixture.token}`,
								);
							});
					});
				});

				describe('given /user/v1/refresh-token returns 401', function () {
					beforeEach(() =>
						mockServer
							.get('/user/v1/refresh-token')
							.thenReply(401, 'Unauthorized'),
					);

					describe('given an absolute url', () =>
						it('should not attempt to refresh the token', () =>
							auth
								.getKey()
								.then((savedToken) => {
									expect(savedToken).to.equal(johnDoeFixture.token);
									return request.send({
										url: mockServer.url + '/foo',
									});
								})
								.then(function (response) {
									expect(response.body).to.equal('bar');
									return auth.getKey();
								})
								.then((savedToken) =>
									expect(savedToken).to.equal(johnDoeFixture.token),
								)));

					it('should be rejected with an expiration error', function () {
						const promise = request.send({
							baseUrl: mockServer.url,
							url: '/foo',
						});
						return expect(promise).to.be.rejectedWith(
							errors.BalenaExpiredToken,
						);
					});

					it('should have the session token as an error attribute', () =>
						expect(
							request.send({
								baseUrl: mockServer.url,
								url: '/foo',
							}),
						).to.be.rejected.then((error) =>
							expect(error.token).to.equal(johnDoeFixture.token),
						));

					it('should clear the token', () =>
						expect(
							request.send({
								baseUrl: mockServer.url,
								url: '/foo',
							}),
						).to.be.rejected.then(() =>
							auth.hasKey().then((hasKey) => expect(hasKey).to.be.false),
						));
				});

				describe('given /user/v1/refresh-token returns a non 401 status code', function () {
					beforeEach(() =>
						mockServer.get('/user/v1/refresh-token').thenReply(500),
					);

					it('should be rejected with a request error', function () {
						const promise = request.send({
							baseUrl: mockServer.url,
							url: '/foo',
						});
						return expect(promise).to.be.rejectedWith(
							errors.BalenaRequestError,
						);
					});
				});
			});
		}));

	describe('.stream()', () =>
		describe('given a simple endpoint that responds with a string', function () {
			beforeEach(() =>
				mockServer.get('/foo').thenReply(200, 'Lorem ipsum dolor sit amet'),
			);

			describe('given the token is always fresh', function () {
				beforeEach(function () {
					this.utilsShouldUpdateToken = sinon.stub(utils, 'shouldRefreshKey');
					return this.utilsShouldUpdateToken.returns(Promise.resolve(false));
				});

				afterEach(function () {
					return this.utilsShouldUpdateToken.restore();
				});

				describe('given there is a token', function () {
					beforeEach(() => auth.setKey(johnDoeFixture.token));

					it('should send an Authorization header', () =>
						request
							.stream({
								method: 'GET',
								baseUrl: mockServer.url,
								url: '/foo',
							})
							.then(function (stream) {
								const { headers } = stream.response.request;
								expect(headers.Authorization).to.equal(
									`Bearer ${johnDoeFixture.token}`,
								);
								return rindle.extract(stream);
							}));
				});

				describe('given there is no token', function () {
					beforeEach(() => auth.removeKey());

					it('should not send an Authorization header', () =>
						request
							.stream({
								method: 'GET',
								baseUrl: mockServer.url,
								url: '/foo',
							})
							.then(function (stream) {
								const { headers } = stream.response.request;
								expect(headers.Authorization).to.not.exist;
								return rindle.extract(stream);
							}));
				});
			});
		}));

	describe('.refreshToken()', () =>
		describe('given a working /user/v1/refresh-token endpoint', function () {
			beforeEach(function () {
				auth.setKey(johnDoeFixture.token);
				return mockServer
					.get('/user/v1/refresh-token')
					.thenReply(200, janeDoeFixture.token);
			});

			it('should refresh the token', () =>
				auth.getKey().then(function (savedToken) {
					expect(savedToken).to.equal(johnDoeFixture.token);
					return request
						.refreshToken({
							baseUrl: mockServer.url,
						})
						.then((freshToken) =>
							expect(freshToken).to.equal(janeDoeFixture.token),
						);
				}));
		}));
});
