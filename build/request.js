var async, errors, urlResolve, utils, _;

_ = require('lodash');

async = require('async');

errors = require('resin-errors');

utils = require('./utils');

urlResolve = require('url').resolve;

exports.request = function(options, callback, onProgress) {
  if (options == null) {
    options = {};
  }
  if (onProgress == null) {
    onProgress = _.noop;
  }
  if (options.url == null) {
    throw new errors.ResinMissingOption('url');
  }
  if (options.remoteUrl == null) {
    throw new errors.ResinMissingOption('remoteUrl');
  }
  options.url = urlResolve(options.remoteUrl, options.url);
  if (options.method != null) {
    options.method = options.method.toUpperCase();
  }
  _.defaults(options, {
    method: 'GET',
    gzip: true
  });
  return async.waterfall([
    function(callback) {
      return utils.checkIfOnline(callback);
    }, function(callback) {
      return utils.authenticate(options, callback);
    }, function(callback) {
      if (options.pipe != null) {
        return utils.pipeRequest(options, callback, onProgress);
      } else {
        return utils.sendRequest(options, callback);
      }
    }
  ], callback);
};
