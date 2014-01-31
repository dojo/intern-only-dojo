/// <reference path="../intern.d.ts" />

import assert = require('intern/chai!assert');
import core = require('../../interfaces');
import Observable = require('../../Observable');
import ObservableProperty = require('../../ObservableProperty');
import registerSuite = require('intern!object');

class TestObservable extends Observable {
	foo:string;
	baz:string;
}

registerSuite({
	name: 'ObservableProperty',

	'creation': function () {
		var observable = new TestObservable({
			foo: 'bar',
			baz: 'blah'
		});
		var property = new ObservableProperty<string>(observable, 'foo');

		assert.strictEqual(property.value, observable.foo);
	},

	'.observe': function () {
		var dfd = this.async(),
			observable = new TestObservable({
				foo: 'bar',
				baz: 'blah'
			}),
			property = new ObservableProperty<string>(observable, 'foo');

		property.observe('value', dfd.callback((newValue:number, oldValue:number) => {
			assert.strictEqual(newValue, 'baz');
			assert.strictEqual(oldValue, 'bar');
		}));

		property.value = 'baz';
	}
});
