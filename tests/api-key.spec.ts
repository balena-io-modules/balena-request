import { expect } from 'chai';
import rindle from 'rindle';
import sinon from 'sinon';
import mockhttp from 'mockttp';
import * as fixtures from './tokens.json';
import * as utils from '../build/utils';
import * as setup from './setup';
import type { BalenaRequestPassThroughStream } from '../lib/request';

const mockServer = mockhttp.getLocal();
const { auth, request } = setup.default();
const johnDoeFixture = fixtures.johndoe;

describe('Request (api key):', function () {
	this.timeout(10000);

	beforeEach(() => mockServer.start());

	afterEach(() => mockServer.stop());

	describe('given the token is always fresh', function () {
		beforeEach(function () {
			this.utilsShouldUpdateToken = sinon.stub(utils, 'shouldRefreshKey');
			return this.utilsShouldUpdateToken.returns(Promise.resolve(false));
		});

		afterEach(function () {
			return this.utilsShouldUpdateToken.restore();
		});

		describe('given a simple GET endpoint containing special characters in query strings', function () {
			beforeEach(() => mockServer.forGet(/^\/foo/).thenReply(200));

			describe('given no api key', () =>
				it('should not encode special characters automatically', function () {
					const promise = request
						.send({
							method: 'GET',
							baseUrl: mockServer.url,
							url: '/foo?$bar=baz',
							apiKey: undefined,
						})
						.then((v) => v.request.uri.path);
					return expect(promise).to.eventually.equal('/foo?$bar=baz');
				}));

			describe('given an api key', () =>
				it('should not encode special characters automatically', function () {
					const promise = request
						.send({
							method: 'GET',
							baseUrl: mockServer.url,
							url: '/foo?$bar=baz',
							apiKey: '123456789',
						})
						.then((v) => v.request.uri.path);
					return expect(promise).to.eventually.equal(
						'/foo?$bar=baz&apikey=123456789',
					);
				}));
		});

		describe('given a simple GET endpoint', function () {
			beforeEach(() => mockServer.forGet(/^\/foo/).thenReply(200, 'Foo Bar'));

			describe('given an api key', function () {
				describe('given no token', function () {
					beforeEach(() => auth.removeKey());

					describe('.send()', () =>
						it('should pass an apikey query string', function () {
							const promise = request
								.send({
									method: 'GET',
									baseUrl: mockServer.url,
									url: '/foo',
									apiKey: '123456789',
								})
								.then((v) => v.request.uri.query);
							return expect(promise).to.eventually.equal('apikey=123456789');
						}));

					describe('.stream()', () =>
						it('should pass an apikey query string', () =>
							request
								.stream({
									method: 'GET',
									baseUrl: mockServer.url,
									url: '/foo',
									apiKey: '123456789',
								})
								.then(function (stream) {
									expect(
										(stream as BalenaRequestPassThroughStream).response.request
											.uri.query,
									).to.equal('apikey=123456789');
									return rindle.extract(stream);
								})));
				});

				describe('given a token', function () {
					beforeEach(() => auth.setKey(johnDoeFixture.token));

					describe('.send()', function () {
						it('should pass an apikey query string', function () {
							const promise = request
								.send({
									method: 'GET',
									baseUrl: mockServer.url,
									url: '/foo',
									apiKey: '123456789',
								})
								.then((v) => v.request.uri.query);
							return expect(promise).to.eventually.equal('apikey=123456789');
						});

						it('should still send an Authorization header', function () {
							const promise = request
								.send({
									method: 'GET',
									baseUrl: mockServer.url,
									url: '/foo',
									apiKey: '123456789',
								})
								.then((v) => v.request.headers?.Authorization);
							return expect(promise).to.eventually.equal(
								`Bearer ${johnDoeFixture.token}`,
							);
						});
					});

					describe('.stream()', function () {
						it('should pass an apikey query string', () =>
							request
								.stream({
									method: 'GET',
									baseUrl: mockServer.url,
									url: '/foo',
									apiKey: '123456789',
								})
								.then(function (stream) {
									expect(
										(stream as BalenaRequestPassThroughStream).response.request
											.uri.query,
									).to.equal('apikey=123456789');
									return rindle.extract(stream);
								}));

						it('should still send an Authorization header', () =>
							request
								.stream({
									method: 'GET',
									baseUrl: mockServer.url,
									url: '/foo',
									apiKey: '123456789',
								})
								.then(function (stream) {
									const { headers } = (stream as BalenaRequestPassThroughStream)
										.response.request;
									expect(headers?.Authorization).to.equal(
										`Bearer ${johnDoeFixture.token}`,
									);
									return rindle.extract(stream);
								}));
					});
				});
			});

			describe('given an empty api key', () =>
				describe('given no token', function () {
					beforeEach(() => auth.removeKey());

					describe('.send()', () =>
						it('should not pass an apikey query string', function () {
							const promise = request
								.send({
									method: 'GET',
									baseUrl: mockServer.url,
									url: '/foo',
									apiKey: '',
								})
								.then((v) => v.request.uri.query);
							return expect(promise).to.eventually.be.null;
						}));

					describe('.stream()', () =>
						it('should not pass an apikey query string', () =>
							request
								.stream({
									method: 'GET',
									baseUrl: mockServer.url,
									url: '/foo',
									apiKey: '',
								})
								.then(function (stream) {
									expect(
										(stream as BalenaRequestPassThroughStream).response.request
											.uri.query,
									).to.not.exist;
									return rindle.extract(stream);
								})));
				}));
		});
	});
});
