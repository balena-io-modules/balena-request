var async, errors, settings, urlResolve, utils, _;

_ = require('lodash');

async = require('async');

errors = require('resin-errors');

settings = require('resin-settings-client');

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
  options.url = urlResolve(settings.get('remoteUrl'), options.url);
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
