/// <reference path="../intern.d.ts" />

import assert = require('intern/chai!assert');
import nextTick = require('../../nextTick');
import registerSuite = require('intern!object');

registerSuite({
	name: 'nextTick',

	'async': function () {
		var dfd = this.async(),
			foo = 1;

		nextTick(() => {
			foo = 2;
		});

		setTimeout(dfd.callback(() => {
			assert.strictEqual(foo, 2);
		}), 0);

		assert.strictEqual(foo, 1);
	},

	'remove': function () {
		var dfd = this.async(),
			called = false;

		nextTick(() => {
			called = true;
		}).remove();

		setTimeout(dfd.callback(() => {
			assert.ok(!called);
		}), 0);
	}
});
