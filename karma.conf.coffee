process.env.CHROME_BIN = require('puppeteer').executablePath()
karmaConfig = require('resin-config-karma')
packageJSON = require('./package.json')

fs = require('fs')
console.log('**********')
console.log("CHROME_BIN: #{process.env.CHROME_BIN}")
if fs.existsSync(process.env.CHROME_BIN)
	console.log('CHROME_BIN: File exists')
else
	console.log('CHROME_BIN: FILE DOES NOT EXIST!')
console.log('**********')

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
				'--no-proxy-server'
				'--headless'
				'--disable-gpu'
				'--disable-setuid-sandbox'
				'--disable-translate'
				'--disable-web-security'
				'--disable-dev-shm-usage'
			]

	karmaConfig.logLevel = config.LOG_DEBUG

	karmaConfig.sauceLabs =
		testName: "#{packageJSON.name} v#{packageJSON.version}"
	karmaConfig.client =
		captureConsole: true
	config.set(karmaConfig)
