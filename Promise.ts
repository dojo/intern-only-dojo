import has = require('./has');
import nextTick = require('./nextTick');

interface ICallback<T, U> {
	callback:(value?:T) => U;
	deferred:Promise.Deferred<U>;
	originalCancel?:(reason?:any) => void;
}

interface IRecanceler {
	source:Promise<any>;
	reason:Error;
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
 * intentionally from the 2014-05-22 draft in the following ways:
 *
 * 1. The internal mechanics use the term “fulfilled” to mean that the asynchronous operation is no longer in progress.
 *    The term “resolved” means that the operation completed successfully.
 * 2. `Promise.race` is a worthless API with one use case, so is not implemented.
 * 3. `Promise.all` accepts an object in addition to an array.
 * 4. Asynchronous operations can transmit partial progress information through a third `progress` method passed to the
 *    initializer. Progress listeners can be added by passing a third `onProgress` callback to `then`, or through the
 *    extra `progress` method exposed on promises.
 * 5. Promises can be canceled
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
				if (value && value.then) {
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
				nextTick(callback); return;
				queue.push(callback);
				schedule();
			};
		})();

		/**
		 * Immediately resolves a deferred using the value from a callback.
		 *
		 * @param deferred
		 * The deferred that should be resolved using the value from `callback` as its resolved value.
		 *
		 * @param callback
		 * The callback that should be executed to get the new value. If the new value is a promise, resolution of the
		 * deferred is deferred until the promise is fulfilled.
		 *
		 * @param fulfilledValue
		 * The value to pass to the callback.
		 */
		function execute(deferred:Promise.Deferred<any>, callback:(value?:any) => any, fulfilledValue:any):void {
			if (callback) {
				try {
					var returnValue:any = callback(fulfilledValue);
					if (returnValue && returnValue.then) {
						returnValue.then(deferred.resolve, deferred.reject, deferred.progress);
						deferred.promise.cancel = returnValue.cancel;
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

			var recanceler:IRecanceler;
			while ((recanceler = recancelers.shift())) {
				recanceler.source.cancel(recanceler.reason);
			}
		}

		/**
		 * Immediately resolves a deferred using the value from a callback.
		 *
		 * @param deferred
		 * The deferred that should be resolved using the value from `callback` as its resolved value.
		 *
		 * @param callback
		 * The callback that should be executed to get the new value. If the new value is a promise, resolution of the
		 * deferred is deferred until the promise is fulfilled.
		 *
		 * @param fulfilledValue
		 * The value to pass to the callback.
		 */
		function scheduleExecute(deferred:Promise.Deferred<any>, callback:(value?:any) => any, fulfilledValue:any):void {
			var args:IArguments = arguments;
			enqueue(function ():void {
				execute.apply(null, args);
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
				callback.deferred.promise.cancel = callback.originalCancel;
				scheduleExecute(callback.deferred, callback.callback, fulfilledValue);
			}
		}

		/**
		 * The canceler for this promise. The default canceler simply causes the promise to reject with the
		 * cancelation reason; promises representing asynchronous operations that can be cancelled should provide their
		 * own cancellers.
		 */
		var canceler:Promise.ICanceler;

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

		Object.defineProperty(this, 'state', {
			get: function ():Promise.State {
				return state;
			}
		});

		var recancelers:IRecanceler[] = [];
		var self = this;
		this.cancel = function (reason?:Error, source?:Promise<any>):void {
			if (state !== Promise.State.PENDING || (!canceler && source !== self)) {
				// A consumer attempted to cancel the promise but it has already been fulfilled, so just ignore any
				// attempts to cancel it
				if (source === self) {
					// This is not an important error that should cause things to fail, but end-users should be informed
					// in case their code is misbehaving
					if (has('debug')) {
						console.debug('Attempted to cancel an already fulfilled promise');
					}
				}
				// A consumer attempted to cancel a child promise but while we have been fulfilled, the child callback
				// or one of its other parent callbacks has not been executed yet, so the cancellation came here. Wait
				// until we execute callbacks and modify the cancel function then reperform the cancellation
				else {
					recancelers.push({ source: source, reason: reason });
				}

				return;
			}

			if (!reason) {
				reason = new Error('Canceled');
				reason.name = 'CancelError';
			}

			if (!canceler) {
				throw new Error('Attempted to cancel an uncancelable promise');
			}

			try {
				fulfill(Promise.State.RESOLVED, resolveCallbacks, canceler(reason));
			}
			catch (error) {
				fulfill(Promise.State.REJECTED, rejectCallbacks, error);
			}
		};

		this.then = function <U>(
			onResolved?:(value?:T) => any,
			onRejected?:(error?:Error) => any,
			onProgress?:(data?:any) => void
		):Promise<U> {
			var deferred:Promise.Deferred<U> = new Promise.Deferred();
			var originalCancel = deferred.promise.cancel;
			deferred.promise.cancel = function (reason?:Error, source?:Promise<any>):void {
				self.cancel(reason, source || this);
			};

			if (state === Promise.State.PENDING) {
				resolveCallbacks.push({
					deferred: deferred,
					callback: onResolved,
					originalCancel: originalCancel
				});

				rejectCallbacks.push({
					deferred: deferred,
					callback: onRejected,
					originalCancel: originalCancel
				});

				progressCallbacks.push({
					deferred: deferred,
					callback: onProgress
				});
			}
			else if (state === Promise.State.RESOLVED) {
				scheduleExecute(deferred, onResolved, fulfilledValue);
			}
			else if (state === Promise.State.REJECTED) {
				scheduleExecute(deferred, onRejected, fulfilledValue);
			}
			else {
				throw new Error('Unknown state ' + Promise.State[state]);
			}

			return deferred.promise;
		};

		try {
			initializer(
				fulfill.bind(null, Promise.State.RESOLVED, resolveCallbacks),
				fulfill.bind(null, Promise.State.REJECTED, rejectCallbacks),
				sendProgress,
				function (value:Promise.ICanceler):void {
					canceler = value;
				}
			);
		}
		catch (error) {
			fulfill(Promise.State.REJECTED, rejectCallbacks, error);
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
	finally<U>(onResolvedOrRejected:(value?:any) => U):Promise<U>;
	finally<U>(onResolvedOrRejected:(value?:any) => Promise<U>):Promise<U>;
	finally<U>(onResolvedOrRejected:(value?:any) => any):Promise<U> {
		return this.then<U>(onResolvedOrRejected, onResolvedOrRejected);
	}

	/**
	 * Adds a callback to the promise to be invoked when progress occurs within the asynchronous operation.
	 */
	progress(onProgress:(data?:any) => void):Promise<T> {
		return this.then<T>(null, null, onProgress);
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
	export interface ICanceler {
		(reason:Error):any;
	}

	/**
	 * The Deferred class unwraps a promise in order to expose its internal state management functions.
	 */
	export class Deferred<T> {
		/**
		 * The underlying promise for the Deferred.
		 */
		promise:Promise<T>;

		constructor(canceler?:Promise.ICanceler) {
			this.promise = new Promise<T>((
				resolve:(value?:any) => void,
				reject:(error?:any) => void,
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
	 * The State enum represents the possible states of a promise.
	 */
	export enum State {
		PENDING,
		RESOLVED,
		REJECTED
	}
}

export = Promise;
