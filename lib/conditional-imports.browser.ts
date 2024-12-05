import type { FormData as FormDataNodeType } from 'formdata-node';

export const getFormDataConstructor = (): FormDataNodeType | FormData => {
	return new FormData();
};

export const getFormDataEncoder = () => {
	throw new Error(
		'form-data-encoder was unexpectedly imported in browser build',
	);
};

export const createGunzip = () => {
	throw new Error('createGunzip was unexpectedly called in browser build');
};
