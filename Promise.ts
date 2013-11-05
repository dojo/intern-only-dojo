/// <reference path="interfaces.ts" />

import has = require('./has');

var global = (function () { return this; })();
has.add('native-promise', (global) => {
	return typeof global.Promise !== 'undefined';
});

// TODO: This works, but should it?
if (has('native-promise')) {
	return global.Promise;
}

declare var process;

var queue;

if (has('host-node')) {
	queue = (func:Function) => {
		process.nextTick(() => {
			func();
		});
	};
}
else {
	queue = (func:Function) => {
		setTimeout(() => {
			func();
		}, 0);
	};
}

interface IDeferred {
	promise: Promise;
	resolve: (value:any) => void;
	reject: (reason:any) => void;
}

function getDeferred():IDeferred {
	var deferred = <IDeferred>{};
	deferred.promise = new Promise((resolve, reject) => {
		deferred.resolve = resolve;
		deferred.reject = reject;
	});

	return deferred;
}

function makePromiseReactionFunction(deferred:IDeferred, handler:Function):Function {
	function F(value) {
		var handlerResult;
		try {
			handlerResult = handler(value);
		}
		catch (handlerResultE) {
			deferred.reject(handlerResultE);
			return;
		}

		if (!isObject(handlerResult)) {
			deferred.resolve(handlerResult);
			return;
		}

		if (handlerResult === deferred.promise) {
			deferred.reject(new TypeError('Tried to resolve a promise with itself'));
		}

		try {
			if (typeof handlerResult.then !== 'function') {
				deferred.resolve(handlerResult);
				return;
			}
			handlerResult.then(deferred.resolve, deferred.reject);
		}
		catch (thenResultE) {
			deferred.reject(thenResultE);
		}
	}
	return F;
}

function thenableToPromise(value) {
	if (value instanceof Promise || !isObject(value)) {
		return value;
	}

	var deferred = getDeferred();

	try {
		if (typeof value.then !== 'function') {
			return value;
		}
		return value.then(deferred.resolve, deferred.reject);
	}
	catch (e) {
		deferred.reject(e);
	}
	return deferred.promise;
}

function isObject(value) {
	return (typeof value === 'object' && value !== null) || typeof value === 'function';
}

class Promise {
	constructor(resolver:(resolve:(resolution:any)=>any, reject:(reason:any)=>any)=>void) {
		var status = 'unresolved',
			resolveReactions = [],
			rejectReactions = [],
			result;

		function processReactions(reactions, newStatus, newResult) {
			if (status !== 'unresolved') {
				return;
			}
			resolveReactions = rejectReactions = undefined;
			status = newStatus;
			result = newResult;
			reactions.forEach((reaction) => {
				queue(() => {
					reaction(result);
				});
			});
			reactions = undefined;
		}
		var _resolve = processReactions.bind(null, resolveReactions, 'has-resolution'),
			_reject = processReactions.bind(null, rejectReactions, 'has-rejection');

		try {
			resolver(_resolve, _reject);
		}
		catch (e) {
			_reject(e);
		}

		this.then = (onFulfilled?:(resolution:any)=>any, onRejected?:(reason:any)=>any):Promise => {
			var deferred = getDeferred();

			var rejectionHandler = deferred.reject;
			if (typeof onRejected === 'function') {
				rejectionHandler = onRejected;
			}

			var fulfillmentHandler = deferred.resolve;
			if (typeof onFulfilled === 'function') {
				fulfillmentHandler = onFulfilled;
			}

			var resolutionReaction = makePromiseReactionFunction(deferred, (value) => {
				var coerced = thenableToPromise(value);

				if (coerced instanceof Promise) {
					return coerced.then(fulfillmentHandler, rejectionHandler);
				}

				return fulfillmentHandler(value);
			});
			var rejectionReaction = makePromiseReactionFunction(deferred, rejectionHandler);

			if (status === 'unresolved') {
				resolveReactions.push(resolutionReaction);
				rejectReactions.push(rejectionReaction);
			}

			if (status === 'has-resolution') {
				queue(() => {
					resolutionReaction(result);
				});
			}

			if (status === 'has-rejection') {
				queue(() => {
					rejectionReaction(result);
				});
			}

			return deferred.promise;
		};
	}

	catch(onRejected:Function):Promise {
		return this.then(undefined, onRejected);
	}

	then(onFulfilled?:Function, onRejected?:Function):Promise {
		throw new Error('"then" has not been implemented');
	}

	static all(iterable:any):Promise {
		var resolve, reject,
			promise = new Promise((_resolve, _reject) => {
				resolve = _resolve;
				reject = _reject;
			});

		var values = [],
			index = 0,
			count = 0;

		function thenNext(value) {
			var nextPromise = Promise.cast(value);

			nextPromise.then((index, value) => {
				try {
					values[index] = value;
				}
				catch (e) {
					reject(e);
					return promise;
				}

				count -= 1;

				if (count === 0) {
					resolve(values);
				}
			}.bind(null, index), reject);

			index += 1;
			count += 1;
		}

		if (Array.isArray(iterable)) {
			iterable.forEach(thenNext);
		}
		else {
			for (var property in iterable) {
				thenNext(iterable[property]);
			}
		}

		return promise;
	}

	static cast(value:any):Promise {
		if (value instanceof Promise) {
			return value;
		}
		return new Promise((resolve) => {
			resolve(value);
		});
	}

	static race(iterable:any):Promise {
		return new Promise((resolve, reject) => {
			function thenNext(value) {
				var nextPromise = Promise.cast(value);
				nextPromise.then(resolve, reject);
			}

			if (Array.isArray(iterable)) {
				iterable.forEach(thenNext);
			}
			else {
				for (var property in iterable) {
					thenNext(iterable[property]);
				}
			}
		});
	}

	static reject(reason:any):Promise {
		return new Promise((resolve, reject) => {
			reject(reason);
		});
	}

	static resolve(value:any):Promise {
		return new Promise((resolve, reject) => {
			resolve(value);
		});
	}
}

export = Promise;
