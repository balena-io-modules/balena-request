const Bluebird = require('bluebird');
const m = require('mochainon');
const zlib = require('zlib-browserify');
const { PassThrough } = require('stream');
const rindle = require('rindle');

const gzip = Bluebird.promisify(zlib.gzip);

const mockServer = require('mockttp').getLocal();

const { auth, request, IS_BROWSER } = require('./setup')();

const { expect } = m.chai;

describe('Request (stream):', function () {
	beforeEach(() => Promise.all([auth.removeKey(), mockServer.start()]));

	afterEach(() => mockServer.stop());

	describe('given a simple endpoint that responds with an error', function () {
		beforeEach(() =>
			mockServer.get('/foo').thenReply(400, 'Something happened'),
		);

		it('should reject with the error message', function () {
			const promise = request.stream({
				method: 'GET',
				baseUrl: mockServer.url,
				url: '/foo',
			});

			return expect(promise).to.be.rejectedWith('Something happened');
		});

		it('should have the status code in the error object', () =>
			expect(
				request.stream({
					method: 'GET',
					baseUrl: mockServer.url,
					url: '/foo',
				}),
			).to.be.rejected.then((error) => expect(error.statusCode).to.equal(400)));
	});

	describe('given a simple endpoint that responds with a string', function () {
		beforeEach(() =>
			mockServer.get('/foo').thenReply(200, 'Lorem ipsum dolor sit amet'),
		);

		it('should be able to pipe the response', () =>
			request
				.stream({
					method: 'GET',
					baseUrl: mockServer.url,
					url: '/foo',
				})
				.then(rindle.extract)
				.then((data) => expect(data).to.equal('Lorem ipsum dolor sit amet')));

		it('should be able to pipe the response after a delay', () =>
			request
				.stream({
					method: 'GET',
					baseUrl: mockServer.url,
					url: '/foo',
				})
				.then((stream) => Bluebird.delay(200).return(stream))
				.then(function (stream) {
					const pass = new PassThrough();
					stream.pipe(pass);

					return rindle
						.extract(pass)
						.then((data) =>
							expect(data).to.equal('Lorem ipsum dolor sit amet'),
						);
				}));
	});

	describe('given multiple endpoints', function () {
		beforeEach(() =>
			['get', 'post', 'put', 'patch', 'delete'].forEach((method) =>
				mockServer[method]('/foo').thenReply(200, method.toUpperCase()),
			),
		);

		describe('given no method option', () =>
			it('should default to GET', () =>
				request
					.stream({
						baseUrl: mockServer.url,
						url: '/foo',
					})
					.then(rindle.extract)
					.then((data) => expect(data).to.equal('GET'))));
	});

	describe('given a gzip endpoint with an x-transfer-length header', function () {
		beforeEach(function () {
			const message = 'Lorem ipsum dolor sit amet';
			return gzip(message).then((compressedMessage) =>
				mockServer.get('/foo').thenReply(200, compressedMessage, {
					'Content-Type': 'text/plain',
					'X-Transfer-Length': '' + compressedMessage.length,
					'Content-Encoding': 'gzip',
				}),
			);
		});

		it('should correctly uncompress the body', () =>
			request
				.stream({
					baseUrl: mockServer.url,
					url: '/foo',
				})
				.then((stream) => rindle.extract(stream))
				.then(function (data) {
					expect(data).to.equal('Lorem ipsum dolor sit amet');
					return expect(data.length).to.equal(26);
				}));

		it('should set no .length property', () =>
			request
				.stream({
					baseUrl: mockServer.url,
					url: '/foo',
				})
				.then((stream) => expect(stream.length).to.be.undefined));
	});

	describe('given an gzip endpoint with a content-length header', function () {
		beforeEach(function () {
			const message = 'Lorem ipsum dolor sit amet';
			return gzip(message).then((compressedMessage) =>
				mockServer.get('/foo').thenReply(200, compressedMessage, {
					'Content-Type': 'text/plain',
					'Content-Length': '' + compressedMessage.length,
					'Content-Encoding': 'gzip',
				}),
			);
		});

		it('should correctly uncompress the body', () =>
			request
				.stream({
					baseUrl: mockServer.url,
					url: '/foo',
				})
				.then((stream) => rindle.extract(stream))
				.then(function (data) {
					expect(data).to.equal('Lorem ipsum dolor sit amet');
					return expect(data.length).to.equal(26);
				}));
	});

	describe('given an gzip endpoint with a content-length and x-transfer-length headers', function () {
		beforeEach(function () {
			const message = 'Lorem ipsum dolor sit amet';
			return gzip(message).then((compressedMessage) =>
				mockServer.get('/foo').thenReply(200, compressedMessage, {
					'Content-Type': 'text/plain',
					'X-Transfer-Length': '' + compressedMessage.length,
					'Content-Length': '' + compressedMessage.length,
					'Content-Encoding': 'gzip',
				}),
			);
		});

		it('should correctly uncompress the body', () =>
			request
				.stream({
					baseUrl: mockServer.url,
					url: '/foo',
				})
				.then((stream) => rindle.extract(stream))
				.then(function (data) {
					expect(data).to.equal('Lorem ipsum dolor sit amet');
					return expect(data.length).to.equal(26);
				}));
	});

	describe('given an endpoint with a content-type header', function () {
		beforeEach(function () {
			const message = 'Lorem ipsum dolor sit amet';
			return mockServer.get('/foo').thenReply(200, message, {
				'Content-Type': 'application/octet-stream',
			});
		});

		it('should become a stream with a mime property', () =>
			request
				.stream({
					baseUrl: mockServer.url,
					url: '/foo',
				})
				.then((stream) =>
					expect(stream.mime).to.equal('application/octet-stream'),
				));
	});
});
