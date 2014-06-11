import has = require('./has');
import nextTick = require('./nextTick');

interface ICallback<T, U> {
	callback:(value?:T) => U;
	deferred:Promise.Deferred<U>;
}

var enqueue:(callback:(...args:any[]) => any) => void = (function () {
	function originalSchedule():void {
		schedule = function ():void {};

		nextTick(function ():void {
			isRunning = true;
			try {
				var callback:(...args:any[]) => void;
				while ((callback = queue.pop())) {
					callback();
				}
			}
			finally {
				isRunning = false;
				schedule = originalSchedule;
			}
		});
	}

	var isRunning = false;
	var queue:Array<(...args:any[]) => void> = [];
	var schedule = originalSchedule;

	return function (callback:(...args:any[]) => void):void {
		if (isRunning) {
			callback();
			return;
		}

		queue.push(callback);
		schedule();
	};
})();

/**
 * A Promise represents the result of an asynchronous operation. When writing a function that performs an asynchronous
 * operation, instead of writing the function to accept a callback function, you should instead write it to return a
 * Promise that is fulfilled once the asynchronous operation is completed. Returning a promise instead of accepting
 * a callback provides a standard mechanism for handling asynchronous operations that offers the following benefits
 * over a normal callback function:
 *
 * 1. Multiple callbacks can be added for a single function invocation;
 * 2. Other asynchronous operations can be easily chained to the response, avoiding callback pyramids;
 * 3. Asynchronous operations can be cancelled in flight in a standard way if their results are no longer needed by the
 *    rest of the application.
 */
class Promise<T> {
	/**
	 * Converts an iterable object containing promises into a single promise that resolves to a new iterable object
	 * containing all the fulfilled properties of the original object. Properties that do not contain promises are
	 * passed through as-is.
	 *
	 * @example
	 * Promise.all({
	 *   foo: Promise.resolve('foo'),
	 *   bar: 'bar'
	 * }).then(function (resolved) {
	 *   resolve.foo === 'foo'; // true
	 *   resolve.bar === 'bar'; // true
	 * });
	 */
	static all<U>(iterable:{ [key:string]:U; }):Promise<{ [key:string]:U; }>;
	static all<U>(iterable:U[]):Promise<U[]>;
	static all(iterable:any):Promise<any> {
		function fulfill(key:string, value:any):void {
			values[key] = value;
			++complete;
			finish();
		}

		function finish():void {
			if (populating || complete < total) {
				return;
			}

			deferred.resolve(values);
		}

		function processItem(key:any):void {
			++total;
			var value:any = iterable[key];
			if (value && value.then) {
				value.then(fulfill.bind(null, key), fulfill.bind(null, key));
			}
			else {
				fulfill(key, value);
			}
		}

		var values:any = Array.isArray(iterable) ? [] : {};
		// TODO: Aborter
		var deferred:Promise.Deferred<typeof values> = new Promise.Deferred();
		var complete:number = 0;
		var total:number = 0;
		var populating:boolean = true;

		if (Array.isArray(iterable)) {
			for (var i = 0; i < iterable.length; i++) {
				if (i in iterable) {
					processItem(i);
				}
			}
		}
		else {
			for (var key in iterable) {
				processItem(key);
			}
		}

		populating = false;
		finish();

		return deferred.promise;
	}

	/**
	 * Creates a new promise that is pre-rejected with the given error.
	 */
	static reject<T>(error?:Error):Promise<T> {
		var deferred = new Promise.Deferred();
		deferred.reject(error);
		return deferred.promise;
	}

	/**
	 * Creates a new promise that is pre-resolved with the given value. If the passed value is already a promise, it
	 * will be returned as-is.
	 */
	static resolve<T>(value:Promise<T>):Promise<T>;
	static resolve<T>(value:T):Promise<T>;
	static resolve<T>(value:any):Promise<T> {
		if (value instanceof Promise) {
			return value;
		}

		var deferred = new Promise.Deferred();
		deferred.resolve(value);
		return deferred.promise;
	}

	/**
	 * Creates a new Promise.
	 *
	 * @constructor
	 *
	 * @param initializer
	 * The initializer function is called immediately when the Promise is instantiated. It is responsible for starting
	 * the asynchronous operation when it is invoked.
	 *
	 * The initializer must call either the passed `resolve` function when the asynchronous operation has completed
	 * successfully, or the `reject` function when the operation fails, unless the the `aborter` is called first.
	 *
	 * The `progress` function can also be called zero or more times to provide information about the process of the
	 * operation to any interested consumers.
	 *
	 * Finally, the initializer can register an aborter function that aborts the asynchronous operation by passing the
	 * aborter function to the `setAborter` function.
	 */
	constructor(
		initializer:(
			resolve?:(value?:T) => void,
			reject?:(error?:Error) => void,
			progress?:(data?:any) => void,
			setAborter?:(aborter:Promise.IAborter<T>) => void
		) => void
	) {
		/**
		 * The current state of this promise.
		 */
		var state:Promise.State = Promise.State.PENDING;

		/**
		 * The fulfilled value for this promise.
		 *
		 * @type {T|Error}
		 */
		var fulfilledValue:any;

		/**
		 * A list of registered callbacks that should be executed once this promise has been resolved.
		 */
		var resolveCallbacks:ICallback<T, any>[] = [];

		/**
		 * A list of registered callbacks that should be executed once this promise has been rejected.
		 */
		var rejectCallbacks:ICallback<Error, any>[] = [];

		/**
		 * A list of registered callbacks that should be executed when the underlying asynchronous operation has
		 * experienced progress.
		 */
		var progressCallbacks:ICallback<any, any>[] = [];

		/**
		 * Schedules a callback for execution on the next turn through the event loop.
		 *
		 * @param deferred
		 * A deferred that should be resolved using the value from `callback` as its resolved value.
		 *
		 * @param callback
		 * A callback that should be executed on the next turn through the event loop.
		 *
		 * @param fulfilledValue
		 * The fulfilled value to pass to the callback.
		 */
		function execute(deferred:Promise.Deferred<any>, callback:(value?:any) => any, fulfilledValue:any):void {
			enqueue(function ():void {
				if (callback) {
					try {
						var returnValue:any = callback(fulfilledValue);
						if (returnValue && returnValue.then) {
							deferred.promise.abort = returnValue.abort;
							returnValue.then(deferred.resolve, deferred.reject, deferred.progress);
						}
						else {
							deferred.resolve(returnValue);
						}
					}
					catch (error) {
						deferred.reject(error);
					}
				}
				else if (state === Promise.State.REJECTED) {
					deferred.reject(fulfilledValue);
				}
				else {
					deferred.resolve(fulfilledValue);
				}
			});
		}

		/**
		 * Fulfills this promise.
		 *
		 * @param newState The fulfilled state for this promise.
		 * @param callbacks The callbacks that should be executed for the new state.
		 * @param {T|Error} value The fulfilled value for this promise.
		 */
		function fulfill(newState:Promise.State, callbacks:ICallback<any, any>[], value:any):void {
			if (state !== Promise.State.PENDING) {
				if (has('debug')) {
					throw new Error('Attempted to fulfill an already fulfilled promise');
				}

				return;
			}

			state = newState;
			fulfilledValue = value;
			resolveCallbacks = rejectCallbacks = progressCallbacks = null;

			for (var i = 0, callback:ICallback<any, any>; (callback = callbacks[i]); ++i) {
				execute(callback.deferred, callback.callback, fulfilledValue);
			}
		}

		/**
		 * Registers an aborter for the promise.
		 *
		 * @param aborter The aborter for the promise.
		 */
		var abort:(reason?:Error) => void;
		var setAborter = (aborter:Promise.IAborter<T>):void => {
			abort = (reason?:Error):void => {
				if (state !== Promise.State.PENDING) {
					if (has('debug')) {
						throw new Error('Attempted to abort an already fulfilled promise');
					}

					return;
				}

				if (!reason) {
					reason = new Error('Aborted');
					reason.name = 'AbortError';
				}

				execute({
					resolve: fulfill.bind(null, Promise.State.RESOLVED, resolveCallbacks),
					reject: fulfill.bind(null, Promise.State.REJECTED, rejectCallbacks),
					progress: sendProgress,
					promise: this
				}, aborter, reason);
			};
		};

		/**
		 * Sends progress data from the asynchronous operation to any progress listeners.
		 *
		 * @param data Additional information about the asynchronous operation’s progress.
		 */
		function sendProgress(data?:any):void {
			if (state !== Promise.State.PENDING) {
				if (has('debug')) {
					throw new Error('Attempted to send progress data for an already fulfilled promise');
				}

				return;
			}

			progressCallbacks.forEach(function (callback:ICallback<any, void>):void {
				enqueue(function ():void {
					callback.callback && callback.callback(data);
					callback.deferred.progress(data);
				});
			});
		}

		Object.defineProperty(this, 'abort', {
			get: function ():(reason?:Error) => void {
				return abort;
			},
			set: function (value:(reason?:Error) => void):void {
				if (state !== Promise.State.PENDING) {
					if (has('debug')) {
						throw new Error('Attempted to change abort function on an already fulfilled promise');
					}

					return;
				}

				abort = value;

				// Until this promise is resolved, if its abort method changes, the abort method on all of the
				// child promises that have been created need to change as well
				for (var i = 0, callback:ICallback<T, any>; (callback = resolveCallbacks[i]); ++i) {
					callback.deferred.promise.abort = value;
				}
			}
		});

		Object.defineProperty(this, 'state', {
			get: function ():Promise.State {
				return state;
			}
		});

		this.then = function <U>(
			onResolved?:(value?:T) => any,
			onRejected?:(error?:Error) => any,
			onProgress?:(data?:any) => void
		):Promise<U> {
			var deferred:Promise.Deferred<U> = new Promise.Deferred();
			// This abort function will be replaced with one from the callback’s returned promise once the main promise
			// has resolved; we intentionally do not go through the normal aborter mechanics for this deferred because
			// when abort is called here, it should only try to abort the parent promise’s operation rather than reject
			// itself (since the parent can abort and then return a successful alternative value from its aborter)
			deferred.promise.abort = abort;

			if (state === Promise.State.PENDING) {
				resolveCallbacks.push({
					deferred: deferred,
					callback: onResolved
				});

				rejectCallbacks.push({
					deferred: deferred,
					callback: onRejected
				});

				progressCallbacks.push({
					deferred: deferred,
					callback: onProgress
				});
			}
			else if (state === Promise.State.RESOLVED) {
				execute(deferred, onResolved, fulfilledValue);
			}
			else if (state === Promise.State.REJECTED) {
				execute(deferred, onRejected, fulfilledValue);
			}

			return deferred.promise;
		};

		try {
			initializer(
				fulfill.bind(null, Promise.State.RESOLVED, resolveCallbacks),
				fulfill.bind(null, Promise.State.REJECTED, rejectCallbacks),
				sendProgress,
				setAborter
			);
		}
		catch (error) {
			fulfill(Promise.State.REJECTED, rejectCallbacks, error);
		}
	}

	/**
	 * Aborts the underlying asynchronous operation, if possible.
	 *
	 * @method
	 */
	abort:(reason?:Error) => void;

	/**
	 * The current state of the promise.
	 *
	 * @readonly
	 */
	state:Promise.State;

	/**
	 * Adds a callback to the promise to be invoked when the asynchronous operation throws an error.
	 */
	catch<U>(onRejected:(error?:Error) => U):Promise<U>;
	catch<U>(onRejected:(error?:Error) => Promise<U>):Promise<U>;
	catch<U>(onRejected:(error?:Error) => any):Promise<U> {
		return this.then<U>(null, onRejected);
	}

	/**
	 * Adds a callback to the promise to be invoked regardless of whether or not the asynchronous operation completed
	 * successfully.
	 */
	finally<U>(onResolvedOfRejected:(value?:any) => U):Promise<U>;
	finally<U>(onResolvedOrRejected:(value?:any) => Promise<U>):Promise<U>;
	finally<U>(onResolvedOrRejected:(value?:any) => any):Promise<U> {
		return this.then<U>(onResolvedOrRejected, onResolvedOrRejected);
	}

	/**
	 * Adds a callback to the promise to be invoked when the asynchronous operation completes successfully.
	 */
	then:{
		<U>(onResolved?:(value?:T) => U,          onRejected?:(error?:Error) => U,          onProgress?:(data?:any) => void):Promise<U>;
		<U>(onResolved?:(value?:T) => U,          onRejected?:(error?:Error) => Promise<U>, onProgress?:(data?:any) => void):Promise<U>;
		<U>(onResolved?:(value?:T) => Promise<U>, onRejected?:(error?:Error) => U,          onProgress?:(data?:any) => void):Promise<U>;
		<U>(onResolved?:(value?:T) => Promise<U>, onRejected?:(error?:Error) => Promise<U>, onProgress?:(data?:any) => void):Promise<U>;
	};
}

module Promise {
	export interface IAborter<T> {
		(reason:Error):T;
	}

	/**
	 * The Deferred class unwraps a promise in order to expose its internal state management functions.
	 */
	export class Deferred<T> {
		/**
		 * The underlying promise for the Deferred.
		 */
		promise:Promise<T>;

		constructor(aborter?:Promise.IAborter<T>) {
			this.promise = new Promise<T>((
				resolve:(value?:any) => void,
				reject:(error?:any) => void,
				progress:(data?:any) => void,
				setAborter:(aborter:Promise.IAborter<T>) => void
			):void => {
				this.progress = progress;
				this.reject = reject;
				this.resolve = resolve;
				aborter && setAborter(aborter);
			});
		}

		/**
		 * Sends progress information for the underlying promise.
		 *
		 * @method
		 * @param data Additional information about the asynchronous operation’s progress.
		 */
		progress:(data?:any) => void;

		/**
		 * Rejects the underlying promise with an error.
		 *
		 * @method
		 * @param error The error that should be used as the fulfilled value for the promise.
		 */
		reject:(error?:Error) => void;

		/**
		 * Resolves the underlying promise with a value.
		 *
		 * @method
		 * @param value The value that should be used as the fulfilled value for the promise.
		 */
		resolve:(value?:T) => void;
	}

	/**
	 * The State enum represents the possible states of a promise.
	 */
	export enum State {
		PENDING,
		RESOLVED,
		REJECTED
	}
}

export = Promise;
