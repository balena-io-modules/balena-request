
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
exports.getEstimator = function() {
  var time;
  time = null;
  return function(state) {
    var newTime, remainingTicks, timeDelta;
    if (state.total == null) {
      return;
    }
    remainingTicks = (state.total - state.received) / state.received;
    newTime = new Date().getTime();
    if (time == null) {
      time = newTime;
    }
    timeDelta = newTime - time;
    time = newTime;
    state.eta = Math.floor(remainingTicks * timeDelta) || void 0;
    if (state.percent != null) {
      state.percentage = state.percent;
      delete state.percent;
    }
    return state;
  };
};
