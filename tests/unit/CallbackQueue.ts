import assert = require('intern/chai!assert');
import CallbackQueue = require('src/CallbackQueue');
import registerSuite = require('intern!object');

var queue: CallbackQueue<Function>;

interface Spy {
	(...args: any[]): any;
	args?: IArguments;
	called: boolean;
}

registerSuite({
	name: 'CallbackQueue',

	beforeEach: () => {
		queue = new CallbackQueue<Function>();
	},

	'calls callbacks': function () {
		var one = <Spy> function () {
			one.called = true;
		};
		var two = <Spy> function () {
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
			var one = <Spy> function () {
				one.called = true;
				twoHandle.remove();
			};
			var two = <Spy> function () {
				two.called = true;
			};

			queue.add(one);
			var twoHandle = queue.add(two);

			queue.drain();

			assert.ok(one.called);
			assert.ok(!two.called);
		},

		'handler before': function () {
			var one = <Spy> function () {
				one.called = true;
			};
			var two = <Spy> function () {
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
		var one = <Spy> function () {
			one.called = true;
			queue.add(two);
		};
		var two = <Spy> function () {
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
		var one = <Spy> function () {
			one.args = Array.prototype.slice.call(arguments, 0);
			one.called = true;
		};

		queue.add(one);
		queue.drain(1, 2, 3);

		assert.ok(one.called);
		assert.deepEqual(one.args, [1, 2, 3]);
	}
});
