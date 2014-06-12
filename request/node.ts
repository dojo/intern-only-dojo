/// <reference path="../nodejs" />
import core = require('../interfaces');
import http = require('http');
import https = require('https');
import Promise = require('../Promise');
import request = require('../request');
import urlUtil = require('url');

interface IOptions {
	agent?:any;
	auth?:string;
	headers?:{ [name:string]:string; };
	host?:string;
	hostname?:string;
	localAddress?:string;
	method?:string;
	path?:string;
	port?:number;
	socketPath?:string;
}

interface IHttpsOptions extends IOptions {
	ca?:any;
	cert?:string;
	ciphers?:string;
	key?:string;
	passphrase?:string;
	pfx?:any;
	rejectUnauthorized?:boolean;
	secureProtocol?:string;
}

module node {
	export interface INodeRequestOptions extends request.IRequestOptions {
		agent?:any;
		ca?:any;
		cert?:string;
		ciphers?:string;
		dataEncoding?:string;
		key?:string;
		localAddress?:string;
		passphrase?:string;
		pfx?:any;
		rejectUnauthorized?:boolean;
		secureProtocol?:string;
		socketPath?:string;
		socketOptions?:{
			keepAlive?:number;
			noDelay?:boolean;
			timeout?:number;
		};
		streamData?:boolean;
		streamEncoding?:string;
	}
}

function node(url:string, options:node.INodeRequestOptions):Promise<request.IResponse> {
	var deferred:Promise.Deferred<request.IResponse> = new Promise.Deferred(function (reason:Error):void {
		request && request.abort();
		throw reason;
	});
	var promise:request.IRequestPromise = <request.IRequestPromise> deferred.promise;
	var parsedUrl:urlUtil.Url = urlUtil.parse(url);
	var requestOptions:IHttpsOptions = {
		agent: options.agent,
		auth: parsedUrl.auth || options.auth,
		ca: options.ca,
		cert: options.cert,
		ciphers: options.ciphers,
		headers: options.headers,
		host: parsedUrl.host,
		hostname: parsedUrl.hostname,
		key: options.key,
		localAddress: options.localAddress,
		method: options.method,
		passphrase: options.passphrase,
		path: parsedUrl.path,
		pfx: options.pfx,
		port: +parsedUrl.port,
		rejectUnauthorized: options.rejectUnauthorized,
		secureProtocol: options.secureProtocol,
		socketPath: options.socketPath
	};

	if (!options.auth && (options.user || options.password)) {
		requestOptions.auth = encodeURIComponent(options.user || '') + ':' + encodeURIComponent(options.password || '');
	}

	// TODO: Cast to `any` prevents TS2226 error
	var request:http.ClientRequest = (parsedUrl.protocol === 'https:' ? <any> https : http).request(requestOptions);
	var response:request.IResponse = {
		data: null,
		getHeader: function (name:string):string {
			return (this.nativeResponse && this.nativeResponse.headers[name.toLowerCase()]) || null;
		},
		requestOptions: options,
		statusCode: null,
		url: url
	};

	if (options.socketOptions) {
		if ('timeout' in options.socketOptions) {
			request.setTimeout(options.socketOptions.timeout);
		}

		if ('noDelay' in options.socketOptions) {
			request.setNoDelay(options.socketOptions.noDelay);
		}

		if ('keepAlive' in options.socketOptions) {
			var initialDelay:number = options.socketOptions.keepAlive;
			request.setSocketKeepAlive(initialDelay >= 0, initialDelay || 0);
		}
	}

	request.once('response', function (nativeResponse:http.ClientResponse):void {
		var data:any[];
		var loaded:number = 0;
		var total:number = +nativeResponse.headers['content-length'];

		if (!options.streamData) {
			data = [];
		}

		options.streamEncoding && nativeResponse.setEncoding(options.streamEncoding);

		nativeResponse.on('data', function (chunk:any):void {
			options.streamData || data.push(chunk);
			loaded += Buffer.byteLength(chunk);
			deferred.progress({ type: 'data', chunk: chunk, loaded: loaded, total: total });
		});

		nativeResponse.once('end', function ():void {
			timeout && timeout.remove();

			if (!options.streamData) {
				response.data = options.streamEncoding ? data.join('') : Buffer.concat(data, loaded);
			}

			deferred.resolve(response);
		});

		deferred.progress({ type: 'nativeResponse', response: nativeResponse });
		response.nativeResponse = nativeResponse;
		response.statusCode = nativeResponse.statusCode;
	});

	request.once('error', deferred.reject);

	if (options.data) {
		if (options.data.pipe) {
			options.data.pipe(request);
		}
		else {
			request.end(options.data, options.dataEncoding);
		}
	}
	else {
		request.end();
	}

	if (options.timeout > 0 && options.timeout !== Infinity) {
		var timeout:core.IHandle = (function ():core.IHandle {
			var timer = setTimeout(function ():void {
				var error = new Error('Request timed out after ' + options.timeout + 'ms');
				error.name = 'RequestTimeoutError';
				promise.cancel(error);
			}, options.timeout);

			return {
				remove: function ():void {
					this.remove = function ():void {};
					clearTimeout(timer);
				}
			};
		})();
	}

	return promise;
}

export = node;
