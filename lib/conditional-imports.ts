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
