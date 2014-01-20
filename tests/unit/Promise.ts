/// <reference path="../intern.d.ts" />

import assert = require('intern/chai!assert');
import core = require('../../interfaces');
import Promise = require('../../Promise');
import registerSuite = require('intern!object');

registerSuite({
	name: 'Promise',

	'#then': {
		'fulfillment': function () {
			var dfd = this.async();

			Promise.resolve(5).then(dfd.callback(function (value:number) {
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
			Promise.resolve<any>(evilPromise).then(dfd.rejectOnError(function (value:number) {
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
