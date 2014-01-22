import core = require('./interfaces');
import has = require('./has');
import nextTick = require('./nextTick');

var global = (function () { return this; })();
has.add('native-promise', (global) => {
	return typeof global.Promise !== 'undefined';
});

// TODO: This works, but should it? Also, Chrome's Promise doesn't meet the
// spec and accepts objects instead of rejecting
/*if (has('native-promise')) {
	return <{
		new <T>(resolver:core.IPromiseResolver<T>):core.IPromise<T>;
		all(iterable:any):core.IPromise<any[]>;
		cast<T>(value:T):core.IPromise<T>;
		cast<T>(value:core.IPromise<T>):core.IPromise<T>;
		race(iterable:any):core.IPromise<any>;
		reject<T>(reason:any):core.IPromise<T>;
		resolve<T>(value:T):core.IPromise<T>;
	}>global.Promise;
}*/

interface IDeferred<T> {
	promise:core.IPromise<T>;
	resolve:(value:T)=>void;
	reject:(reason:any)=>void;
}

function getDeferred<T>(constructor:(resolver:core.IPromiseResolver<T>)=>core.IPromise<T>):IDeferred<T> {
	var deferred = <IDeferred<T>>{},
		promise:core.IPromise<T> = Object.create(constructor.prototype);

	var result:core.IPromise<T> = constructor.call(promise, (resolve:core.IPromiseFunction<T>, reject:core.IPromiseFunction<T>) => {
		deferred.resolve = resolve.bind(undefined);
		deferred.reject = reject.bind(undefined);
	});

	deferred.promise = typeof result === 'object' ? result : promise;

	return deferred;
}

interface IResolutionHandler<T> {
	(value:T):T;
	(value:core.IPromise<T>):core.IPromise<T>;
}
function makeResolutionHandler<T>(promise:core.IPromise<any>, fulfillmentHandler:any, rejectionHandler:any):IResolutionHandler<T> {
	function F(value:any):any {
		if (value === promise) {
			return rejectionHandler(new TypeError('Tried to resolve a promise with itself'));
		}

		if (value && typeof value === 'object' && typeof value.then === 'function') {
			var deferred = getDeferred<T>((<any>promise).constructor);
			try {
				value.then(deferred.resolve, deferred.reject);
			}
			catch (e) {
				deferred.reject(e);
			}
			return deferred.promise.then(fulfillmentHandler, rejectionHandler);
		}
		else {
			return fulfillmentHandler(value);
		}
	}
	return F;
}

interface IReaction {
	deferred:IDeferred<any>;
	handler:(value:any)=>any;
}

function executePromiseReaction(reaction:IReaction, argument:any) {
	var deferred = reaction.deferred,
		handler = reaction.handler,
		handlerResult:any;

	try {
		handlerResult = handler(argument);
	}
	catch (handlerResultError) {
		return deferred.reject(handlerResultError);
	}

	if (handlerResult === deferred.promise) {
		return deferred.reject(new TypeError('Tried to resolve a promise with itself!'));
	}

	if (typeof handlerResult === 'object' && handlerResult && typeof handlerResult.then === 'function') {
		try {
			handlerResult.then(deferred.resolve, deferred.reject);
		}
		catch (thenError) {
			deferred.reject(thenError);
		}
	}
	else {
		return deferred.resolve(handlerResult);
	}
}

var identity = (value:any):any => {
	return value;
};
var errorIdentity = (error:any):void => {
	throw error;
};

class Promise<T> implements core.IPromise<T> {
	constructor(resolver:core.IPromiseResolver<T>) {
		var status = 'pending',
			resolveReactions:IReaction[] = [],
			rejectReactions:IReaction[] = [],
			result:T;

		function triggerReactions(reactions:IReaction[], newStatus:string, newResult:T) {
			if (status !== 'pending') {
				return;
			}
			resolveReactions = rejectReactions = undefined;
			status = newStatus;
			result = newResult;
			reactions.forEach((reaction) => {
				nextTick(executePromiseReaction.bind(null, reaction, newResult));
			});
			reactions = undefined;
		}
		var _resolve = triggerReactions.bind(undefined, resolveReactions, 'has-resolution'),
			_reject = triggerReactions.bind(undefined, rejectReactions, 'has-rejection');

		try {
			resolver(_resolve, _reject);
		}
		catch (e) {
			_reject(e);
		}

		var then: {
			<U>(onFulfilled?:(value:T)=>U, onRejected?:(reason:any)=>U):core.IPromise<U>;
			<U>(onFulfilled?:(value:T)=>U, onRejected?:(reason:any)=>core.IPromise<U>):core.IPromise<U>;
			<U>(onFulfilled?:(value:T)=>core.IPromise<U>, onRejected?:(reason:any)=>U):core.IPromise<U>;
			<U>(onFulfilled?:(value:T)=>core.IPromise<U>, onRejected?:(reason:any)=>core.IPromise<U>):core.IPromise<U>;
		} = function then<U>(onFulfilled?:any, onRejected?:any):Promise<U> {
			var promise = this,
				deferred = getDeferred<U>((<any>promise).constructor);

			var rejectionHandler = errorIdentity;
			if (typeof onRejected === 'function') {
				rejectionHandler = onRejected;
			}

			var fulfillmentHandler = identity;
			if (typeof onFulfilled === 'function') {
				fulfillmentHandler = onFulfilled;
			}

			var resolutionReaction = {
					deferred: deferred,
					handler: makeResolutionHandler<U>(promise, fulfillmentHandler, rejectionHandler)
				},
				rejectionReaction = {
					deferred: deferred,
					handler: rejectionHandler
				};

			if (status === 'pending') {
				resolveReactions.push(resolutionReaction);
				rejectReactions.push(rejectionReaction);
			} 
			else if (status === 'has-resolution') {
				nextTick(executePromiseReaction.bind(null, resolutionReaction, result));
			}
			else if (status === 'has-rejection') {
				nextTick(executePromiseReaction.bind(null, rejectionReaction, result));
			}

			return deferred.promise;
		};
		this.then = then;
	}

	catch<U>(onRejected:(reason:any)=>U):Promise<U>;
	catch<U>(onRejected:(reason:any)=>core.IPromise<U>):Promise<U>;
	catch<U>(onRejected:(reason:any)=>any):Promise<U> {
		return this.then<U>(undefined, onRejected);
	}

	then<U>(onFulfilled?:(value:T)=>U, onRejected?:(reason:any)=>U):Promise<U>;
	then<U>(onFulfilled?:(value:T)=>U, onRejected?:(reason:any)=>core.IPromise<U>):Promise<U>;
	then<U>(onFulfilled?:(value:T)=>core.IPromise<U>, onRejected?:(reason:any)=>U):Promise<U>;
	then<U>(onFulfilled?:(value:T)=>core.IPromise<U>, onRejected?:(reason:any)=>core.IPromise<U>):Promise<U>;
	then<U>(onFulfilled?:(value:T)=>any, onRejected?:(reason:any)=>any):Promise<U> {
		throw new Error('"then" has not been implemented');
	}

	static all(iterable:any):Promise<any[]> {
		var C = this,
			deferred = getDeferred<any[]>(<any>C);

		if (!Array.isArray(iterable)) {
			// In ES5, the only ES6-compatible iterable object is an Array
			deferred.reject(new TypeError('Non-iterable passed to "all"'));
			return deferred.promise;
		}

		var values:any[] = [],
			index = 0,
			count = 0;

		function thenNext(value:any) {
			var nextPromise = Promise.cast(value);

			nextPromise.then(((index:number, value:any) => {
				try {
					values[index] = value;
				}
				catch (e) {
					deferred.reject(e);
					return deferred.promise;
				}

				count -= 1;

				if (count === 0) {
					deferred.resolve(values);
				}
			}).bind(null, index), deferred.reject);

			index += 1;
			count += 1;
		}

		if (!iterable.length) {
			deferred.resolve(values);
		}
		else {
			iterable.forEach(thenNext);
		}

		return deferred.promise;
	}

	static cast<T>(value:T):Promise<T>;
	static cast<T>(value:core.IPromise<T>):Promise<T>;
	static cast<T>(value:any):Promise<T> {
		var C = this;

		if (value instanceof Promise) {
			if (value.constructor === C) {
				return value;
			}
		}

		var deferred = getDeferred<T>(<any>C);
		deferred.resolve(value);
		return deferred.promise;
	}

	static race(iterable:any):Promise<any> {
		var C = this,
			deferred = getDeferred<any>(<any>C);

		function thenNext<T>(value:T) {
			var nextPromise = Promise.cast<T>(value);
			nextPromise.then(deferred.resolve, deferred.reject);
		}

		if (Array.isArray(iterable)) {
			iterable.forEach(thenNext);
		}
		else {
			for (var property in iterable) {
				thenNext(iterable[property]);
			}
		}

		return deferred.promise;
	}

	static reject<T>(reason:any):Promise<T> {
		var C = this,
			deferred = getDeferred<T>(<any>C);

		deferred.reject(reason);

		return deferred.promise;
	}

	static resolve<T>(value:core.IPromise<T>):Promise<T>;
	static resolve<T>(value:T):Promise<T>;
	static resolve<T>(value:any):Promise<T> {
		var C = this,
			deferred = getDeferred<T>(<any>C);

		deferred.resolve(value);

		return deferred.promise;
	}
}

export = Promise;
