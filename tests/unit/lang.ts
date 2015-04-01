import assert = require('intern/chai!assert');
import lang = require('src/lang');
import registerSuite = require('intern!object');

var global: any = (function () {
	return this;
})();

interface IExtraProps extends IProps {
	newProperty: string;
}

interface IProps {
	property: string;
	subObject: ISubObject;
	method(): void;
}

interface ISpy {
	(...args: any[]): any;
	args: IArguments;
}

interface ISubObject {
	property: string;
	otherProperty?: string;
}

registerSuite({
	name: 'lang',

	'.getProperty': function () {
		var properties = {
			property: 'foo',
			subObject: {
				property: 'bar'
			}
		};

		assert.strictEqual(lang.getProperty(properties, 'property'), 'foo');
		assert.strictEqual(lang.getProperty(properties, 'subObject.property'), 'bar');
		assert.isUndefined(lang.getProperty(properties, 'property.notHere'));
		assert.isUndefined(lang.getProperty(properties, 'notHere'));

		lang.getProperty(properties, 'notHere.foo', true);

		assert.isObject(lang.getProperty(properties, 'notHere'));
		assert.isObject(lang.getProperty(properties, 'notHere.foo'));
	},

	'.setProperty': function () {
		var properties = {
			property: 'foo',
			subObject: {
				property: 'bar'
			}
		};

		lang.setProperty(properties, 'property', 'baz');
		assert.propertyVal(properties, 'property', 'baz');
		lang.setProperty(properties, 'subObject.property', 'blah');
		assert.deepPropertyVal(properties, 'subObject.property', 'blah');
		lang.setProperty(properties, 'notHere.foo', 'bar');
		assert.deepPropertyVal(properties, 'notHere.foo', 'bar');

		assert.isUndefined(lang.setProperty(properties, '', 'bar'));
	},

	'.mixin': function () {
		assert.typeOf(lang.mixin(null), 'object');
		assert.typeOf(lang.mixin(undefined), 'object');

		var properties = {
			property: 'bar',
			subObject: {
				property: 'baz'
			},
			method: function () {}
		};
		var dest: IProps = lang.mixin<IProps>({}, properties);
		assert.deepEqual(dest, properties);
		assert.deepEqual(dest.subObject, properties.subObject);

		var extra: IExtraProps = lang.mixin<IExtraProps>({}, properties, {
			property: 'blah',
			newProperty: 'foo'
		});
		assert.strictEqual(extra.property, 'blah');
		assert.strictEqual(extra.newProperty, 'foo');

		var empty = lang.mixin<Object>({}, { toString: Object.prototype.toString });
		assert(!empty.hasOwnProperty('toString'));
	},

	'.delegate': function () {
		var src: IProps = {
			property: 'bar',
			subObject: {
				property: 'baz'
			},
			method: function () {}
		};

		var dest: IExtraProps = lang.delegate<IExtraProps>(src, { newProperty: 'bar' });

		assert.strictEqual(dest.property, src.property);
		assert.strictEqual(dest.subObject, src.subObject);
		assert.strictEqual(dest.method, src.method);
		assert.strictEqual(dest.newProperty, 'bar');
		assert(!dest.hasOwnProperty('property'));
		assert(dest.hasOwnProperty('newProperty'));
	},

	'.bind': {
		before: function () {
			global.someProperty = 'bar';
		},

		after: function () {
			global.someProperty = null;
		},

		'object': function () {
			var context = {
				someProperty: 'foo'
			};

			var unbound = function () {
				assert.strictEqual(this.someProperty, 'foo');
			};

			var bound = lang.bind<() => void>(context, unbound);

			assert.notStrictEqual(bound, unbound);
			bound();
			bound.call({});
		},

		'null': function () {
			var unbound = function () {
				assert.strictEqual(this, global);
			};

			var bound = lang.bind<() => void>(null, unbound);

			assert.notStrictEqual(bound, unbound);
			bound();
			bound.call({});
		},

		'arguments': function () {
			var context = {
				someProperty: 'foo'
			};

			var unbound = function (variable: string) {
				assert.strictEqual(this.someProperty, 'foo');
				assert.strictEqual(variable, 'bar');
			};

			var bound = lang.bind<() => void>(context, unbound, 'bar');

			assert.notStrictEqual(bound, unbound);
			bound();
			bound.call({});
		},

		'late binding': {
			'object': function () {
				var context = {
					someProperty: 'foo',
					method: function () {
						assert.strictEqual(this.someProperty, 'foo');
					}
				};

				var bound = lang.bind<() => void>(context, 'method');

				assert.notStrictEqual(bound, context.method);
				bound();
				bound.call({});
			},

			'arguments': function () {
				var context = {
					someProperty: 'foo',
					method: function (variable: string) {
						assert.strictEqual(this.someProperty, 'foo');
						assert.strictEqual(variable, 'bar');
					}
				};

				var bound = lang.bind<() => void>(context, 'method', 'bar');

				assert.notStrictEqual(bound, context.method);
				bound();
				bound.call({});
			}
		}
	},

	'.partial': function () {
		var f = <ISpy> function () {
			f.args = Array.prototype.slice.call(arguments, 0);
		};

		var partial1 = lang.partial<(a: string, b: string) => void>(f, 'foo');

		partial1('bar', 'baz');
		assert.deepEqual(f.args, [ 'foo', 'bar', 'baz' ]);

		var partial2 = lang.partial<(a: string) => void>(f, 'foo', 'bar');
		partial2('baz');
		assert.deepEqual(f.args, [ 'foo', 'bar', 'baz' ]);
	},

	'.deepMixin': function () {
		var properties = {
			property: 'bar',
			subObject: {
				property: 'baz'
			},
			method: function () {}
		};
		var dest: IProps = lang.deepMixin<IProps>({}, properties);
		assert.deepEqual(dest, properties);
		assert.notStrictEqual(dest.subObject, properties.subObject);

		var extra: IExtraProps = lang.deepMixin<IExtraProps>(dest, {
			property: 'bar', // this is the same value on purpose for branch coverage
			newProperty: 'foo',
			subObject: {
				otherProperty: 'la'
			}
		});
		assert.strictEqual(extra.newProperty, 'foo');
		assert.notStrictEqual(extra.subObject, properties.subObject);
		assert.strictEqual(extra.subObject.property, 'baz');
		assert.strictEqual(extra.subObject.otherProperty, 'la');

		var array = [ 'foo' ];
		array[2] = 'bar';
		array.length = 4;

		var arrayLike = lang.deepMixin<string[]>({}, array);
		assert.strictEqual(arrayLike[0], 'foo');
		assert.strictEqual(arrayLike[2], 'bar');
		assert.strictEqual(arrayLike.length, 4);
	},

	'.deepDelegate': function () {
		var properties: IProps = {
			property: 'bar',
			subObject: {
				property: 'baz'
			},
			method: function () {}
		};
		var dest: IExtraProps = lang.deepDelegate<IExtraProps>(properties, {
			newProperty: 'foo',
			subObject: {
				otherProperty: 'la'
			}
		});
		assert.strictEqual(dest.property, properties.property);
		assert.strictEqual(dest.newProperty, 'foo');
		assert.strictEqual(dest.method, properties.method);
		assert.notStrictEqual(dest.subObject, properties.subObject);
		assert.strictEqual(dest.subObject.property, properties.subObject.property);
		assert.strictEqual(dest.subObject.otherProperty, 'la');
		assert(dest.hasOwnProperty('newProperty'));
		assert(!dest.hasOwnProperty('property'));
		assert(dest.subObject.hasOwnProperty('otherProperty'));
		assert(!dest.subObject.hasOwnProperty('property'));
	},

	'.getPropertyDescriptor': function () {
		var foo = 1;
		var prototype = {
			get foo() {
				return foo;
			},
			set foo(value: number) {
				foo = value;
			}
		};
		var prototype2 = Object.create(prototype);
		var object = Object.create(prototype2);

		var descriptor = lang.getPropertyDescriptor(object, 'foo');
		var expected = Object.getOwnPropertyDescriptor(prototype, 'foo');

		assert.ok(!Object.getOwnPropertyDescriptor(object, 'foo'));
		assert.ok(descriptor);
		assert.deepEqual(descriptor, expected);
	}
});
