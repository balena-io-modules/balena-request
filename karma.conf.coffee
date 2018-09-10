process = require('process')
process.env.CHROME_BIN = require('puppeteer').executablePath()
karmaConfig = require('resin-config-karma')
packageJSON = require('./package.json')

module.exports = (config) ->
	karmaConfig.plugins.push(require('karma-chrome-launcher'))
	karmaConfig.browsers = ['HeadlessChrome']
	karmaConfig.browserDisconnectTimeout = 60000
	karmaConfig.browserDisconnectTolerance = 3
	karmaConfig.browserNoActivityTimeout = 60000
	karmaConfig.customLaunchers =
		HeadlessChrome:
			base: 'ChromeHeadless'
			flags: [
				'--no-sandbox'
				'--headless'
				'--disable-gpu'
				'--disable-setuid-sandbox'
				'--disable-translate'
				'--disable-web-security'
			]

	karmaConfig.logLevel = config.LOG_INFO

	karmaConfig.sauceLabs =
		testName: "#{packageJSON.name} v#{packageJSON.version}"
	karmaConfig.client =
		captureConsole: true
	config.set(karmaConfig)
