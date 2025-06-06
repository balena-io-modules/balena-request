import type { FormData as FormDataNodeType } from 'formdata-node';

export const getFormDataConstructor = (): FormDataNodeType | FormData => {
	return new FormData();
};

export const getFormDataEncoder = () => {
	throw new Error(
		'form-data-encoder was unexpectedly imported in browser build',
	);
};

export const getStreamFetchLibrary = () => {
	// eslint-disable-next-line @typescript-eslint/no-var-requires
	return require('fetch-readablestream') as typeof fetch;
};
