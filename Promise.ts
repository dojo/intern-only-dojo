import nextTick = require('./nextTick');

function isPromise(value:any):boolean {
	return value && typeof value.then === 'function';
}

function runCallbacks(callbacks:Array<(...args:any[]) => void>, ...args:any[]):void {
	for (var i = 0, callback:(...args:any[]) => void; callback = callbacks[i]; ++i) {
		callback.apply(null, args);
	}
}

/**
 * The Deferred class unwraps a promise in order to expose its internal state management functions.
 */
class Deferred<T> {
	/**
	 * The underlying promise for the Deferred.
	 */
	promise:Promise<T>;

	constructor(canceler?:Promise.ICanceler) {
		this.promise = new Promise<T>((
			resolve:(value?:T) => void,
			reject:(error?:Error) => void,
			progress:(data?:any) => void,
			setCanceler:(canceler:Promise.ICanceler) => void
		):void => {
			this.progress = progress;
			this.reject = reject;
			this.resolve = resolve;
			canceler && setCanceler(canceler);
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
 * A Promise represents the result of an asynchronous operation. When writing a function that performs an asynchronous
 * operation, instead of writing the function to accept a callback function, you should instead write it to return a
 * Promise that is fulfilled once the asynchronous operation is completed. Returning a promise instead of accepting
 * a callback provides a standard mechanism for handling asynchronous operations that offers the following benefits
 * over a normal callback function:
 *
 * 1. Multiple callbacks can be added for a single function invocation;
 * 2. Other asynchronous operations can be easily chained to the response, avoiding callback pyramids;
 * 3. Asynchronous operations can be canceled in flight in a standard way if their results are no longer needed by the
 *    rest of the application.
 *
 * The Promise class is a modified, extended version of standard EcmaScript 6 promises. This implementation
 * intentionally deviates from the ES6 2014-05-22 draft in the following ways:
 *
 * 1. `Promise.race` is a worthless API with one use case, so is not implemented.
 * 2. `Promise.all` accepts an object in addition to an array.
 * 3. Asynchronous operations can transmit partial progress information through a third `progress` method passed to the
 *    initializer. Progress listeners can be added by passing a third `onProgress` callback to `then`, or through the
 *    extra `progress` method exposed on promises.
 * 4. Promises can be canceled by calling the `cancel` method of a promise.
 */
class Promise<T> {
	/**
	 * Converts an iterable object containing promises into a single promise that resolves to a new iterable object
	 * containing all the fulfilled properties of the original object. Properties that do not contain promises are
	 * passed through as-is.
	 *
	 * @example
	 * Promise.all([ Promise.resolve('foo'), 'bar' ]).then(function (value) {
	 *   value[0] === 'foo'; // true
	 *   value[1] === 'bar'; // true
	 * });
	 *
	 * @example
	 * Promise.all({
	 *   foo: Promise.resolve('foo'),
	 *   bar: 'bar'
	 * }).then(function (value) {
	 *   value.foo === 'foo'; // true
	 *   value.bar === 'bar'; // true
	 * });
	 */
	static all<T>(iterable:{ [key:string]:Promise<T>; }):Promise<{ [key:string]:T; }>;
	static all<T>(iterable:Promise<T>[]):Promise<T[]>;
	static all(iterable:any):Promise<any> {
		// explicit typing fixes tsc 1.0.1 crash on `new this`
		return new (<typeof Promise> this)(function (
			resolve:(value:any) => void,
			reject:(error:Error) => void,
			progress:(data:any) => void,
			setCanceler:(canceler:(reason:Error) => any) => void
		):void {
			setCanceler(function (reason:Error):void {
				walkIterable(function (key:string, value:any):void {
					if (value && value.cancel) {
						value.cancel(reason);
					}
				});

				return values;
			});

			function fulfill(key:string, value:any):void {
				values[key] = value;
				progress(values);
				++complete;
				finish();
			}

			function finish():void {
				if (populating || complete < total) {
					return;
				}

				resolve(values);
			}

			function processItem(key:string, value:any):void {
				++total;
				if (isPromise(value)) {
					value.then(fulfill.bind(null, key), fulfill.bind(null, key));
				}
				else {
					fulfill(key, value);
				}
			}

			function walkIterable(callback:(key:string, value:any) => void):void {
				if (Array.isArray(iterable)) {
					for (var i = 0, j = iterable.length; i < j; ++i) {
						if (i in iterable) {
							callback(String(i), iterable[i]);
						}
					}
				}
				else {
					for (var key in iterable) {
						callback(key, iterable[key]);
					}
				}
			}

			var values:any = Array.isArray(iterable) ? [] : {};
			var complete:number = 0;
			var total:number = 0;

			var populating:boolean = true;
			walkIterable(processItem);
			populating = false;
			finish();
		});
	}

	/**
	 * Creates a new promise that is pre-rejected with the given error.
	 */
	static reject<T>(error?:Error):Promise<T> {
		return new this(function (resolve:(value:T) => void, reject:(error:Error) => void):void {
			reject(error);
		});
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

		return new this(function (resolve:(value:T) => void):void {
			resolve(value);
		});
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
	 * successfully, or the `reject` function when the operation fails, unless the the `canceler` is called first.
	 *
	 * The `progress` function can also be called zero or more times to provide information about the process of the
	 * operation to any interested consumers.
	 *
	 * Finally, the initializer can register an canceler function that cancels the asynchronous operation by passing
	 * the canceler function to the `setCanceler` function.
	 */
	constructor(
		initializer:(
			resolve?:(value?:T) => void,
			reject?:(error?:Error) => void,
			progress?:(data?:any) => void,
			setCanceler?:(canceler:Promise.ICanceler) => void
		) => void
	) {
		/**
		 * The current state of this promise.
		 */
		var state:Promise.State = Promise.State.PENDING;
		Object.defineProperty(this, 'state', {
			get: function ():Promise.State {
				return state;
			}
		});

		/**
		 * Whether or not this promise is in a resolved state.
		 */
		function isResolved():boolean {
			return state !== Promise.State.PENDING || isChained;
		}

		/**
		 * If true, the resolution of this promise is chained to another promise.
		 */
		var isChained:boolean = false;

		/**
		 * The resolved value for this promise.
		 *
		 * @type {T|Error}
		 */
		var resolvedValue:any;

		/**
		 * Callbacks that should be invoked once the asynchronous operation has completed.
		 */
		var callbacks:Array<() => void> = [];
		var whenFinished = function (callback:() => void):void {
			callbacks.push(callback);
		};

		/**
		 * Callbacks that should be invoked when the asynchronous operation has progressed.
		 */
		var progressCallbacks:Array<(data?:any) => void> = [];
		var whenProgress = function (callback:(data?:any) => void):void {
			progressCallbacks.push(callback);
		};

		/**
		 * A canceler function that will be used to cancel resolution of this promise.
		 */
		var canceler:Promise.ICanceler;

		/**
		 * Queues a callback for execution during the next round through the event loop, in a way such that if a
		 * new execution is queued for this promise during queue processing, it will execute immediately instead of
		 * being forced to wait through another turn through the event loop.
		 * TODO: Ensure this is actually necessary for optimal execution and does not break next-turn spec compliance.
		 *
		 * @method
		 * @param callback The callback to execute on the next turn through the event loop.
		 */
		var enqueue:(callback:(...args:any[]) => any) => void = (function () {
			function originalSchedule():void {
				schedule = function ():void {};

				nextTick(function run():void {
					try {
						var callback:(...args:any[]) => void;
						while ((callback = queue.shift())) {
							callback();
						}
					}
					finally {
						// If someone threw an error, allow it to bubble, then continue queue execution for the
						// remaining items
						if (queue.length) {
							run();
						}
						else {
							schedule = originalSchedule;
						}
					}
				});
			}

			var queue:Array<(...args:any[]) => void> = [];
			var schedule = originalSchedule;

			return function (callback:(...args:any[]) => void):void {
				queue.push(callback);
				schedule();
			};
		})();

		/**
		 * Resolves this promise.
		 *
		 * @param newState The resolved state for this promise.
		 * @param {T|Error} value The resolved value for this promise.
		 */
		var resolve = function (newState:Promise.State, value:any):void {
			if (isResolved()) {
				return;
			}

			if (isPromise(value)) {
				if (value === this) {
					throw new TypeError('Cannot chain a promise to itself');
				}

				isChained = true;
				value.then(
					settle.bind(null, Promise.State.FULFILLED),
					settle.bind(null, Promise.State.REJECTED)
				);

				this.cancel = value.cancel;
			}
			else {
				settle(newState, value);
			}
		}.bind(this);

		/**
		 * Settles this promise.
		 *
		 * @param newState The resolved state for this promise.
		 * @param {T|Error} value The resolved value for this promise.
		 */
		function settle(newState:Promise.State, value:any):void {
			state = newState;
			resolvedValue = value;
			whenFinished = enqueue;
			whenProgress = function ():void {};
			enqueue(function ():void {
				runCallbacks(callbacks);
				callbacks = progressCallbacks = null;
			});
		}

		this.cancel = function (reason?:Error):void {
			if (isResolved() || !canceler) {
				return;
			}

			if (!reason) {
				reason = new Error();
				reason.name = 'CancelError';
			}

			try {
				resolve(Promise.State.FULFILLED, canceler(reason));
			}
			catch (error) {
				settle(Promise.State.REJECTED, error);
			}
		};

		this.then = function <U>(
			onFulfilled?:(value?:T) => U,
			onRejected?:(error?:Error) => U,
			onProgress?:(data?:any) => any
		):Promise<U> {
			return new Promise<U>(function (
				resolve:(value?:U) => void,
				reject:(error?:Error) => void,
				progress:(data?:any) => void,
				setCanceler:(canceler:Promise.ICanceler) => void
			):void {
				setCanceler(function (reason:Error):void {
					if (canceler) {
						resolve(canceler(reason));
						return;
					}

					throw reason;
				});

				whenProgress(function (data?:any):void {
					try {
						if (typeof onProgress === 'function') {
							progress(onProgress(data));
						}
						else {
							progress(data);
						}
					}
					catch (error) {
						if (error.name !== 'StopProgressPropagation') {
							throw error;
						}
					}
				});

				whenFinished(function ():void {
					var callback:(value?:any) => any = state === Promise.State.REJECTED ? onRejected : onFulfilled;

					if (typeof callback === 'function') {
						try {
							resolve(callback(resolvedValue));
						}
						catch (error) {
							reject(error);
						}
					}
					else if (state === Promise.State.REJECTED) {
						reject(resolvedValue);
					}
					else {
						resolve(resolvedValue);
					}
				});
			});
		};

		try {
			initializer(
				resolve.bind(null, Promise.State.FULFILLED),
				resolve.bind(null, Promise.State.REJECTED),
				function (data?:any):void {
					enqueue(runCallbacks.bind(null, progressCallbacks, data));
				},
				function (value:Promise.ICanceler):void {
					canceler = value;
				}
			);
		}
		catch (error) {
			settle(Promise.State.REJECTED, error);
		}
	}

	/**
	 * The current state of the promise.
	 *
	 * @readonly
	 */
	state:Promise.State;

	/**
	 * Cancels any pending asynchronous operation of the promise.
	 *
	 * @method
	 * @param reason
	 * A specific reason for failing the operation. If no reason is provided, a default `CancelError` error will be
	 * used.
	 */
	cancel:(reason?:Error, source?:Promise<any>) => void;

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
	finally<U>(onFulfilledOrRejected:(value?:any) => U):Promise<U>;
	finally<U>(onFulfilledOrRejected:(value?:any) => Promise<U>):Promise<U>;
	finally<U>(onFulfilledOrRejected:(value?:any) => any):Promise<U> {
		return this.then<U>(onFulfilledOrRejected, onFulfilledOrRejected);
	}

	/**
	 * Adds a callback to the promise to be invoked when progress occurs within the asynchronous operation.
	 */
	progress(onProgress:(data?:any) => any):Promise<T> {
		return this.then<T>(null, null, onProgress);
	}

	/**
	 * Adds a callback to the promise to be invoked when the asynchronous operation completes successfully.
	 */
	then:{
		<U>(onFulfilled?:(value?:T) => U,          onRejected?:(error?:Error) => U,          onProgress?:(data?:any) => any):Promise<U>;
		<U>(onFulfilled?:(value?:T) => U,          onRejected?:(error?:Error) => Promise<U>, onProgress?:(data?:any) => any):Promise<U>;
		<U>(onFulfilled?:(value?:T) => Promise<U>, onRejected?:(error?:Error) => U,          onProgress?:(data?:any) => any):Promise<U>;
		<U>(onFulfilled?:(value?:T) => Promise<U>, onRejected?:(error?:Error) => Promise<U>, onProgress?:(data?:any) => any):Promise<U>;
	};

	// workaround for TS#2557
	static Deferred:typeof Deferred = Deferred;
}

module Promise {
	export interface ICanceler {
		(reason:Error):any;
	}

	// workaround for TS#2557
	export interface Deferred<T> {
		/**
		 * The underlying promise for the Deferred.
		 */
		promise:Promise<T>;

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
		 * @param error The error that should be used as the resolved value for the promise.
		 */
		reject:(error?:Error) => void;

		/**
		 * Resolves the underlying promise with a value.
		 *
		 * @method
		 * @param value The value that should be used as the resolved value for the promise.
		 */
		resolve:(value?:T) => void;
	}

	/**
	 * The State enum represents the possible states of a promise.
	 */
	export enum State {
		PENDING,
		FULFILLED,
		REJECTED
	}
}

export = Promise;
