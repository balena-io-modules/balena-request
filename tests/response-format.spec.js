import { expect } from 'chai';
import setup from './setup';
import * as errors from 'balena-errors';
import * as mockhttp from 'mockttp';

const mockServer = mockhttp.getLocal();

const { auth, request, IS_BROWSER } = setup();

const RESPONSE_BODY = { from: 'foobar' };

describe('responseFormat:', function () {
	this.timeout(10000);

	beforeEach(() => Promise.all([auth.removeKey(), mockServer.start()]));

	afterEach(() => mockServer.stop());

	describe('given a JSON response with custom content-type', function () {
		beforeEach(() =>
			mockServer.forGet('/').thenReply(200, JSON.stringify(RESPONSE_BODY), {
				'Content-Type': 'application/x-my-json',
			}),
		);

		it('should return the plain string given no `responseFormat`', function () {
			const promise = request
				.send({
					method: 'GET',
					baseUrl: mockServer.url,
					url: '/',
				})
				.then((v) => v.body);
			return expect(promise).to.eventually.become(
				JSON.stringify(RESPONSE_BODY),
			);
		});

		it("should properly parse the response given the 'json' `responseFormat`", function () {
			const promise = request
				.send({
					method: 'GET',
					baseUrl: mockServer.url,
					url: '/',
					responseFormat: 'json',
				})
				.then((v) => v.body);
			return expect(promise).to.eventually.become(RESPONSE_BODY);
		});

		it("should return null given the 'none' `responseFormat`", function () {
			const promise = request
				.send({
					method: 'GET',
					baseUrl: mockServer.url,
					url: '/',
					responseFormat: 'none',
				})
				.then((v) => v.body);
			return expect(promise).to.eventually.become(null);
		});

		it("should return a blob/buffer given the 'blob' `responseFormat`", function () {
			const promise = request
				.send({
					method: 'GET',
					baseUrl: mockServer.url,
					url: '/',
					responseFormat: 'blob',
				})
				.then(function ({ body }) {
					// in node we convert to a Buffer
					if (!IS_BROWSER) {
						return body.arrayBuffer().then(Buffer.from);
					}
					// use the FileReader to read the blob content as a string
					return new Promise(function (resolve) {
						const reader = new FileReader();
						reader.addEventListener('loadend', () => resolve(reader.result));
						return reader.readAsText(body);
					});
				});
			return expect(promise).to.eventually.satisfy(function (body) {
				const s = JSON.stringify(RESPONSE_BODY);
				if (IS_BROWSER) {
					return body === s;
				} else {
					const b = Buffer.from(s, 'utf-8');

					return b.equals(body);
				}
			});
		});

		it('should throw given invalid `responseFormat`', function () {
			const promise = request.send({
				method: 'GET',
				baseUrl: mockServer.url,
				url: '/',
				responseFormat: 'uzabzabza',
			});
			return expect(promise).to.be.rejectedWith(
				errors.BalenaInvalidParameterError,
			);
		});
	});
});
