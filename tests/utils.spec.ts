import { expect } from 'chai';
import { TokenType } from 'balena-auth/build/token';
import setup from './setup';
import * as sinon from 'sinon';
import * as tokens from './tokens.json';
import * as utils from '../build/utils';
import type { BalenaRequestResponse } from '../build/request';

const { auth } = setup();
const johnDoeFixture = tokens.johndoe;

describe('Utils:', function () {
	describe('.shouldRefreshKey()', function () {
		describe('given an API key ', function () {
			beforeEach(function () {
				this.tokenHasKeyStub = sinon.stub(auth, 'hasKey');
				this.tokenHasKeyStub.returns(Promise.resolve(true));
				this.tokenGetTypeStub = sinon.stub(auth, 'getType');
				return this.tokenGetTypeStub.returns(Promise.resolve('APIKey'));
			});

			afterEach(function () {
				this.tokenHasKeyStub.restore();
				return this.tokenGetTypeStub.restore();
			});

			it('should return false', () =>
				expect(utils.shouldRefreshKey(auth)).to.eventually.be.false);
		});

		describe('given the token is older than the specified validity time', function () {
			beforeEach(function () {
				this.tokenGetAgeStub = sinon.stub(auth, 'getAge');
				this.tokenGetAgeStub.returns(
					Promise.resolve(utils.TOKEN_REFRESH_INTERVAL + 1),
				);
				this.tokenHasKeyStub = sinon.stub(auth, 'hasKey');
				this.tokenHasKeyStub.returns(Promise.resolve(true));
				this.tokenGetTypeStub = sinon.stub(auth, 'getType');
				return this.tokenGetTypeStub.returns(Promise.resolve(TokenType.JWT));
			});

			afterEach(function () {
				this.tokenGetAgeStub.restore();
				this.tokenHasKeyStub.restore();
				return this.tokenGetTypeStub.restore();
			});

			it('should return true', () =>
				expect(utils.shouldRefreshKey(auth)).to.eventually.be.true);
		});

		describe('given the token is newer than the specified validity time', function () {
			beforeEach(function () {
				this.tokenGetAgeStub = sinon.stub(auth, 'getAge');
				this.tokenGetAgeStub.returns(
					Promise.resolve(utils.TOKEN_REFRESH_INTERVAL - 1),
				);
				this.tokenHasKeyStub = sinon.stub(auth, 'hasKey');
				this.tokenHasKeyStub.returns(Promise.resolve(true));
				this.tokenGetTypeStub = sinon.stub(auth, 'getType');
				return this.tokenGetTypeStub.returns(Promise.resolve(TokenType.JWT));
			});

			afterEach(function () {
				this.tokenGetAgeStub.restore();
				this.tokenHasKeyStub.restore();
				return this.tokenGetTypeStub.restore();
			});

			it('should return false', () =>
				expect(utils.shouldRefreshKey(auth)).to.eventually.be.false);
		});

		describe('given the token is equal to the specified validity time', function () {
			beforeEach(function () {
				this.tokenGetAgeStub = sinon.stub(auth, 'getAge');
				this.tokenGetAgeStub.returns(
					Promise.resolve(utils.TOKEN_REFRESH_INTERVAL),
				);
				this.tokenHasKeyStub = sinon.stub(auth, 'hasKey');
				this.tokenHasKeyStub.returns(Promise.resolve(true));
				this.tokenGetTypeStub = sinon.stub(auth, 'getType');
				return this.tokenGetTypeStub.returns(Promise.resolve(TokenType.JWT));
			});

			afterEach(function () {
				this.tokenGetAgeStub.restore();
				this.tokenHasKeyStub.restore();
				return this.tokenGetTypeStub.restore();
			});

			it('should return true', () =>
				expect(utils.shouldRefreshKey(auth)).to.eventually.be.true);
		});

		describe('given no token', function () {
			beforeEach(function () {
				this.tokenHasKeyStub = sinon.stub(auth, 'hasKey');
				return this.tokenHasKeyStub.returns(Promise.resolve(false));
			});

			afterEach(function () {
				return this.tokenHasKeyStub.restore();
			});

			it('should return false', () =>
				expect(utils.shouldRefreshKey(auth)).to.eventually.be.false);
		});
	});

	describe('.getAuthorizationHeader()', function () {
		describe('given there is a token', function () {
			beforeEach(() => auth.setKey(johnDoeFixture.token));

			it('should eventually become the authorization header', () =>
				expect(utils.getAuthorizationHeader(auth)).to.eventually.equal(
					`Bearer ${johnDoeFixture.token}`,
				));
		});

		describe('given there is no token', function () {
			beforeEach(() => auth.removeKey());

			it('should eventually be undefined', () =>
				expect(utils.getAuthorizationHeader(auth)).to.eventually.be.undefined);
		});
	});

	describe('.getErrorMessageFromResponse()', function () {
		describe('given no body', function () {
			beforeEach(function () {
				return (this.response = {});
			});

			it('should return a generic error message', function () {
				const error = utils.getErrorMessageFromResponse(this.response);
				return expect(error).to.equal('The request was unsuccessful');
			});
		});

		describe('given a response with an error object', function () {
			beforeEach(function () {
				return (this.response = {
					body: {
						error: {
							text: 'An error happened',
						},
					},
				});
			});

			it('should print the error.text property', function () {
				const error = utils.getErrorMessageFromResponse(this.response);
				return expect(error).to.equal('An error happened');
			});
		});

		describe('given a response with a string message property', function () {
			beforeEach(function () {
				return (this.response = {
					body: {
						error: 'errorTypeSlug',
						message: 'More details about the error',
					},
				});
			});

			it('should print the body.message property', function () {
				const error = utils.getErrorMessageFromResponse(this.response);
				expect(error).to.deep.equal(this.response.body.message);
			});
		});

		describe('given a response with a string error property', function () {
			beforeEach(function () {
				return (this.response = {
					body: {
						error: 'errorTypeSlug',
					},
				});
			});

			it('should print the body.error property', function () {
				const error = utils.getErrorMessageFromResponse(this.response);
				expect(error).to.deep.equal(this.response.body.error);
			});
		});

		// TODO: Improve this so that we can drop this test case
		describe('given a response with an object response w/o any known message property', function () {
			beforeEach(function () {
				return (this.response = {
					body: {
						error2: 'errorTypeSlug',
						message2: 'More details about the error',
					},
				});
			});

			it('should return the whole body', function () {
				const error = utils.getErrorMessageFromResponse(this.response);
				expect(error).to.deep.equal(this.response.body);
			});
		});

		describe('given a response without an error object', function () {
			beforeEach(function () {
				return (this.response = { body: 'An error happened' });
			});

			it('should print the body', function () {
				const error = utils.getErrorMessageFromResponse(this.response);
				return expect(error).to.equal('An error happened');
			});
		});
	});

	describe('.isErrorCode()', function () {
		it('should return false for 200', () =>
			expect(utils.isErrorCode(200)).to.be.false);

		it('should return false for 399', () =>
			expect(utils.isErrorCode(399)).to.be.false);

		it('should return true for 400', () =>
			expect(utils.isErrorCode(400)).to.be.true);

		it('should return true for 500', () =>
			expect(utils.isErrorCode(500)).to.be.true);
	});

	describe('.isResponseCompressed()', function () {
		it('should return false if Content-Encoding is gzip', function () {
			const response = {
				headers: new Headers({
					'content-encoding': 'gzip',
				}),
			} as BalenaRequestResponse<any>;

			return expect(utils.isResponseCompressed(response)).to.be.true;
		});

		it('should return false if Content-Encoding is not set', function () {
			const response = {
				headers: new Headers({}),
			} as BalenaRequestResponse<any>;

			return expect(utils.isResponseCompressed(response)).to.be.false;
		});
	});

	describe('.getResponseLength()', function () {
		describe('given a response with only an X-Transfer-Length header', function () {
			beforeEach(function () {
				return (this.response = {
					headers: new Headers({
						'x-transfer-length': '1234',
					}),
				});
			});

			it('should return the value of X-Transfer-Length as compressed length', function () {
				return expect(
					utils.getResponseLength(this.response).compressed,
				).to.equal(1234);
			});

			it('should set the uncompressed length to undefined', function () {
				return expect(utils.getResponseLength(this.response).uncompressed).to.be
					.undefined;
			});
		});

		describe('given a response with only a Content-Length header', function () {
			beforeEach(function () {
				return (this.response = {
					headers: new Headers({
						'content-length': '1234',
					}),
				});
			});

			it('should return the value of Content-Length as uncompressed length', function () {
				return expect(
					utils.getResponseLength(this.response).uncompressed,
				).to.equal(1234);
			});

			it('should set the compressed length to undefined', function () {
				return expect(utils.getResponseLength(this.response).compressed).to.be
					.undefined;
			});
		});

		describe('given a response with an empty X-Transfer-Length header', function () {
			beforeEach(function () {
				return (this.response = {
					headers: new Headers({
						'x-transfer-length': '',
					}),
				});
			});

			it('should set the compressed to undefined', function () {
				return expect(utils.getResponseLength(this.response).compressed).to
					.undefined;
			});
		});

		describe('given a response with an empty Content-Length header', function () {
			beforeEach(function () {
				return (this.response = {
					headers: new Headers({
						'content-length': '',
					}),
				});
			});

			it('should set the uncompressed to undefined', function () {
				return expect(utils.getResponseLength(this.response).uncompressed).to
					.undefined;
			});
		});

		describe('given a response with an invalid X-Transfer-Length header', function () {
			beforeEach(function () {
				return (this.response = {
					headers: new Headers({
						'x-transfer-length': 'asdf',
					}),
				});
			});

			it('should set the compressed to undefined', function () {
				return expect(utils.getResponseLength(this.response).compressed).to
					.undefined;
			});
		});

		describe('given a response with an invalid Content-Length header', function () {
			beforeEach(function () {
				return (this.response = {
					headers: new Headers({
						'content-length': 'asdf',
					}),
				});
			});

			it('should set the uncompressed to undefined', function () {
				return expect(utils.getResponseLength(this.response).uncompressed).to
					.undefined;
			});
		});
	});
});
