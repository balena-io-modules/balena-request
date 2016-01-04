
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
var Promise, errors, estimate, prepareOptions, progress, request, requestAsync, rindle, settings, stream, url, utils, _;

Promise = require('bluebird');

stream = require('stream');

request = require('request');

requestAsync = Promise.promisify(request);

progress = require('request-progress');

rindle = require('rindle');

url = require('url');

_ = require('lodash');

errors = require('resin-errors');

settings = require('resin-settings-client');

utils = require('./utils');

estimate = require('./estimate');

prepareOptions = function(options) {
  if (options == null) {
    options = {};
  }
  _.defaultsDeep(options, {
    method: 'GET',
    gzip: true,
    json: true,
    baseUrl: settings.get('apiUrl'),
    qs: {
      apikey: options.apikey
    }
  });
  if (url.parse(options.url).hostname != null) {
    delete options.baseUrl;
  }
  return options;
};


/**
 * @summary Perform an HTTP request to Resin.io
 * @function
 * @public
 *
 * @description
 * This function automatically handles authorization with Resin.io.
 * If you don't pass an API key, the request is made anonymously.
 * This function automatically prepends the Resin.io host, therefore you should pass relative urls.
 *
 * @param {Object} options - options
 * @param {String} [options.method='GET'] - method
 * @param {String} options.url - relative url
 * @param {String} [options.apikey] - API key
 * @param {*} [options.body] - body
 *
 * @fulfil {Object} - response
 * @returns {Promise}
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
 * 	apikey: 'Py6Ebiokt64LJFQQdV56bkOmmhGlqd7U'
 * 	data:
 * 		hello: 'world'
 * .get('body')
 */

exports.send = function(options) {
  if (options == null) {
    options = {};
  }
  return requestAsync(prepareOptions(options)).spread(function(response) {
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
 * @fulfil {Stream} - response
 * @returns {Promise}
 *
 * @example
 * request.stream
 * 	method: 'GET'
 * 	url: '/download/foo'
 * 	apikey: 'Py6Ebiokt64LJFQQdV56bkOmmhGlqd7U'
 * .then (stream) ->
 * 	stream.on 'progress', (state) ->
 * 		console.log(state)
 *
 *		stream.pipe(fs.createWriteStream('/opt/download'))
 */

exports.stream = function(options) {
  var download, estimator, pass;
  if (options == null) {
    options = {};
  }
  download = progress(request(prepareOptions(options)));
  pass = new stream.PassThrough();
  download.pipe(pass);
  estimator = estimate.getEstimator();
  download.on('progress', function(state) {
    return pass.emit('progress', estimator(state));
  });
  return new Promise(function(resolve, reject) {
    return download.on('response', function(response) {
      if (!utils.isErrorCode(response.statusCode)) {
        pass.length = _.parseInt(response.headers['content-length']) || void 0;
        pass.mime = response.headers['content-type'];
        pass.response = response;
        return resolve(pass);
      }
      return rindle.extract(pass).then(function(data) {
        var responseError;
        responseError = data || utils.getErrorMessageFromResponse(response);
        return reject(new errors.ResinRequestError(responseError));
      });
    });
  });
};
