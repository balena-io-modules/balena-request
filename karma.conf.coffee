karmaConfig = require('resin-config-karma')
packageJSON = require('./package.json')

module.exports = (config) ->
	karmaConfig.plugins.push(require('karma-chrome-launcher'))
	karmaConfig.browsers = ['ChromeHeadless']

	karmaConfig.logLevel = config.LOG_INFO

	karmaConfig.sauceLabs =
		testName: "#{packageJSON.name} v#{packageJSON.version}"
	karmaConfig.client =
		captureConsole: true
	config.set(karmaConfig)
