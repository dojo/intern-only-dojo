import assert = require('intern/chai!assert');
import nextTick = require('src/nextTick');
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

	'#finally': {
		'return value ignored when undefined on resolved promise'() {
			return Promise.resolve(5)
				.finally(function (): number { return undefined; })
				.then(function (value) {
					assert.strictEqual(value, 5, 'Value should be passed through when finally does not return non-explicit value');
				});
		},

		'return value ignored when undefined on rejected promise'() {
			var expected = new Error('Oops');
			return Promise.reject(expected)
				.finally(function (): void {
					return undefined;
				})
				.then(function () {
					assert(false, 'Undefined value from finally should not result in success');
				}, function (error: Error) {
					assert.strictEqual(error, expected, 'Error should be passed through');
				});
		},

		'return value adopted when defined'() {
			return Promise.resolve(5)
				.finally(function () {
					return 10;
				})
				.then(function (value: number) {
					assert.strictEqual(value, 10, 'Value should be changed when finally returns explicit value');
				});
		},

		'error adopted when thrown'() {
			var expected = new Error('Oops');
			return Promise.resolve(5)
				.finally(function () {
					throw expected;
				})
				.then(function () {
					assert(false, 'Thrown value from finally should not result in success');
				}, function (error: Error) {
					assert.strictEqual(error, expected, 'Error value from finally should be used as value');
				});
		},

		'value from chained promise adopted when defined'() {
			return Promise.reject(new Error('Oops'))
				.finally(function () {
					return Promise.resolve(5);
				})
				.then(function (value) {
					assert.strictEqual(value, 5, 'Value from chained promise should be used as value');
				}, function () {
					assert(false, 'Error value from original promise should not be passed through');
				});
		},

		'error from chained promise adopted when thrown'() {
			var expected = new Error('Oops');
			return Promise.resolve()
				.finally(function () {
					return Promise.reject(expected);
				})
				.then(function () {
					assert(false, 'Error value from chained finally promise should not result in success');
				}, function (error) {
					assert.strictEqual(error, expected, 'Error from chained promise should be passed through');
				});
		}
	},

	'#cancel': {
		'basic cancel': function () {
			var expectedReason = new Error('Oops');

			var promise = new Promise(function (resolve, reject, progress, setCanceler) {
				setCanceler(function (reason) {
					assert.strictEqual(reason, expectedReason);
					return 'OK';
				});
			});

			promise.cancel(expectedReason);

			return promise.then(function (value) {
				assert.strictEqual(value, 'OK');
			});
		},

		'chained cancel': function () {
			var expectedReason = new Error('Oops');

			var promise = new Promise(function (resolve, reject, progress, setCanceler) {
				setCanceler(function (reason) {
					assert.strictEqual(reason, expectedReason);
					return 'OK';
				});
			}).then(function () {});

			promise.cancel(expectedReason);

			return promise.then(function (value) {
				assert.strictEqual(value, 'OK');
			});
		},

		'chained cancel to resolved unsettled promise': function () {
			var expectedReason = new Error('Oops');

			var chainedPromise = new Promise(function (resolve, reject, progress, setCanceler) {
				setCanceler(function (reason) {
					assert.strictEqual(reason, expectedReason);
					return 'OK';
				});
			});

			var promise = new Promise(function (resolve, reject, progress, setCanceler) {
				setCanceler(function (reason) {
					throw new Error('Original cancel should not be called since it is resolved');
				});

				resolve('NOT OK');
			}).then(function () {
				return chainedPromise;
			});

			nextTick(function () {
				promise.cancel(expectedReason);
			});

			return promise.then(function (value) {
				assert.strictEqual(value, 'OK');
			});
		},

		'chained cancel to intermediate': function () {
			this.timeout = 1000;

			var expectedReason = new Error('Oops');

			var chainedPromise = new Promise(function (resolve, reject, progress, setCanceler) {
				setCanceler(function (reason) {
					assert.strictEqual(reason, expectedReason);
					return 'OK';
				});
			});

			var promise = new Promise(function (resolve, reject, progress, setCanceler) {
				setCanceler(function (reason) {
					throw new Error('Original cancel should not be called since it is resolved');
				});

				resolve('NOT OK');
			}).then(function () {
				return Promise.resolve('NOT OK').then(function () {
					nextTick(function () {
						promise.cancel(expectedReason);
					});

					return chainedPromise;
				});
			});

			return promise.then(function (value) {
				assert.strictEqual(value, 'OK');
			});
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
