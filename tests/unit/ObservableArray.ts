/// <reference path="../intern.d.ts" />

import assert = require('intern/chai!assert');
import core = require('../../interfaces');
import ObservableArray = require('../../ObservableArray');
import registerSuite = require('intern!object');

registerSuite({
	name: 'ObservableArray',

	'creation': function () {
		var observable = new ObservableArray<number>();

		assert.instanceOf(observable, Array);
		assert.instanceOf(observable, ObservableArray);
		assert.strictEqual(observable.length, 0);
		assert.ok(!observable.hasOwnProperty('0'));

		observable = new ObservableArray<number>(4);

		assert.instanceOf(observable, Array);
		assert.instanceOf(observable, ObservableArray);
		assert.strictEqual(observable.length, 4);
		assert.ok(!observable.hasOwnProperty('0'));
	},

	'.from': function () {
		var array = [1, 2, 3];
		array[4] = 4;
		var observable = ObservableArray.from(array);

		assert.instanceOf(observable, Array);
		assert.instanceOf(observable, ObservableArray);
		assert.strictEqual(observable.length, 5);
		/* Observable Arrays are not true arrays */
		assert.deepEqual(Array.prototype.slice.call(observable), array);
	},

	'#concat': function () {
		var observable1 = ObservableArray.from([1, 2, 3]),
			observable2 = observable1.concat(ObservableArray.from([4, 5, 6]), ObservableArray.from([7, 8, 9]));

		assert.instanceOf(observable2, ObservableArray);
		/* Observable Arrays are not true arrays */
		assert.deepEqual(Array.prototype.slice.call(observable2), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
	},

	'#every': function () {
		var observable = ObservableArray.from([1, 2, 3]);

		assert.ok(observable.every((item:number) => {
			return typeof item === 'number';
		}));
		assert.ok(!observable.every((item:number) => {
			return item === 1;
		}));
	},

	'#filter': function () {
		var observable = ObservableArray.from([1, 2, 3]),
			filtered = observable.filter((item:number) => {
				return item > 1;
			});

		assert.instanceOf(filtered, ObservableArray);
		/* Observable Arrays are not true arrays */
		assert.deepEqual(Array.prototype.slice.call(filtered), [2, 3]);
	},

	'#indexOf': function () {
		var observable = ObservableArray.from([1, 2, 3, 1, 3]);

		assert.strictEqual(observable.indexOf(1), 0);
		assert.strictEqual(observable.indexOf(3), 2);
		assert.strictEqual(observable.indexOf(4), -1);
		assert.strictEqual(observable.indexOf(1, 1), 3);
		assert.strictEqual(observable.indexOf(3, 3), 4);
	},

	'#join': function () {
		var observable = ObservableArray.from([1, 2, 3]);

		assert.strictEqual(observable.join('foo'), '1foo2foo3');
	},

	'#lastIndexOf': function () {
		var observable = ObservableArray.from([1, 2, 3, 1, 3]);

		assert.strictEqual(observable.lastIndexOf(1), 3);
		assert.strictEqual(observable.lastIndexOf(3), 4);
		assert.strictEqual(observable.lastIndexOf(4), -1);
		assert.strictEqual(observable.lastIndexOf(1, 2), 0);
		assert.strictEqual(observable.lastIndexOf(3, 3), 2);
	},

	'#map': function () {
		var observable = ObservableArray.from([1, 2, 3]),
			mapped = observable.map((item:number):string => {
				return 'foo' + item;
			});

		assert.instanceOf(mapped, ObservableArray);
		/* Observable Arrays are not true arrays */
		assert.deepEqual(Array.prototype.slice.call(mapped), ['foo1', 'foo2', 'foo3']);
	},

	'#pop': function () {
		var observable = ObservableArray.from([1, 2, 3]);

		assert.strictEqual(observable.pop(), 3);
		assert.strictEqual(observable.length, 2);
	},

	'#push': function () {
		var observable = ObservableArray.from([1, 2, 3]);

		assert.strictEqual(observable.push(4, 5, 6), 6);
		/* Observable Arrays are not true arrays */
		assert.deepEqual(Array.prototype.slice.call(observable), [1, 2, 3, 4, 5, 6]);
	},

	'#reduce': function () {
	},

	'#reduceRight': function () {
	},

	'#reverse': function () {
		var observable = ObservableArray.from([1, 2, 3]);

		observable.reverse();

		/* Observable Arrays are not true arrays */
		assert.deepEqual(Array.prototype.slice.call(observable), [3, 2, 1]);
	},

	'#shift': function () {
		var observable = ObservableArray.from([1, 2, 3]);

		assert.strictEqual(observable.shift(), 1);
		assert.strictEqual(observable.length, 2);
	},

	'#slice': function () {
		var observable = ObservableArray.from([1, 2, 3]);

		assert.instanceOf(observable.slice(0, 2), ObservableArray);
		/* Observable Arrays are not true arrays */
		assert.deepEqual(Array.prototype.slice.call(observable.slice(0)), [1, 2, 3]);
		assert.deepEqual(Array.prototype.slice.call(observable.slice(0, 2)), [1, 2]);
		assert.deepEqual(Array.prototype.slice.call(observable.slice(0, 4)), [1, 2, 3]);
		assert.deepEqual(Array.prototype.slice.call(observable.slice(2)), [3]);
		assert.deepEqual(Array.prototype.slice.call(observable.slice(2, 4)), [3]);
		assert.deepEqual(Array.prototype.slice.call(observable.slice(1, 3)), [2, 3]);
	},

	'#some': function () {
		var observable = ObservableArray.from([1, 2, 3]);

		assert.ok(observable.some((item:number) => {
			return item === 1;
		}));
		assert.ok(!observable.some((item:number) => {
			return typeof item === 'string';
		}));
	},

	'#sort': function () {
		var observable = ObservableArray.from([4, 7, 10, 1, 32, 0, 12]);

		observable.sort((a:number, b:number) => {
			if (a < b) {
				return -1;
			}
			if (a > b) {
				return 1;
			}
			return 0;
		});

		/* Observable Arrays are not true arrays */
		assert.deepEqual(Array.prototype.slice.call(observable), [0, 1, 4, 7, 10, 12, 32]);
	},

	'#splice': function () {
		var observable = ObservableArray.from([1, 2, 3]);

		var removals = observable.splice(1, 1, 4, 5, 6);

		assert.instanceOf(removals, ObservableArray);
		/* Observable Arrays are not true arrays */
		assert.deepEqual(Array.prototype.slice.call(observable), [1, 4, 5, 6, 3]);
		assert.deepEqual(Array.prototype.slice.call(removals), [2]);
	},

	'#unshift': function () {
		var observable = ObservableArray.from([1, 2, 3]);

		assert.strictEqual(observable.unshift(4, 5, 6), 6);
		/* Observable Arrays are not true arrays */
		assert.deepEqual(Array.prototype.slice.call(observable), [4, 5, 6, 1, 2, 3]);
	}
});
