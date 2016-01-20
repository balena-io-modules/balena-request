
/*
Copyright 2016 Resin.io

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

   http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
 */

/**
 * @module request
 */
var Promise, errors, prepareOptions, progress, request, requestAsync, rindle, settings, token, url, utils, _;

Promise = require('bluebird');

request = require('request');

requestAsync = Promise.promisify(request);

url = require('url');

_ = require('lodash');

rindle = require('rindle');

errors = require('resin-errors');

settings = require('resin-settings-client');

token = require('resin-token');

utils = require('./utils');

progress = require('./progress');

prepareOptions = function(options) {
  if (options == null) {
    options = {};
  }
  _.defaults(options, {
    method: 'GET',
    json: true,
    strictSSL: true,
    gzip: true,
    headers: {},
    refreshToken: true
  });
  options.url = url.resolve(settings.get('apiUrl'), options.url);
  return Promise["try"](function() {
    if (!options.refreshToken) {
      return;
    }
    return utils.shouldUpdateToken().then(function(shouldUpdateToken) {
      if (!shouldUpdateToken) {
        return;
      }
      return exports.send({
        url: '/whoami',
        refreshToken: false
      }).get('body').then(token.set);
    });
  }).then(utils.getAuthorizationHeader).then(function(authorizationHeader) {
    if (authorizationHeader != null) {
      options.headers.Authorization = authorizationHeader;
    }
    return options;
  });
};


/**
 * @summary Perform an HTTP request to Resin.io
 * @function
 * @public
 *
 * @description
 * This function automatically handles authorizacion with Resin.io.
 * If you don't have a token, the request is made anonymously.
 * This function automatically prepends the Resin.io host, therefore you should pass relative urls.
 *
 * @param {Object} options - options
 * @param {String} [options.method='GET'] - method
 * @param {String} options.url - relative url
 * @param {*} [options.body] - body
 *
 * @returns {Promise<Object>} response
 *
 * @example
 * request.send
 * 	method: 'GET'
 * 	url: '/foo'
 * .get('body')
 *
 * @example
 * request.send
 * 	method: 'POST'
 * 	url: '/bar'
 * 	data:
 * 		hello: 'world'
 * .get('body')
 */

exports.send = function(options) {
  if (options == null) {
    options = {};
  }
  return prepareOptions(options).then(requestAsync).spread(function(response) {
    var responseError;
    if (utils.isErrorCode(response.statusCode)) {
      responseError = utils.getErrorMessageFromResponse(response);
      throw new errors.ResinRequestError(responseError);
    }
    return response;
  });
};


/**
 * @summary Stream an HTTP response from Resin.io.
 * @function
 * @public
 *
 * @description
 * This function emits a `progress` event, passing an object with the following properties:
 *
 * - `Number percent`: from 0 to 100.
 * - `Number total`: total bytes to be transmitted.
 * - `Number received`: number of bytes transmitted.
 * - `Number eta`: estimated remaining time, in seconds.
 *
 * The stream may also contain the following custom properties:
 *
 * - `Number .length`: Calculated from the `Content-Length` HTTP header.
 * - `String .mime`: Equals the value of the `Content-Type` HTTP header.
 *
 * @param {Object} options - options
 * @param {String} [options.method='GET'] - method
 * @param {String} options.url - relative url
 * @param {*} [options.body] - body
 *
 * @returns {Promise<Stream>} response
 *
 * @example
 * request.stream
 * 	method: 'GET'
 * 	url: '/download/foo'
 * .then (stream) ->
 * 	stream.on 'progress', (state) ->
 * 		console.log(state)
 *
 *		stream.pipe(fs.createWriteStream('/opt/download'))
 */

exports.stream = function(options) {
  if (options == null) {
    options = {};
  }
  return prepareOptions(options).then(progress.estimate).then(function(download) {
    if (!utils.isErrorCode(download.response.statusCode)) {
      download.length = download.response.length;
      download.mime = download.response.headers['content-type'];
      return download;
    }
    return rindle.extract(download).then(function(data) {
      var responseError;
      responseError = data || utils.getErrorMessageFromResponse(download.response);
      throw new errors.ResinRequestError(responseError);
    });
  });
};
