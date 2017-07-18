"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var noop_1 = require("lodash/noop");
var utils_1 = require("./utils");
var getProgressStream = function (total, onState) {
    if (onState === void 0) { onState = noop_1.default; }
    var progress = require('progress-stream');
    var progressStream = progress({
        time: 500,
        length: total
    });
    progressStream.on('progress', function (state) {
        if (state.length === 0) {
            return onState();
        }
        return onState({
            total: state.length,
            received: state.transferred,
            eta: state.eta,
            percentage: state.percentage
        });
    });
    return progressStream;
};
exports.estimate = function (requestAsync) {
    return function (options) {
        if (typeof requestAsync === 'undefined' || requestAsync === null) {
            requestAsync = utils_1.default.getRequestAsync();
        }
        var zlib = require('zlib');
        var stream = require('stream');
        options.gzip = false;
        options.headers['Accept-Encoding'] = 'gzip, deflate';
        return requestAsync(options).then(function (response) {
            var output = new stream.PassThrough();
            output.response = response;
            var responseLength = utils_1.default.getResponseLength(response);
            var total = responseLength.uncompressed || responseLength.compressed;
            var responseStream = response.body;
            var progressStream = getProgressStream(total, function (state) {
                return output.emit('progress', state);
            });
            if (utils_1.default.isResponseCompressed(response)) {
                var gunzip = new zlib.createGunzip();
                if (responseLength.compressed != null &&
                    responseLength.uncompressed == null) {
                    responseStream.pipe(progressStream).pipe(gunzip).pipe(output);
                }
                else {
                    responseStream.pipe(gunzip).pipe(progressStream).pipe(output);
                }
            }
            else {
                responseStream.pipe(progressStream).pipe(output);
            }
            return output;
        });
    };
};
//# sourceMappingURL=progress.js.map