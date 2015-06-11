var ProgressState, connection, errors, progress, token, _;

_ = require('lodash');

progress = require('request-progress');

errors = require('resin-errors');

token = require('resin-token');

connection = require('./connection');

ProgressState = require('./progress-state');

exports.checkIfOnline = function(callback) {
  return connection.isOnline(function(error, isOnline) {
    if (error != null) {
      return callback(error);
    }
    if (isOnline) {
      return callback();
    }
    return callback(new errors.ResinNoInternetConnection());
  });
};

exports.addAuthorizationHeader = function(headers, token) {
  if (headers == null) {
    headers = {};
  }
  if (token == null) {
    throw new errors.ResinMissingParameter('token');
  }
  headers.Authorization = "Bearer " + token;
  return headers;
};

exports.authenticate = function(options, callback) {
  var sessionToken;
  if (options == null) {
    throw new errors.ResinMissingParameter('options');
  }
  sessionToken = token.get();
  if (sessionToken != null) {
    options.headers = exports.addAuthorizationHeader(options.headers, sessionToken);
  }
  return callback();
};

exports.pipeRequest = function(options, callback) {
  if (options == null) {
    throw new errors.ResinMissingParameter('options');
  }
  if (options.pipe == null) {
    throw new errors.ResinMissingOption('pipe');
  }
  options.pipe.on('error', callback).on('close', callback);
  return progress(connection.request(options)).on('progress', ProgressState.createFromNodeRequestProgress(options.onProgress)).on('error', callback).on('end', callback).on('data', function(chunk) {
    return options.pipe.write(chunk);
  });
};

exports.sendRequest = function(options, callback) {
  return connection.request(options, function(error, response) {
    if (error != null) {
      return callback(error);
    }
    if (process.env.DEBUG) {
      console.log("DEBUG: " + options.method + " " + options.url + " -> " + response.statusCode);
    }
    if (response.statusCode >= 400) {
      if (response.body.error != null) {
        return callback(new errors.ResinRequestError(response.body.error.text));
      } else {
        return callback(new errors.ResinRequestError(response.body));
      }
    }
    try {
      response.body = JSON.parse(response.body);
    } catch (_error) {}
    return callback(null, response, response.body);
  });
};
