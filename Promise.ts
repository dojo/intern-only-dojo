/// <reference path="interfaces.ts" />

import has = require('./has');

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

function makePromiseReactionFunction(promise:Promise, resolve:Function, reject:Function, handler:Function):Function {
	function F(value) {
		var handlerResult;
		try {
			handlerResult = handler(value);
		}
		catch (handlerResultE) {
			reject(handlerResultE);
			return;
		}

		if (!isObject(handlerResult)) {
			resolve(handlerResult);
			return;
		}

		if (handlerResult === promise) {
			reject(new TypeError('Tried to resolve a promise with itself'));
		}

		var then;
		try {
			then = handlerResult.then;
		}
		catch (thenE) {
			reject(thenE);
			return;
		}

		if (typeof then !== 'function') {
			resolve(handlerResult);
			return;
		}

		try {
			then.call(handlerResult, resolve, reject);
		}
		catch (thenResultE) {
			reject(thenResultE);
		}
	}
	return F;
}

function thenableToPromise(value) {
	if (value instanceof Promise || !isObject(value)) {
		return value;
	}

	var reject, resolve,
		promise = new Promise((_reject, _resolve) => {
			reject = _reject;
			resolve = _resolve;
		});

	try {
		if (typeof value.then !== 'function') {
			return value;
		}
		return value.then(resolve, reject);
	}
	catch (e) {
		reject(e);
	}
	return promise;
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

		function _resolver(reactions, newStatus, newResult) {
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
		var _resolve = _resolver.bind(null, resolveReactions, 'has-resolution'),
			_reject = _resolver.bind(null, rejectReactions, 'has-rejection');

		try {
			resolver(_resolve, _reject);
		}
		catch (e) {
			_reject(e);
		}

		this.then = (onFulfilled?:(resolution:any)=>any, onRejected?:(reason:any)=>any):Promise => {
			var resolve, reject,
				promise = new Promise((_resolve, _reject) => {
					resolve = _resolve;
					reject = _reject;
				});

			var rejectionHandler = reject;
			if (typeof onRejected === 'function') {
				rejectionHandler = onRejected;
			}

			var fulfillmentHandler = resolve;
			if (typeof onFulfilled === 'function') {
				fulfillmentHandler = onFulfilled;
			}

			var resolutionReaction = makePromiseReactionFunction(promise, resolve, reject, (value) => {
				var coerced = thenableToPromise(value);

				if (coerced instanceof Promise) {
					return coerced.then(fulfillmentHandler, rejectionHandler);
				}

				return fulfillmentHandler(value);
			});
			var rejectionReaction = makePromiseReactionFunction(promise, resolve, reject, rejectionHandler);

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

			return promise;
		};
	}

	catch(onRejected:Function):Promise {
		return this.then(undefined, onRejected);
	}

	then(onResolved?:Function, onRejected?:Function):Promise {
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
					Object.defineProperty(values, index, {
						value: value,
						writable:true,
						enumerable: true,
						configurable: true
					});
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
