import assert = require('intern/chai!assert');
import Promise = require('src/Promise');
import registerSuite = require('intern!object');

class MyPromise<T> extends Promise<T> {
	catch<U>(onRejected: (reason: any) => U): MyPromise<U>;
	catch<U>(onRejected: (reason: any) => Promise<U>): MyPromise<U>;
	catch<U>(onRejected: (reason: any) => any): MyPromise<U> {
		return this.then<U>(undefined, onRejected);
	}

	then: {
		<U>(onFulfilled?: (value?: T) => U,          onRejected?: (error?: Error) => U,          onProgress?: (data?: any) => any): MyPromise<U>;
		<U>(onFulfilled?: (value?: T) => U,          onRejected?: (error?: Error) => Promise<U>, onProgress?: (data?: any) => any): MyPromise<U>;
		<U>(onFulfilled?: (value?: T) => Promise<U>, onRejected?: (error?: Error) => U,          onProgress?: (data?: any) => any): MyPromise<U>;
		<U>(onFulfilled?: (value?: T) => Promise<U>, onRejected?: (error?: Error) => Promise<U>, onProgress?: (data?: any) => any): MyPromise<U>;
	};
}

MyPromise.resolve = Promise.resolve;

registerSuite({
	name: 'Promise',

	'#then': {
		'fulfillment': function () {
			var dfd = this.async();

			Promise.resolve(5).then(dfd.callback((value: number) => {
				assert.strictEqual(value, 5);
			}));
		},

		'identity': function () {
			var dfd = this.async();

			Promise.resolve(5).then(null, dfd.rejectOnError((value: Error) => {
				assert(false, 'Should not have resolved');
			})).then(dfd.callback((value: number) => {
				assert.strictEqual(value, 5);
			}));
		},

		'resolve once': function () {
			var dfd = this.async();
			var evilPromise = <Promise.Thenable<number>> {
				then: function (f: (value: number) => any) {
					f(1);
					f(2);
				}
			};

			var calledAlready = false;
			Promise.resolve<any>(evilPromise).then(dfd.rejectOnError((value: number) => {
				assert.strictEqual(calledAlready, false);
				calledAlready = true;
				assert.strictEqual(value, 1);
			})).then(dfd.resolve, dfd.reject);
		},

		'self-resolution': function () {
			var dfd = this.async();
			var resolve: (value?: any) => void;
			var promise = new Promise<void>(function (_resolve: (value?: any) => void) {
				resolve = _resolve;
			});

			resolve(promise);

			promise.then(
				dfd.rejectOnError(function () {
					assert(false, 'Should not be resolved');
				}),
				dfd.callback(function (error: Error) {
					assert.instanceOf(error, TypeError);
				})
			);
		}
	},

	'#catch': {
		'rejection': function () {
			var dfd = this.async();

			var error = new Error('foo');
			Promise.reject(error).catch(dfd.callback(function (err: Error) {
				assert.strictEqual(err, error);
			}));
		},

		'identity': function () {
			var dfd = this.async();

			var error = new Error('foo');
			Promise.reject(error).then(dfd.rejectOnError(() => {
				assert(false, 'Should not be resolved');
			})).catch(dfd.callback((err: Error) => {
				assert.strictEqual(err, error);
			}));
		},

		'resolver throws': function () {
			var dfd = this.async();

			var error = new Error('foo');
			var promise = new Promise(function () {
				throw error;
			});

			promise.catch(dfd.callback((err: Error) => {
				assert.strictEqual(err, error);
			}));
		},

		'handler throws': function () {
			var dfd = this.async();

			var error = new Error('foo');
			Promise.resolve(5).then(() => {
				throw error;
			}).catch(dfd.callback((err: Error) => {
					assert.strictEqual(err, error);
			}));
		},

		'then throws': {
			'from resolver': function () {
				var dfd = this.async();
				var error = new Error('foo');
				var foreign = <Promise.Thenable<void>> {
						then: function () {
							throw error;
						}
					};

				var promise = new Promise((resolve: Function) => {
					resolve(foreign);
				});
				promise.catch(dfd.callback((err: Error) => {
					assert.strictEqual(err, error);
				}));
			},
			'from handler': function () {
				var dfd = this.async(),
					error = new Error('foo'),
					foreign = <Promise.Thenable<void>> {
						then: function () {
							throw error;
						}
					};

				Promise.resolve(5).then(() => {
					return foreign;
				}).catch(dfd.callback((err: Error) => {
					assert.strictEqual(err, error);
				}));
			}
		}
	},

	'.all': {
		'empty array': function () {
			var dfd = this.async();
			Promise.all([]).then(dfd.callback((value: any[]) => {
				assert.isArray(value);
				assert.deepEqual(value, []);
			}));
		},

		'mixed values and resolved': function () {
			var dfd = this.async();

			Promise.all([0, Promise.resolve(1), Promise.resolve(2)]).then(
				dfd.callback((value: number[]) => {
					assert.isArray(value);
					assert.deepEqual(value, [ 0, 1, 2 ]);
				})
			);
		},

		'reject if any rejected': function () {
			var dfd = this.async();
			var pending = new Promise<void>(function () {});
			var rejected = Promise.reject(new Error('rejected'));

			Promise.all([pending, rejected]).then(
				dfd.rejectOnError(() => {
					assert(false, 'Should not have resolved');
				}),
				dfd.callback((error: Error) => {
					assert.strictEqual(error.message, 'rejected');
				})
			);
		},

		'foreign thenables': function () {
			var dfd = this.async();
			var normal = Promise.resolve(1);
			var foreign = <Promise.Thenable<number>> {
				then: function (f: (value: number) => any) {
					f(2);
				}
			};

			Promise.all([ normal, foreign ]).then(dfd.callback((value: number[]) => {
				assert.deepEqual(value, [1, 2]);
			}));
		},

		'sparse array': function () {
			var dfd = this.async();
			var iterable: any[] = [];

			iterable[0] = Promise.resolve(0);
			iterable[3] = Promise.resolve(3);

			Promise.all(iterable).then(dfd.callback((value: number[]) => {
				var test: number[] = [ 0, , , 3 ];
				assert.deepEqual(value, test);
			}));
		},

		'value not input': function () {
			var dfd = this.async();
			var iterable = [ 0, 1 ];

			Promise.all(iterable).then(dfd.callback((value: number[]) => {
				assert.notStrictEqual(value, iterable);
			}));
		}
	}
});
