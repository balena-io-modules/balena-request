export type PonyfilledFetch = typeof fetch;
export type PonyfilledHeaders = typeof Headers;

export type FetchPonyfill = (options: {
	Promise: PromiseConstructor;
}) => {
	fetch: PonyfilledFetch;
	Headers: PonyfilledHeaders;
};
