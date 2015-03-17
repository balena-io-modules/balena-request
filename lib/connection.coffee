isOnline = require('is-online')
request = require('request')

# A wrapper around isOnline in order to be able to stub it with Sinon
exports.isOnline = isOnline

# A wrapper around request in order to be able to stub it with Sinon
exports.request = request
