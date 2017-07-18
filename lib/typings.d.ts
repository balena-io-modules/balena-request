// Temp file, to be removed once everything is moved from the resin-ui repo to the corresponding modules

declare module 'typed-error' {
	class TypedError extends Function {
		name: string;
		message: string;
		stack: string;
	}

	export = TypedError;
}

declare module 'resin-errors' {
	export interface ResinError extends Error {
		code: string;
	}

	export class ResinRequestError implements ResinError {
		constructor(body: string, statusCode: number, requestOptions: object);
		code: 'ResinRequestError';
		name: string;
		message: string;
		statusCode: number;
		requestOptions: object;
	}

	export class ResinInvalidParameterError implements ResinError {
		constructor(parameterName: string, suppliedValue: any);
		code: 'ResinInvalidParameterError';
		name: string;
		message: string;
		parameterName: string;
		suppliedValue: any;
	}
}

declare module 'resin-token' {
	namespace ResinToken {
		type ResinTokenType = string;

		interface ResinToken {
			get: () => Promise<ResinTokenType>;
			set: (token: ResinTokenType) => Promise<void>;
			getAge: () => Promise<number>;
		}
	}

	function ResinToken(options: object): ResinToken.ResinToken;

	export = ResinToken;
}

declare module 'fetch-ponyfill' {
	interface FetchPonyfillOptions {
		Promise?: typeof Promise;
		XMLHttpRequest?: typeof XMLHttpRequest;
	}

	interface FetchPonyfillResult {
		fetch: typeof fetch;
		Request: typeof Request;
		Response: typeof Response;
		Headers: typeof Headers;
	}

	function FetchPonyfill(options: FetchPonyfillOptions): FetchPonyfillResult;

	export = FetchPonyfill;
}
