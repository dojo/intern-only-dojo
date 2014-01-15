import core = require('./interfaces');
import has = require('./has');

var global = (function () { return this; })();
has.add('native-promise', (global) => {
	return typeof global.Promise !== 'undefined';
});
has.add('dom-mutationobserver', (global) => {
	if (!has('host-browser')) {
		return;
	}
	return !!(global.MutationObserver || global.WebKitMutationObserver);
});

// TODO: This works, but should it?
if (has('native-promise')) {
	return <{
		new <T>(resolver:core.IPromiseResolver<T>):core.IPromise<T>;
		all(iterable:any):core.IPromise<any[]>;
		cast<T>(value:T):core.IPromise<T>;
		cast<T>(value:core.IPromise<T>):core.IPromise<T>;
		race(iterable:any):core.IPromise<any>;
		reject<T>(reason:any):core.IPromise<T>;
		resolve<T>(value:T):core.IPromise<T>;
	}>global.Promise;
}

declare var process:any;

var queueMicrotask:(microtask:Function, argumentsList:any[]) => void,
	bind = Function.prototype.bind;

if (has('host-node')) {
	queueMicrotask = (microtask:Function, argumentsList:any[]) => {
		process.nextTick(bind.apply(microtask, [undefined].concat(argumentsList)));;
	};
}
else if (has('dom-mutationobserver')) {
	queueMicrotask = (function () {
		var MutationObserver = this.MutationObserver || this.WebKitMutationObserver,
			callbacks:Function[] = [];

		var observer = new MutationObserver(() => {
			var callback = callbacks.shift();
			if (callback) {
				callback();
			}
			if (callbacks.length) {
				element.setAttribute('drainQueue', 'drainQueue');
			}
		});

		var element = document.createElement('div');
		observer.observe(element, { attributes: true });

		// Chrome Memory Leak: https://bugs.webkit.org/show_bug.cgi?id=93661
		this.addEventListener('unload', () => {
			observer.disconnect();
			observer = element = null;
		});

		return (microtask:Function, argumentsList:any[]) => {
			callbacks.push(bind.apply(microtask, [undefined].concat(argumentsList)));
			element.setAttribute('drainQueue', 'drainQueue');
		};
	})();
}
else {
	queueMicrotask = (microtask:Function, argumentsList:any[]) => {
		setTimeout(bind.apply(microtask, [undefined].concat(argumentsList)), 0);
	};
}

interface IDeferred<T> {
	promise:Promise<T>;
	resolve:(value:T)=>void;
	reject:(reason:any)=>void;
}

function getDeferred<T>(constructor:(resolver:core.IPromiseResolver<T>)=>core.IPromise<T>):IDeferred<T> {
	var deferred = <IDeferred<T>>{},
		promise = Object.create(Promise.prototype);

	var result:core.IPromise<T> = constructor.call(promise, (resolve:core.IPromiseFunction<T>, reject:core.IPromiseFunction<T>) => {
		deferred.resolve = resolve;
		deferred.reject = reject;
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
			return rejectionHandler.call(
				undefined,
				new TypeError('Tried to resolve a promise with itself')
			);
		}

		if (value && typeof value === 'object' && typeof value.then === 'function') {
			if (value instanceof Promise) {
				return value.then(fulfillmentHandler, rejectionHandler);
			}

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
		handlerResult = handler.call(undefined, argument);
	}
	catch (handlerResultError) {
		return deferred.reject.call(undefined, handlerResultError);
	}

	if (handlerResult === deferred.promise) {
		return deferred.reject.call(undefined, new TypeError('Tried to resolve a promise with itself!'));
	}

	if (typeof handlerResult === 'object' && handlerResult && typeof handlerResult.then === 'function') {
		handlerResult.then(deferred.resolve, deferred.reject);
	}
	else {
		return deferred.resolve.call(undefined, handlerResult);
	}
}

function isObject(value:any):boolean {
	return (typeof value === 'object' && value !== null) || typeof value === 'function';
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
				queueMicrotask(executePromiseReaction, [reaction, newResult]);
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
				queueMicrotask(executePromiseReaction, [resolutionReaction, result]);
			}
			else if (status === 'has-rejection') {
				queueMicrotask(executePromiseReaction, [rejectionReaction, result]);
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
		var resolve:core.IPromiseFunction<any>, reject:core.IPromiseFunction<any>,
			promise = new Promise((_resolve, _reject) => {
				resolve = _resolve;
				reject = _reject;
			});

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
					reject(e);
					return promise;
				}

				count -= 1;

				if (count === 0) {
					resolve(values);
				}
			}).bind(null, index), reject);

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
	static cast<T>(value:core.IPromise<T>):Promise<T>;
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
