import assert = require('intern/chai!assert');
import nextTick = require('src/nextTick');
import registerSuite = require('intern!object');

registerSuite({
	name: 'nextTick',

	'async': function () {
		var dfd = this.async();
		var foo = 1;

		nextTick(() => {
			foo = 2;
		});

		setTimeout(dfd.callback(() => {
			assert.strictEqual(foo, 2);
		}), 20);

		assert.strictEqual(foo, 1);
	},

	'remove': function () {
		var dfd = this.async();
		var called = false;

		nextTick(() => {
			called = true;
		}).remove();

		setTimeout(dfd.callback(() => {
			assert.ok(!called);
		}), 0);
	}
});
