var getKarmaConfig = require('balena-config-karma');

var packageJSON = require('./package.json');

getKarmaConfig.DEFAULT_WEBPACK_CONFIG.externals = {
  fs: true
};

module.exports = function(config) {
  var karmaConfig = getKarmaConfig(packageJSON);
  karmaConfig.logLevel = config.LOG_INFO
  return config.set(karmaConfig);
};
