
/*
The MIT License

Copyright (c) 2015 Resin.io, Inc. https://resin.io.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
 */
var Promise, progress, request, rindle, settings, stream, token, _;

Promise = require('bluebird');

_ = require('lodash');

request = require('request');

stream = require('stream');

progress = require('progress-stream');

settings = require('resin-settings-client');

token = require('resin-token');

rindle = require('rindle');


/**
 * @summary Determine if the token should be updated
 * @function
 * @protected
 *
 * @description
 * This function makes use of a soft user-configurable setting called `tokenRefreshInterval`.
 * That setting doesn't express that the token is "invalid", but represents that it is a good time for the token to be updated *before* it get's outdated.
 *
 * @returns {Promise<Boolean>} the token should be updated
 *
 * @example
 * tokenUtils.shouldUpdateToken().then (shouldUpdateToken) ->
 * 	if shouldUpdateToken
 * 		console.log('Updating token!')
 */

exports.shouldUpdateToken = function() {
  return token.getAge().then(function(age) {
    return age >= settings.get('tokenRefreshInterval');
  });
};


/**
 * @summary Get authorization header content
 * @function
 * @protected
 *
 * @description
 * This promise becomes undefined if no saved token.
 *
 * @returns {Promise<String>} authorization header
 *
 * @example
 * utils.getAuthorizationHeader().then (authorizationHeader) ->
 *		headers =
 *			Authorization: authorizationHeader
 */

exports.getAuthorizationHeader = function() {
  return token.get().then(function(sessionToken) {
    if (sessionToken == null) {
      return;
    }
    return "Bearer " + sessionToken;
  });
};


/**
 * @summary Get error message from response
 * @function
 * @protected
 *
 * @param {Object} response - node request response
 * @returns {String} error message
 *
 * @example
 * request
 *		method: 'GET'
 *		url: 'https://foo.bar'
 *	, (error, response) ->
 *		throw error if error?
 *		message = utils.getErrorMessageFromResponse(response)
 */

exports.getErrorMessageFromResponse = function(response) {
  if (response.body == null) {
    return 'The request was unsuccessful';
  }
  if (response.body.error != null) {
    return response.body.error.text;
  }
  return response.body;
};


/**
 * @summary Check if the status code represents an error
 * @function
 * @protected
 *
 * @param {Number} statusCode - status code
 * @returns {Boolean} represents an error
 *
 * @example
 * if utils.isErrorCode(400)
 *		console.log('400 is an error code!')
 */

exports.isErrorCode = function(statusCode) {
  return statusCode >= 400;
};


/**
 * @summary Make a node request with progress
 * @function
 * @protected
 *
 * @param {Object} options - request options
 * @returns {Promise<Stream>} request stream
 *
 * @example
 * utils.requestProgress(options).then (stream) ->
 * 	stream.pipe(fs.createWriteStream('foo/bar'))
 * 	stream.on 'progress', (state) ->
 * 		console.log(state)
 */

exports.requestProgress = function(options) {
  var requestStream;
  requestStream = request(options);
  return rindle.onEvent(requestStream, 'response').tap(function(response) {
    var headers;
    headers = response.headers;
    response.length = headers['content-length'] || headers['x-transfer-length'];
    return response.length = _.parseInt(response.length) || void 0;
  }).then(function(response) {
    var pass, progressStream, responseData;
    progressStream = progress({
      time: 500,
      length: response.length
    });
    pass = new stream.PassThrough();
    progressStream.on('progress', function(state) {
      if (state.length === 0) {
        return pass.emit('progress', void 0);
      }
      return pass.emit('progress', {
        total: state.length,
        received: state.transferred,
        eta: state.eta,
        percentage: state.percentage
      });
    });
    if (response.headers['x-transfer-length'] != null) {
      responseData = response;
    } else {
      responseData = requestStream;
    }
    responseData.pipe(progressStream).pipe(pass);
    pass.response = response;
    return pass;
  });
};
