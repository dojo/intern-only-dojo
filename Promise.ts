import has = require('./has');
import nextTick = require('./nextTick');

interface ICallback<T> {
	callback:<U>(value?:T) => U;
	deferred:Deferred<any>;
}

interface IProgressCallback<T> {
	callback:(data?:T) => void;
	deferred:Deferred<any>;
}

class Deferred<T> {
	promise:Promise<T>;

	constructor(aborter?:(error?:Error) => void) {
		this.promise = new Promise<T>((resolve:(value?:any) => void, reject:(error?:any) => void, progress:(data?:any) => void):void => {
			this.progress = progress;
			this.reject = reject;
			this.resolve = resolve;
		}, aborter);
	}

	progress:(data?:any) => void;
	reject:(error?:any) => void;
	resolve:(value?:any) => void;
}

class Promise<T> {
	/* tslint:disable:variable-name */
	static Deferred:typeof Deferred = Deferred;
	/* tslint:enable:variable-name */

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
		var deferred:Deferred<typeof values> = new Deferred();
		var complete:number = 0;
		var total:number = 0;
		var populating:boolean = true;

		if (Array.isArray(iterable)) {
			for (var i = 0; i < iterable.length; i++) {
				processItem(i);
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

	static reject<T>(reason:any):Promise<T> {
		var deferred = new Deferred();
		deferred.reject(reason);
		return deferred.promise;
	}

	static resolve<T>(value:Promise<T>):Promise<T>;
	static resolve<T>(value:T):Promise<T>;
	static resolve<T>(value:any):Promise<T> {
		if (value instanceof Promise) {
			return value;
		}

		var deferred = new Deferred();
		deferred.resolve(value);
		return deferred.promise;
	}

	constructor(
		initializer:(resolve?:(value?:T) => void, reject?:(error?:Error) => void, progress?:(data?:any) => void) => void,
		aborter?:(error?:Error) => void
	) {
		var _state:Promise.State = Promise.State.PENDING;
		var fulfilledValue:T;
		var resolveCallbacks:ICallback<T>[] = [];
		var rejectCallbacks:ICallback<Error>[] = [];
		var progressCallbacks:IProgressCallback<any>[] = [];

		function execute(deferred:Deferred<any>, callback:(value?:any) => any, fulfilledValue:T):void {
			nextTick(function ():void {
				// handle the case where this promise was fulfilled before nextTick
				if (deferred.promise.state !== Promise.State.PENDING) {
					return;
				}

				try {
					var returnValue:any = callback(fulfilledValue);
					if (returnValue && returnValue.then) {
						returnValue.then(deferred.resolve, deferred.reject, deferred.progress);
					}
					else {
						deferred.resolve(returnValue);
					}
				}
				catch (error) {
					deferred.reject(error);
				}
			});
		}

		function propagate(deferred:Deferred<any>, newState:Promise.State, valueErrorOrData:T):void {
			switch (newState) {
				case Promise.State.RESOLVED:
					deferred.resolve(valueErrorOrData);
					break;
				case Promise.State.REJECTED:
					deferred.reject(valueErrorOrData);
					break;
				default:
					deferred.progress(valueErrorOrData);
			}
		}

		function fulfill(newState:Promise.State, callbacks:ICallback<any>[], value:any):void {
			if (_state !== Promise.State.PENDING) {
				if (has('debug')) {
					console.warn('Attempted to fulfill an already fulfilled promise');
					throw new Error('Attempted to fulfill an already fulfilled promise');
				}

				return;
			}

			_state = newState;
			fulfilledValue = value;

			for (var i = 0, callback:ICallback<any>; (callback = callbacks[i]); ++i) {
				if (callback.callback) {
					execute(callback.deferred, callback.callback, fulfilledValue);
				}
				else {
					propagate(callback.deferred, _state, fulfilledValue);
				}
			}
		}

		// implement the read-only state property
		Object.defineProperty(this, 'state', {
			get: function ():Promise.State {
				return _state;
			}
		});

		this.abort = function (reason?:Error):void {
			if (!aborter) {
				throw new Error('Promise is not abortable');
			}

			if (!reason) {
				reason = new Error('Aborted');
				reason.name = 'AbortError';
			}

			if (_state !== Promise.State.PENDING) {
				// call the aborter for the most distant non-settled ancestor
				aborter(reason);
				return;
			}

			try {
				aborter(reason);

				if (_state === Promise.State.PENDING) {
					fulfill(Promise.State.RESOLVED, resolveCallbacks, reason);
				}
			}
			catch (error) {
				if (_state === Promise.State.PENDING) {
					fulfill(Promise.State.REJECTED, rejectCallbacks, error);
				}
			}
		};

		this.then = function <U>(onResolved?:(value?:T) => any, onRejected?:(error?:Error) => any, onProgress?:(data?:any) => void):Promise<U> {
			var self = this;
			var deferred:Deferred<U> = new Deferred(function (reason?:Error):void {
				return aborter && self.abort(reason);
			});

			if (_state === Promise.State.PENDING) {
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
			else if (_state === Promise.State.RESOLVED && onResolved) {
				execute(deferred, onResolved, fulfilledValue);
			}
			else if (_state === Promise.State.REJECTED && onRejected) {
				execute(deferred, onRejected, fulfilledValue);
			} else {
				// handle the case where this promise is resolved but ony has a rejection handler,
				// or vice versa
				propagate(deferred, _state, fulfilledValue);
			}

			return deferred.promise;
		};

		try {
			initializer(
				fulfill.bind(null, Promise.State.RESOLVED, resolveCallbacks),
				fulfill.bind(null, Promise.State.REJECTED, rejectCallbacks),
				function (data?:any):void {
					progressCallbacks.forEach(function (callback:IProgressCallback<any>):void {
						if (callback.callback) {
							nextTick(function ():void {
								callback.callback(data);
							});
						}
						else {
							nextTick(function ():void {
								callback.deferred.progress(data);
							});
						}
					});
				}
			);
		}
		catch (error) {
			fulfill(Promise.State.REJECTED, rejectCallbacks, error);
		}
	}

	abort:(reason?:Error) => void;

	state:Promise.State;

	catch<U>(onRejected:(error?:Error) => U):Promise<U>;
	catch<U>(onRejected:(error?:Error) => Promise<U>):Promise<U>;
	catch<U>(onRejected:(error?:Error) => any):Promise<U> {
		return this.then<U>(null, onRejected);
	}

	finally<U>(onResolvedOfRejected:(value?:any) => U):Promise<U>;
	finally<U>(onResolvedOrRejected:(value?:any) => Promise<U>):Promise<U>;
	finally<U>(onResolvedOrRejected:(value?:any) => any):Promise<U> {
		return this.then<U>(onResolvedOrRejected, onResolvedOrRejected);
	}

	then:{
		<U>(onResolved?:(value?:T) => U,          onRejected?:(error?:Error) => U,          onProgress?:(data?:any) => void):Promise<U>;
		<U>(onResolved?:(value?:T) => U,          onRejected?:(error?:Error) => Promise<U>, onProgress?:(data?:any) => void):Promise<U>;
		<U>(onResolved?:(value?:T) => Promise<U>, onRejected?:(error?:Error) => U,          onProgress?:(data?:any) => void):Promise<U>;
		<U>(onResolved?:(value?:T) => Promise<U>, onRejected?:(error?:Error) => Promise<U>, onProgress?:(data?:any) => void):Promise<U>;
	};
}

module Promise {
	export enum State {
		PENDING,
		RESOLVED,
		REJECTED
	}
}

export = Promise;
