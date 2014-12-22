/// <reference path="../intern.d.ts" />

import assert = require('intern/chai!assert');
import core = require('../../interfaces');
import has = require('../../has');
import WeakMap = require('../../WeakMap');
import registerSuite = require('intern!object');

var wm:any,
	obj1 = { foo: 'bar' },
	obj2 = { baz: 'qat' },
	obj3 = { qat: 'foo' },
	arr1 = [ 'foo', 'bar' ];

registerSuite({
	name: 'WeakMap',

	'feature detection': function () {
		var isNative = Boolean(~WeakMap.toString().indexOf('[native code]'));
    	if (isNative) {
    		assert.isTrue(has('es6-weak-map'));
    	}
    	else {
    		assert.isFalse(has('es6-weak-map'));
    	}
	},

	'instantiation': function () {
		if (has('es6-weak-map')) this.skip('Native WeakMap');

		assert.strictEqual(WeakMap.length, 1);

		wm = new WeakMap();
		assert.isFunction(wm.set);
		assert.isFunction(wm.get);
		assert.isFunction(wm.has);
		assert.isFunction(wm.delete);
	},

	'iterator': function () {
		if (has('es6-weak-map')) this.skip('Native WeakMap');

		var foo = {},
			wm2 = new WeakMap([ [foo, 'bar'] ]);

		assert.strictEqual(wm2.get(foo), 'bar');
	},

	'.set()': function () {
		if (has('es6-weak-map')) this.skip('Native WeakMap');

		assert.strictEqual(wm.set(obj1, 'baz'), wm);

		assert.strictEqual(Object.keys(obj1).length, 1);
	},

	'.get()': function () {
		if (has('es6-weak-map')) this.skip('Native WeakMap');

		assert.strictEqual(wm.get(obj1), 'baz');
		assert.isUndefined(wm.get(obj2));
		wm.set(obj2, arr1);
		assert.strictEqual(wm.get(obj2), arr1);
	},

	'.has()': function () {
		if (has('es6-weak-map')) this.skip('Native WeakMap');

		assert.isTrue(wm.has(obj1));
		assert.isTrue(wm.has(obj2));
		assert.isFalse(wm.has(obj3));
	},

	'.delete()': function () {
		if (has('es6-weak-map')) this.skip('Native WeakMap');

		wm.delete(obj1);
		assert.isUndefined(wm.get(obj1));
		assert.isFalse(wm.has(obj1));
		assert.strictEqual(wm.get(obj2), arr1);
	}
});