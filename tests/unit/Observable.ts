import assert = require('intern/chai!assert');
import core = require('src/interfaces');
import Observable = require('src/Observable');
import registerSuite = require('intern!object');

class TestObservable extends Observable {
	foo: string;
	baz: string;
}

class TestAccessorObservable extends Observable {
	private _foo: string;
	get foo(): string {
		return this._foo;
	}
	set foo(value: string) {
		this._foo = value;
	}
}

registerSuite({
	name: 'Observable',

	'creation': function () {
		var observable = new TestObservable({
			foo: 'bar',
			baz: 'blah'
		});

		assert.strictEqual(observable.foo, 'bar');
		assert.strictEqual(observable.baz, 'blah');
	},

	'.observe': {
		'property': function () {
			var dfd = this.async();
			var observable = new TestObservable({
				foo: 'bar',
				baz: 'blah'
			});

			observable.observe('foo', dfd.callback((value: string, oldValue: string) => {
				assert.strictEqual(value, 'thonk');
				assert.strictEqual(oldValue, 'bar');
			}));

			observable.foo = 'thonk';
		},

		'accessor': function () {
			var dfd = this.async();
			var observable = new TestAccessorObservable({
				foo: 'bar'
			});

			observable.observe('foo', dfd.callback((value: string, oldValue: string) => {
				assert.strictEqual(value, 'baz');
				assert.strictEqual(oldValue, 'bar');
			}));

			observable.foo = 'baz';
		},

		'remove': function () {
			var dfd = this.async();
			var observable = new TestObservable({
				foo: 'bar',
				baz: 'blah'
			});

			observable.observe('foo', dfd.rejectOnError(() => {
				assert(false, 'Should not have been called');
			})).remove();

			setTimeout(dfd.callback(() => {}), 500);
			observable.foo = 'thonk';
		},

		'after change not called': function () {
			var dfd = this.async();
			var observable = new TestObservable({
				foo: 'bar',
				baz: 'blah'
			});

			observable.foo = 'thonk';
			observable.observe('foo', dfd.rejectOnError(() => {
				assert(false, 'Should not have been called');
			}));

			setTimeout(dfd.callback(() => {}), 500);
		},

		'remove after change not called': function () {
			var dfd = this.async();
			var observable = new TestObservable({
				foo: 'bar',
				baz: 'blah'
			});

			var handle = observable.observe('foo', dfd.rejectOnError(() => {
				assert(false, 'Should not have been called');
			}));
			observable.foo = 'thonk';
			handle.remove();

			setTimeout(dfd.callback(() => {}), 500);
		},

		'value revert does not notify': function () {
			var dfd = this.async();
			var observable = new TestObservable({
				foo: 'bar',
				baz: 'blah'
			});

			observable.observe('foo', dfd.rejectOnError(() => {
				assert(false, 'Should not have been called');
			}));
			observable.foo = 'thonk';
			observable.foo = 'bar';

			setTimeout(dfd.callback(() => {}), 500);
		},
		'value revert then change notifies': function () {
			var dfd = this.async();
			var observable = new TestObservable({
				foo: 'bar',
				baz: 'blah'
			});

			observable.observe('foo', dfd.callback((newValue: string, oldValue: string) => {
				assert.strictEqual(newValue, 'baz');
				assert.strictEqual(oldValue, 'bar');
			}));
			observable.foo = 'thonk';
			observable.foo = 'bar';
			observable.foo = 'baz';
		}
	}
});
