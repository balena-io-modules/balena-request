"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var Promise = require("bluebird");
var fetchPonyfill = require("fetch-ponyfill");
var urlLib = require("url");
var qs = require("qs");
var parseInt = require("lodash/parseInt");
var includes = require("lodash/includes");
var resin_errors_1 = require("resin-errors");
var _a = fetchPonyfill({ Promise: Promise }), normalFetch = _a.fetch, Headers = _a.Headers;
var IS_BROWSER = typeof window !== 'undefined' && window !== null;
exports.TOKEN_REFRESH_INTERVAL = 1 * 1000 * 60 * 60;
exports.shouldUpdateToken = function (token) {
    return token.getAge().then(function (age) { return age >= exports.TOKEN_REFRESH_INTERVAL; });
};
exports.getAuthorizationHeader = Promise.method(function (token) {
    if (token == null) {
        return;
    }
    return token.get().then(function (sessionToken) {
        if (sessionToken == null) {
            return;
        }
        return "Bearer " + sessionToken;
    });
});
exports.getErrorMessageFromResponse = function (response) {
    if (!response.body) {
        return 'The request was unsuccessful';
    }
    if (response.body.error != null) {
        return response.body.error.text;
    }
    return response.body;
};
exports.isErrorCode = function (statusCode) { return statusCode >= 400; };
exports.isResponseCompressed = function (response) {
    return response.headers.get('Content-Encoding') === 'gzip';
};
exports.getResponseLength = function (response) {
    return {
        uncompressed: parseInt(response.headers.get('Content-Length'), 10) || undefined,
        compressed: parseInt(response.headers.get('X-Transfer-Length'), 10) || undefined
    };
};
exports.debugRequest = function (options, response) {
    return console.error(Object.assign({
        statusCode: response.statusCode,
        duration: response.duration
    }, options));
};
var UNSUPPORTED_REQUEST_PARAMS = [
    'qsParseOptions',
    'qsStringifyOptions',
    'useQuerystring',
    'form',
    'formData',
    'multipart',
    'preambleCRLF',
    'postambleCRLF',
    'jsonReviver',
    'jsonReplacer',
    'auth',
    'oauth',
    'aws',
    'httpSignature',
    'followAllRedirects',
    'maxRedirects',
    'removeRefererHeader',
    'encoding',
    'jar',
    'agent',
    'agentClass',
    'agentOptions',
    'forever',
    'pool',
    'localAddress',
    'proxy',
    'proxyHeaderWhiteList',
    'proxyHeaderExclusiveList',
    'time',
    'har',
    'callback'
];
var processRequestOptions = function (options) {
    if (options === void 0) { options = {}; }
    var url = options.url || options.uri;
    if (options.baseUrl) {
        url = urlLib.resolve(options.baseUrl, url);
    }
    if (options.qs) {
        var params = qs.stringify(options.qs);
        url += (url.indexOf('?') >= 0 ? '&' : '?') + params;
    }
    var opts = {};
    opts.timeout = options.timeout;
    opts.retries = options.retries;
    opts.method = options.method;
    opts.compress = options.gzip;
    var body = options.body, headers = options.headers;
    if (typeof headers === 'undefined' || headers === null) {
        headers = {};
    }
    if (options.json && body) {
        body = JSON.stringify(body);
        headers['Content-Type'] = 'application/json';
    }
    opts.body = body;
    if (!IS_BROWSER) {
        if (!headers['Accept-Encoding']) {
            headers['Accept-Encoding'] = 'compress, gzip';
        }
    }
    if (options.followRedirect) {
        opts.redirect = 'follow';
    }
    opts.headers = new Headers(headers);
    if (options.strictSSL === false) {
        throw new Error('`strictSSL` must be true or absent');
    }
    for (var i = 0; i < UNSUPPORTED_REQUEST_PARAMS.length; i++) {
        var key = UNSUPPORTED_REQUEST_PARAMS[i];
        if (options[key] != null) {
            throw new Error("The " + key + " param is not supported. Value: " + options[key]);
        }
    }
    opts.mode = 'cors';
    return [url, opts];
};
exports.getBody = function (response, responseFormat) {
    return Promise.try(function () {
        if (responseFormat === 'none') {
            return null;
        }
        var contentType = response.headers.get('Content-Type');
        if (responseFormat === 'blob' ||
            (responseFormat == null && includes(contentType, 'binary/octet-stream'))) {
            if (typeof response.blob === 'function') {
                return response.blob();
            }
            if (typeof response.buffer === 'function') {
                return response.buffer();
            }
            throw new Error('This `fetch` implementation does not support decoding binary streams.');
        }
        if (responseFormat === 'json' ||
            (responseFormat == null && includes(contentType, 'application/json'))) {
            return response.json();
        }
        if (responseFormat == null || responseFormat === 'text') {
            return response.text();
        }
        throw new resin_errors_1.ResinInvalidParameterError('responseFormat', responseFormat);
    });
};
var requestAsync = function (fetch, options, retriesRemaining) {
    var _a = processRequestOptions(options), url = _a[0], opts = _a[1];
    if (typeof retriesRemaining === 'undefined' || retriesRemaining === null) {
        retriesRemaining = opts.retries;
    }
    var requestTime = new Date().getTime();
    var p = fetch(url, opts);
    if (opts.timeout && IS_BROWSER) {
        p = p.timeout(opts.timeout);
    }
    p = p.then(function (response) {
        var responseTime = new Date().getTime();
        response.duration = responseTime - requestTime;
        response.statusCode = response.status;
        response.request = {
            headers: options.headers,
            uri: urlLib.parse(url)
        };
        return response;
    });
    if (retriesRemaining > 0) {
        return p.catch(function () { return requestAsync(fetch, options, retriesRemaining - 1); });
    }
    else {
        return p;
    }
};
exports.getRequestAsync = function (fetch) {
    if (fetch === void 0) { fetch = normalFetch; }
    return function (options) { return requestAsync(fetch, options); };
};
exports.notImplemented = function () {
    throw new Error('The method is not implemented.');
};
exports.onlyIf = function (cond) { return function (fn) {
    if (cond) {
        return fn;
    }
    else {
        return exports.notImplemented;
    }
}; };
//# sourceMappingURL=utils.js.map