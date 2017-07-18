"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var Promise = require("bluebird");
var url_1 = require("url");
var assign_1 = require("lodash/assign");
var noop_1 = require("lodash/noop");
var defaults_1 = require("lodash/defaults");
var isEmpty_1 = require("lodash/isEmpty");
var resin_errors_1 = require("resin-errors");
var utils_1 = require("./utils");
var progress_1 = require("./progress");
var onlyIf = utils_1.default.onlyIf;
var getRequest = function (_a) {
    var _b = _a === void 0 ? {} : _a, token = _b.token, _c = _b.debug, debug = _c === void 0 ? false : _c, _d = _b.retries, retries = _d === void 0 ? 0 : _d, _e = _b.isBrowser, isBrowser = _e === void 0 ? false : _e, _f = _b.interceptors, interceptors = _f === void 0 ? [] : _f;
    var requestAsync = utils_1.default.getRequestAsync();
    var debugRequest = !debug ? noop_1.default : utils_1.default.debugRequest;
    var exports = {};
    var prepareOptions = function (options) {
        if (options === void 0) { options = {}; }
        defaults_1.default(options, {
            method: 'GET',
            json: true,
            strictSSL: true,
            headers: {},
            refreshToken: true,
            retries: retries
        });
        var baseUrl = options.baseUrl;
        if (options.uri) {
            options.url = options.uri;
            delete options.uri;
        }
        if (url_1.default.parse(options.url).protocol != null) {
            delete options.baseUrl;
        }
        return Promise.try(function () {
            if (!(token != null && options.refreshToken)) {
                return;
            }
            return utils_1.default.shouldUpdateToken(token).then(function (shouldUpdateToken) {
                if (!shouldUpdateToken) {
                    return;
                }
                return (exports
                    .send({
                    url: '/whoami',
                    baseUrl: baseUrl,
                    refreshToken: false
                })
                    .catch({
                    code: 'ResinRequestError',
                    statusCode: 401
                }, function () {
                    return token.get().tap(token.remove).then(function (sessionToken) {
                        throw new resin_errors_1.default.ResinExpiredToken(sessionToken);
                    });
                })
                    .get('body')
                    .then(token.set));
            });
        })
            .then(function () { return utils_1.default.getAuthorizationHeader(token); })
            .then(function (authorizationHeader) {
            if (authorizationHeader != null) {
                options.headers.Authorization = authorizationHeader;
            }
            if (!isEmpty_1.default(options.apiKey)) {
                options.url += url_1.default.parse(options.url).query != null ? '&' : '?';
                options.url += "apikey=" + options.apiKey;
            }
            return options;
        });
    };
    var interceptRequestOptions = function (requestOptions) {
        return interceptRequestOrError(Promise.resolve(requestOptions));
    };
    var interceptRequestError = function (requestError) {
        return interceptRequestOrError(Promise.reject(requestError));
    };
    var interceptResponse = function (response) {
        return interceptResponseOrError(Promise.resolve(response));
    };
    var interceptResponseError = function (responseError) {
        return interceptResponseOrError(Promise.reject(responseError));
    };
    var attachRequestHandlers = function (promise, _a) {
        var request = _a.request, requestError = _a.requestError;
        if (request != null || requestError != null) {
            return promise.then(request, requestError);
        }
        else {
            return promise;
        }
    };
    var interceptRequestOrError = function (initialPromise) {
        return Promise.resolve(exports.interceptors.reduce(attachRequestHandlers, initialPromise));
    };
    var attachResponseHandlers = function (promise, _a) {
        var response = _a.response, responseError = _a.responseError;
        if (response != null || responseError != null) {
            return promise.then(response, responseError);
        }
        else {
            return promise;
        }
    };
    var interceptResponseOrError = function (initialPromise) {
        interceptors = exports.interceptors.slice().reverse();
        return Promise.resolve(interceptors.reduce(attachResponseHandlers, initialPromise));
    };
    exports.send = function (options) {
        if (options === void 0) { options = {}; }
        if (options.timeout == null) {
            options.timeout = 30000;
        }
        return prepareOptions(options)
            .then(interceptRequestOptions, interceptRequestError)
            .then(function (options) {
            return requestAsync(options).catch(function (error) {
                error.requestOptions = options;
                throw error;
            });
        })
            .then(function (response) {
            return utils_1.default.getBody(response, options.responseFormat).then(function (body) {
                response = assign_1.default({}, response, { body: body });
                if (utils_1.default.isErrorCode(response.statusCode)) {
                    var responseError = utils_1.default.getErrorMessageFromResponse(response);
                    debugRequest(options, response);
                    throw new resin_errors_1.default.ResinRequestError(responseError, response.statusCode, options);
                }
                return response;
            });
        })
            .then(interceptResponse, interceptResponseError);
    };
    exports.stream = onlyIf(!isBrowser)(function (options) {
        if (options === void 0) { options = {}; }
        var rindle = require('rindle');
        return prepareOptions(options)
            .then(interceptRequestOptions, interceptRequestError)
            .then(progress_1.default.estimate(requestAsync))
            .then(function (download) {
            if (!utils_1.default.isErrorCode(download.response.statusCode)) {
                download.mime = download.response.headers.get('Content-Type');
                return download;
            }
            return rindle.extract(download).then(function (data) {
                var responseError = data || 'The request was unsuccessful';
                debugRequest(options, download.response);
                throw new resin_errors_1.default.ResinRequestError(responseError, download.response.statusCode);
            });
        })
            .then(interceptResponse, interceptResponseError);
    });
    exports.interceptors = interceptors;
    exports._setFetch = function (fetch) {
        requestAsync = utils_1.default.getRequestAsync(fetch);
    };
    return exports;
};
exports.default = getRequest;
//# sourceMappingURL=request.js.map