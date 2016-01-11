resin-request
-------------

[![npm version](https://badge.fury.io/js/resin-request.svg)](http://badge.fury.io/js/resin-request)
[![dependencies](https://david-dm.org/resin-io/resin-request.png)](https://david-dm.org/resin-io/resin-request.png)
[![Build Status](https://travis-ci.org/resin-io/resin-request.svg?branch=master)](https://travis-ci.org/resin-io/resin-request)
[![Build status](https://ci.appveyor.com/api/projects/status/8qmwhh1vhm27otn4?svg=true)](https://ci.appveyor.com/project/jviotti/resin-request)

Join our online chat at [![Gitter chat](https://badges.gitter.im/resin-io/chat.png)](https://gitter.im/resin-io/chat)

Resin.io HTTP client.

Role
----

The intention of this module is to provide an exclusive client to make HTTP requests to the Resin.io servers.

**THIS MODULE IS LOW LEVEL AND IS NOT MEANT TO BE USED BY END USERS DIRECTLY**.

Unless you know what you're doing, use the [Resin SDK](https://github.com/resin-io/resin-sdk) instead.

Installation
------------

Install `resin-request` by running:

```sh
$ npm install --save resin-request
```

Documentation
-------------


* [request](#module_request)
    * [.send(options)](#module_request.send) ⇒ <code>Promise.&lt;Object&gt;</code>
    * [.stream(options)](#module_request.stream) ⇒ <code>Promise.&lt;Stream&gt;</code>

<a name="module_request.send"></a>
### request.send(options) ⇒ <code>Promise.&lt;Object&gt;</code>
This function automatically handles authorizacion with Resin.io.
If you don't have a token, the request is made anonymously.
This function automatically prepends the Resin.io host, therefore you should pass relative urls.

**Kind**: static method of <code>[request](#module_request)</code>  
**Summary**: Perform an HTTP request to Resin.io  
**Returns**: <code>Promise.&lt;Object&gt;</code> - response  
**Access:** public  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| options | <code>Object</code> |  | options |
| [options.method] | <code>String</code> | <code>&#x27;GET&#x27;</code> | method |
| options.url | <code>String</code> |  | relative url |
| [options.body] | <code>\*</code> |  | body |

**Example**  
```js
request.send
	method: 'GET'
	url: '/foo'
.get('body')
```
**Example**  
```js
request.send
	method: 'POST'
	url: '/bar'
	data:
		hello: 'world'
.get('body')
```
<a name="module_request.stream"></a>
### request.stream(options) ⇒ <code>Promise.&lt;Stream&gt;</code>
This function emits a `progress` event, passing an object with the following properties:

- `Number percent`: from 0 to 100.
- `Number total`: total bytes to be transmitted.
- `Number received`: number of bytes transmitted.
- `Number eta`: estimated remaining time, in seconds.

The stream may also contain the following custom properties:

- `Number .length`: Calculated from the `Content-Length` HTTP header.
- `String .mime`: Equals the value of the `Content-Type` HTTP header.

**Kind**: static method of <code>[request](#module_request)</code>  
**Summary**: Stream an HTTP response from Resin.io.  
**Returns**: <code>Promise.&lt;Stream&gt;</code> - response  
**Access:** public  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| options | <code>Object</code> |  | options |
| [options.method] | <code>String</code> | <code>&#x27;GET&#x27;</code> | method |
| options.url | <code>String</code> |  | relative url |
| [options.body] | <code>\*</code> |  | body |

**Example**  
```js
request.stream
	method: 'GET'
	url: '/download/foo'
.then (stream) ->
	stream.on 'progress', (state) ->
		console.log(state)

		stream.pipe(fs.createWriteStream('/opt/download'))
```

Support
-------

If you're having any problem, please [raise an issue](https://github.com/resin-io/resin-request/issues/new) on GitHub and the Resin.io team will be happy to help.

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

License
-------

The project is licensed under the Apache 2.0 license.
