/// <reference path="../intern.d.ts" />

import assert = require('intern/chai!assert');
import core = require('../../interfaces');
import Promise = require('../../Promise');
import registerSuite = require('intern!object');

class MyPromise<T> extends Promise<T> {
	catch<U>(onRejected:(reason:any)=>U):MyPromise<U>;
	catch<U>(onRejected:(reason:any)=>core.IPromise<U>):MyPromise<U>;
	catch<U>(onRejected:(reason:any)=>any):MyPromise<U> {
		return this.then<U>(undefined, onRejected);
	}

	then<U>(onFulfilled?:(value:T)=>U, onRejected?:(reason:any)=>U):MyPromise<U>;
	then<U>(onFulfilled?:(value:T)=>U, onRejected?:(reason:any)=>core.IPromise<U>):MyPromise<U>;
	then<U>(onFulfilled?:(value:T)=>core.IPromise<U>, onRejected?:(reason:any)=>U):MyPromise<U>;
	then<U>(onFulfilled?:(value:T)=>core.IPromise<U>, onRejected?:(reason:any)=>core.IPromise<U>):MyPromise<U>;
	then<U>(onFulfilled?:(value:T)=>any, onRejected?:(reason:any)=>any):MyPromise<U> {
		throw new Error('"then" has not been implemented');
	}
}

MyPromise.resolve = Promise.resolve;
MyPromise.cast = Promise.cast;

registerSuite({
	name: 'Promise',

	'#then': {
		'fulfillment': function () {
			var dfd = this.async();

			Promise.resolve(5).then(dfd.callback((value:number) => {
				assert.strictEqual(value, 5);
			}));
		},

		'identity': function () {
			var dfd = this.async();

			Promise.resolve(5).then(null, dfd.rejectOnError((value:Error) => {
				assert(false, 'Should not have resolved');
			})).then(dfd.callback((value:number) => {
				assert.strictEqual(value, 5);
			}));
		},

		'resolve once': function () {
			var dfd = this.async(),
				evilPromise = {
					then: function (f?:Function, r?:Function) {
						f(1);
						f(2);
					}
				};

			var calledAlready = false;
			Promise.resolve<any>(evilPromise).then(dfd.rejectOnError((value:number) => {
				assert.strictEqual(calledAlready, false);
				calledAlready = true;
				assert.strictEqual(value, 1);
			})).then(dfd.resolve, dfd.reject);
		},

		'self-resolution': function () {
			var dfd = this.async(),
				resolve:core.IPromiseFunction<void>,
				promise = new Promise<void>(function (_resolve) {
					resolve = _resolve;
				});

			resolve(promise);

			promise.then(
				dfd.rejectOnError(function () {
					assert(false, 'Should not be resolved');
				}),
				dfd.callback(function (error:Error) {
					assert.instanceOf(error, TypeError);
				})
			);
		}
	},

	'#catch': {
		'rejection': function () {
			var dfd = this.async();

			var error = new Error('foo');
			Promise.reject(error).catch(dfd.callback(function (err:Error) {
				assert.strictEqual(err, error);
			}));
		},

		'identity': function () {
			var dfd = this.async();

			var error = new Error('foo');
			Promise.reject(error).then(dfd.rejectOnError(() => {
				assert(false, 'Should not be resolved');
			})).catch(dfd.callback((err:Error) => {
				assert.strictEqual(err, error);
			}));
		},

		'resolver throws': function () {
			var dfd = this.async();

			var error = new Error('foo');
			var promise = new Promise(function () {
				throw error;
			});

			promise.catch(dfd.callback((err:Error) => {
				assert.strictEqual(err, error);
			}));
		},

		'handler throws': function () {
			var dfd = this.async();

			var error = new Error('foo');
			Promise.resolve(5).then(() => {
				throw error;
			}).catch(dfd.callback((err:Error) => {
					assert.strictEqual(err, error);
			}));
		},

		'then throws': {
			'from resolver': function () {
				var dfd = this.async(),
					error = new Error('foo'),
					foreign:core.IPromise<void> = <any>{
						then: function (f:Function) {
							throw error;
						}
					};

				var promise = new Promise((resolve) => {
					resolve(foreign);
				});
				promise.catch(dfd.callback((err:Error) => {
					assert.strictEqual(err, error);
				}));
			},
			'from handler': function () {
				var dfd = this.async(),
					error = new Error('foo'),
					foreign:core.IPromise<void> = <any>{
						then: function (f:Function) {
							throw error;
						}
					};

				Promise.resolve(5).then(() => {
					return foreign;
				}).catch(dfd.callback((err:Error) => {
					assert.strictEqual(err, error);
				}));
			}
		}
	},

	'.cast': {
		'value': function () {
			var dfd = this.async();

			var promise = Promise.cast(5);

			promise.then(dfd.callback((value:number) => {
				assert.instanceOf(promise, Promise);
				assert.strictEqual(value, 5);
			}));
		},

		'promise': function () {
			var dfd = this.async(),
				promise = Promise.resolve(5);

			var casted = Promise.cast(promise);

			promise.then(dfd.callback((value:number) => {
				assert.strictEqual(casted, promise);
				assert.strictEqual(value, 5);
			}));
		},

		'inherited promise': function () {
			var dfd = this.async(),
				promise = MyPromise.resolve(5);

			var casted = Promise.cast(promise);

			promise.then(dfd.callback((value:number) => {
				assert.notStrictEqual(casted, promise);
				assert.strictEqual(value, 5);
			}));
		},

		'generic': function () {
			var dfd = this.async(),
				promise = MyPromise.resolve(5);

			var casted = MyPromise.cast(promise);

			promise.then(dfd.callback((value:number) => {
				assert.instanceOf(casted, MyPromise);
				assert.strictEqual(casted, promise);
				assert.strictEqual(value, 5);
			}));
		}
	},

	'.all': {
		'empty array': function () {
			var dfd = this.async();
			Promise.all([]).then(dfd.callback((value:any[]) => {
				assert.isArray(value);
				assert.deepEqual(value, []);
			}));
		},

		'mixed values and resolved': function () {
			var dfd = this.async();

			Promise.all([0, Promise.resolve(1), Promise.resolve(2)]).then(
				dfd.callback((value:number[]) => {
					assert.isArray(value);
					assert.deepEqual(value, [0, 1, 2]);
				})
			)
		},

		'reject if any rejected': function () {
			var dfd = this.async(),
				pending = new Promise<void>(function () {}),
				rejected = Promise.reject(new Error('rejected'));

			Promise.all([pending, rejected]).then(
				dfd.rejectOnError(() => {
					assert(false, 'Should not have resolved');
				}),
				dfd.callback((error:Error) => {
					assert.strictEqual(error.message, 'rejected');
				})
			);
		},

		'foreign thenables': function () {
			var dfd = this.async(),
				normal = Promise.resolve(1),
				foreign:core.IPromise<void> = <any>{
					then: function (f:Function) {
						f(2);
					}
				};

			Promise.all([normal, foreign]).then(dfd.callback((value:number[]) => {
				assert.deepEqual(value, [1, 2]);
			}));
		},

		'sparse array': function () {
			var dfd = this.async(),
				iterable:any[] = [];

			iterable[0] = Promise.resolve(0);
			iterable[3] = Promise.resolve(3);

			Promise.all(iterable).then(dfd.callback((value:number[]) => {
				var test:number[] = [0, 3];
				assert.deepEqual(value, test);
			}));
		},

		'value not input': function () {
			var dfd = this.async(),
				iterable = [0, 1];

			Promise.all(iterable).then(dfd.callback((value:number[]) => {
				assert.notStrictEqual(value, iterable);
			}));
		},

		'reject for non-iterable': function () {
			var dfd = this.async(),
				nonIterable = {};

			Promise.all(nonIterable).then(
				dfd.rejectOnError(() => {
					assert(false, 'Should not have resolved');
				}),
				dfd.callback((reason:Error) => {
					assert.instanceOf(reason, TypeError);
				})
			);
		}
	}
});
