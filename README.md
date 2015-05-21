resin-request
-------------

[![npm version](https://badge.fury.io/js/resin-request.svg)](http://badge.fury.io/js/resin-request)
[![dependencies](https://david-dm.org/resin-io/resin-request.png)](https://david-dm.org/resin-io/resin-request.png)
[![Build Status](https://travis-ci.org/resin-io/resin-request.svg?branch=master)](https://travis-ci.org/resin-io/resin-request)
[![Build status](https://ci.appveyor.com/api/projects/status/8qmwhh1vhm27otn4?svg=true)](https://ci.appveyor.com/project/jviotti/resin-request)

Resin.io HTTP request client.

Installation
------------

Install `resin-request` by running:

```sh
$ npm install --save resin-request
```

Documentation
-------------

### resinRequest.request(Object options, Function callback[, Function onProgress])

Make an HTTP request to a resin server.

#### String options.url

The relative url to make the request to.

#### String options.method

The HTTP method to perform. Defaults to `GET`.

#### Object options.json

Optional request JSON body.

#### StreamWritable options.pipe

A stream to pipe the request. Useful if downloading a file.

If you use this option, you may use the `onProgress` callback.

#### Function callback(error, response, body)

This function is called when the request is completed.

#### Function onProgress(state)

A function called to notify the progress if piping the request.

The `state` object contains:

- `percentage`: The percentage of the request.
- `received`: The amount of bytes received.
- `total`: The total amount of bytes.
- `eta`: The request time estimate.
- `delta`: The number of bytes received since the last call to `onProgress`.

Notice that if the resource doesn't expose a `content-length` containing the size of the resource, `state` will be undefined.

Debug
-----

If you set the following environment variable: `DEBUG=true` you'll get information about the url of the requests being made along with their response's status code.

Tests
-----

Run the test suite by doing:

```sh
$ gulp test
```

Contribute
----------

- Issue Tracker: [github.com/resin-io/resin-request/issues](https://github.com/resin-io/resin-request/issues)
- Source Code: [github.com/resin-io/resin-request](https://github.com/resin-io/resin-request)

Before submitting a PR, please make sure that you include tests, and that [coffeelint](http://www.coffeelint.org/) runs without any warning:

```sh
$ gulp lint
```

Support
-------

If you're having any problem, please [raise an issue](https://github.com/resin-io/resin-request/issues/new) on GitHub.

ChangeLog
---------

### v1.2.5

- Upgrade Resin Settings Client to v1.0.1, which defaults remoteUrl to api.resin.io.

### v1.2.4

- Fix pipe issue.

### v1.2.3

- Print node-request progress state on `DEBUG`.
- Configure Hound CI correctly.

### v1.2.2

- Print request method on `DEBUG`.

### v1.2.1

- Improve error logging support.
- Implement `DEBUG` flag.

### v1.2.0

- Make use of [resin-settings-client](https://github.com/resin-io/resin-settings-client) to retrieve `options.remoteUrl`.

### v1.1.0

- `options.token` option is now obsolete, as the token is fetched automatically with [resin-token](https://github.com/resin-io/resin-token).

License
-------

The project is licensed under the MIT license.
