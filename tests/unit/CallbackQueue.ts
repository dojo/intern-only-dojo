/// <reference path="../intern.d.ts" />

import assert = require('intern/chai!assert');
import core = require('../../interfaces');
import CallbackQueue = require('../../CallbackQueue');
import registerSuite = require('intern!object');

var queue:CallbackQueue<Function>;

interface ISpy extends Function {
	args?:IArguments;
	called:boolean;
	(...args:any[]):any;
}

registerSuite({
	name: 'CallbackQueue',

	beforeEach: () => {
		queue = new CallbackQueue<Function>();
	},

	'calls callbacks': function () {
		var one:ISpy = <any>function () {
			one.called = true;
		};
		var two:ISpy = <any>function () {
			two.called = true;
		};

		queue.add(one);
		queue.add(two);

		queue.drain();

		assert.ok(one.called);
		assert.ok(two.called);
	},

	'removes correctly': {
		'handler after': function () {
			var one:ISpy = <any>function () {
				one.called = true;
				twoHandle.remove();
			};
			var two:ISpy = <any>function () {
				two.called = true;
			};

			queue.add(one);
			var twoHandle = queue.add(two);

			queue.drain();

			assert.ok(one.called);
			assert.ok(!two.called);
		},

		'handler before': function () {
			var one:ISpy = <any>function () {
				one.called = true;
			};
			var two:ISpy = <any>function () {
				two.called = true;
				oneHandle.remove();
			};

			var oneHandle = queue.add(one);
			queue.add(two);

			queue.drain();

			assert.ok(one.called);
			assert.ok(two.called);
		}
	},

	'adding during drain': function () {
		var one:ISpy = <any>function () {
			one.called = true;
			queue.add(two);
		};
		var two:ISpy = <any>function () {
			two.called = true;
		};

		queue.add(one);
		queue.drain();

		assert.ok(one.called, 'one should have been called');
		assert.ok(!two.called, 'two should not have been called');

		one.called = two.called = false;
		queue.drain();

		assert.ok(!one.called, 'one should not have been called');
		assert.ok(two.called, 'two should have been called');
	},

	'arguments': function () {
		var one:ISpy = <any>function () {
			one.args = Array.prototype.slice.call(arguments);
			one.called = true;
		};

		queue.add(one);
		queue.drain(1, 2, 3);

		assert.ok(one.called);
		assert.deepEqual(one.args, [1, 2, 3]);
	}
});
