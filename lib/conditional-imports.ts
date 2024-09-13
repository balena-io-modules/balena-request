import type { FormData as FormDataNodeType } from 'formdata-node';

const IS_BROWSER = typeof window !== 'undefined' && window !== null;

export const getFormDataConstructor = (): FormDataNodeType | FormData => {
	if (!IS_BROWSER) {
		const { FormData: NodeFormData } =
			// eslint-disable-next-line @typescript-eslint/no-var-requires
			require('formdata-node') as typeof import('formdata-node');

		return new NodeFormData();
	}
	return new FormData();
};

export const getFormDataEncoder = () => {
	const { FormDataEncoder } =
		// eslint-disable-next-line @typescript-eslint/no-var-requires
		require('form-data-encoder') as typeof import('form-data-encoder');
	return FormDataEncoder;
};

export const getStreamFetchLibrary = () => {
	// On node we still use node-fetch since there doesn't seem to be a way
	// to avoid auto-decompressing a stream when using native fetch,
	// which blocks us from giving back a correct download progress.
	if (IS_BROWSER) {
		return require('fetch-readablestream');
	}
	return require('node-fetch');
};

export const createGunzip = () => {
	// eslint-disable-next-line @typescript-eslint/no-var-requires
	const zlib = require('zlib') as typeof import('zlib');

	// Be more lenient with decoding compressed responses, since (very rarely)
	// servers send slightly invalid gzip responses that are still accepted
	// by common browsers.
	// Always using Z_SYNC_FLUSH is what cURL does.
	let zlibOptions = {
		flush: zlib.constants.Z_SYNC_FLUSH,
		finishFlush: zlib.constants.Z_SYNC_FLUSH,
	};

	// Allow overriding this behaviour by setting the ZLIB_FLUSH env var
	// to one of the allowed zlib flush values (process.env.ZLIB_FLUSH="Z_NO_FLUSH").
	// https://github.com/nodejs/node/blob/master/doc/api/zlib.md#zlib-constants
	if (process.env.ZLIB_FLUSH && process.env.ZLIB_FLUSH in zlib.constants) {
		zlibOptions = {
			flush:
				zlib.constants[process.env.ZLIB_FLUSH as keyof typeof zlib.constants],
			finishFlush:
				zlib.constants[process.env.ZLIB_FLUSH as keyof typeof zlib.constants],
		};
	}

	const gunzip = zlib.createGunzip(zlibOptions);
	return gunzip;
};
