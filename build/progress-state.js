var ProgressState, errors, getCurrentTime, _;

_ = require('lodash');

errors = require('resin-errors');

ProgressState = (function() {
  function ProgressState(options) {
    if (options.total != null) {
      if (!_.isNumber(options.total) || options.total < 0) {
        throw new errors.ResinInvalidOption('total', options.total);
      }
    }
    if (options.percentage != null) {
      if (!_.isNumber(options.percentage) || options.percentage < 0 || options.percentage > 100) {
        throw new errors.ResinInvalidOption('percentage', options.percentage);
      }
    }
    if (options.eta != null) {
      if (!_.isNumber(options.eta) || options.eta < 0) {
        throw new errors.ResinInvalidOption('eta', options.eta);
      }
    }
    if (options.received == null) {
      throw new errors.ResinMissingOption('received');
    }
    if (!_.isNumber(options.received) || options.received < 0) {
      throw new errors.ResinInvalidOption('received', options.received);
    }
    if ((options.total != null) && options.received > options.total) {
      throw new errors.ResinInvalidOption('received', options.received, "" + options.received + " > " + options.total);
    }
    if (options.delta == null) {
      throw new errors.ResinMissingOption('delta');
    }
    if (!_.isNumber(options.delta) || options.delta < 0) {
      throw new errors.ResinInvalidOption('delta', options.delta);
    }
    if ((options.total != null) && options.delta > options.total) {
      throw new errors.ResinInvalidOption('delta', options.delta, "" + options.delta + " > " + options.total);
    }
    if (options.delta > options.received) {
      throw new errors.ResinInvalidOption('delta', options.delta, "" + options.delta + " > " + options.received);
    }
    _.extend(this, options);
  }

  return ProgressState;

})();

getCurrentTime = function() {
  return new Date().getTime();
};

ProgressState.createFromNodeRequestProgress = function(callback) {
  var received, time;
  time = getCurrentTime();
  received = 0;
  return function(state) {
    var eta, newTime, progressState, receivedDelta, remaining, remainingTicks, timeDelta;
    if (process.env.DEBUG) {
      console.log('');
      console.log(state);
    }
    if (state.total == null) {
      return callback();
    }
    newTime = getCurrentTime();
    timeDelta = newTime - time;
    time = newTime;
    remaining = state.total - state.received;
    receivedDelta = state.received - received;
    remainingTicks = remaining / receivedDelta;
    eta = Math.floor(remainingTicks * timeDelta);
    progressState = new ProgressState({
      percentage: state.percent,
      received: state.received,
      total: state.total,
      eta: eta,
      delta: receivedDelta
    });
    return callback(progressState);
  };
};

module.exports = ProgressState;
