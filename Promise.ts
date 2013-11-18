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

interface IDeferred<T> {
	promise: Promise<T>;
	resolve: (value:T) => void;
	reject: (reason:any) => void;
}

function getDeferred<T>():IDeferred<T> {
	var deferred = <IDeferred<T>>{};
	deferred.promise = new Promise<T>((resolve, reject) => {
		deferred.resolve = resolve;
		deferred.reject = reject;
	});

	return deferred;
}

interface IReactionFunction<T> {
	(value:T):void;
}
function makePromiseReactionFunction<T>(deferred:IDeferred<T>, handler:Function):IReactionFunction<T> {
	function F(value:T):void {
		var handlerResult;
		try {
			handlerResult = handler(value);
		}
		catch (handlerResultE) {
			return deferred.reject(handlerResultE);
		}

		if (handlerResult === deferred.promise) {
			return deferred.reject(new TypeError('Tried to resolve a promise with itself'));
		}

		if (!isObject(handlerResult)) {
			return deferred.resolve(handlerResult);
		}

		try {
			if (typeof handlerResult.then !== 'function') {
				return deferred.resolve(handlerResult);
			}
			handlerResult.then(deferred.resolve, deferred.reject);
		}
		catch (thenResultE) {
			deferred.reject(thenResultE);
		}
	}
	return F;
}

var thenableToPromise: {
	<T>(value:IPromise<T>):Promise<T>;
	<T>(value:T):Promise<T>;
} = function thenableToPromise<T>(value:any):Promise<T> {
	if (value instanceof Promise || !isObject(value)) {
		return value;
	}

	var deferred = getDeferred<T>();

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
};

function isObject(value:any):boolean {
	return (typeof value === 'object' && value !== null) || typeof value === 'function';
}

class Promise<T> implements IPromise<T> {
	constructor(resolver:IPromiseResolver<T>) {
		var status = 'pending',
			resolveReactions:Array<IReactionFunction<T>> = [],
			rejectReactions:Array<IReactionFunction<T>> = [],
			result;

		function processReactions(reactions, newStatus, newResult) {
			if (status !== 'pending') {
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

		var then: {
			<U>(onFulfilled?:(value:T)=>U, onRejected?:(reason:any)=>U):IPromise<U>;
			<U>(onFulfilled?:(value:T)=>U, onRejected?:(reason:any)=>IPromise<U>):IPromise<U>;
			<U>(onFulfilled?:(value:T)=>IPromise<U>, onRejected?:(reason:any)=>U):IPromise<U>;
			<U>(onFulfilled?:(value:T)=>IPromise<U>, onRejected?:(reason:any)=>IPromise<U>):IPromise<U>;
		} = function then<U>(onFulfilled?:any, onRejected?:any):Promise<U> {
			var deferred = getDeferred<U>(),
				promise = this;

			var rejectionHandler = (error) => {
				throw error;
			};
			if (typeof onRejected === 'function') {
				rejectionHandler = onRejected;
			}

			var fulfillmentHandler = (value) => {
				return value;
			};
			if (typeof onFulfilled === 'function') {
				fulfillmentHandler = onFulfilled;
			}

			var resolutionReaction = makePromiseReactionFunction(deferred, (value) => {
				if (value === promise) {
					return rejectionHandler(
						new TypeError('Tried to resolve a promise with itself')
					);
				}

				var coerced = thenableToPromise(value);

				if (coerced instanceof Promise) {
					return coerced.then(fulfillmentHandler, rejectionHandler);
				}

				return fulfillmentHandler(value);
			});
			var rejectionReaction = makePromiseReactionFunction(deferred, rejectionHandler);

			if (status === 'pending') {
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
		this.then = then;
	}

	catch<U>(onRejected:(reason:any)=>U):Promise<U>;
	catch<U>(onRejected:(reason:any)=>IPromise<U>):Promise<U>;
	catch<U>(onRejected:(reason:any)=>any):Promise<U> {
		return this.then<U>(undefined, onRejected);
	}

	then<U>(onFulfilled?:(value:T)=>U, onRejected?:(reason:any)=>U):Promise<U>;
	then<U>(onFulfilled?:(value:T)=>U, onRejected?:(reason:any)=>IPromise<U>):Promise<U>;
	then<U>(onFulfilled?:(value:T)=>IPromise<U>, onRejected?:(reason:any)=>U):Promise<U>;
	then<U>(onFulfilled?:(value:T)=>IPromise<U>, onRejected?:(reason:any)=>IPromise<U>):Promise<U>;
	then<U>(onFulfilled?:(value:T)=>any, onRejected?:(reason:any)=>any):Promise<U> {
		throw new Error('"then" has not been implemented');
	}

	static all(iterable:any):Promise<any[]> {
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

	static cast<T>(value:T):Promise<T>;
	static cast<T>(value:IPromise<T>):Promise<T>;
	static cast<T>(value:any):Promise<T> {
		if (value instanceof Promise) {
			return value;
		}
		return new Promise<T>((resolve) => {
			resolve(value);
		});
	}

	static race(iterable:any):Promise<any> {
		return new Promise((resolve, reject) => {
			function thenNext<T>(value:T) {
				var nextPromise = Promise.cast<T>(value);
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

	static reject<T>(reason:any):Promise<T> {
		return new Promise<T>((resolve, reject) => {
			reject(reason);
		});
	}

	static resolve<T>(value:T):Promise<T> {
		return new Promise<T>((resolve, reject) => {
			resolve(value);
		});
	}
}

export = Promise;
