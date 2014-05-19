import has = require('./has/es6');

has.add('es6-getpropertydescriptor', typeof (<any> Object).getPropertyDescriptor === 'function');

var slice = Array.prototype.slice;

function getDottedProperty(object:any, parts:string[], create:boolean):any {
	var key:string,
		i = 0;

	while (object && (key = parts[i++])) {
		if (typeof object !== 'object') {
			return undefined;
		}
		object = key in object ? object[key] : (create ? object[key] = {} : undefined);
	}

	return object;
}

export function setProperty(object:any, propertyName:string, value:any):void {
	var parts = propertyName.split('.'),
		part = parts.pop(),
		property = getDottedProperty(object, parts, true);

	if (property && part) {
		property[part] = value;
		return value;
	}
}

export function getProperty(object:any, propertyName:string, create:boolean = false):any {
	return getDottedProperty(object, propertyName.split('.'), create);
}

function _mixin<T>(destination:any, source:any):T {
	for (var name in source) {
		var sourceValue = source[name];
		if (name in destination && destination[name] === sourceValue) {
			// skip properties that destination already has
			continue;
		}
		destination[name] = sourceValue;
	}

	return destination;
}

export function mixin<T extends Object>(destination:T, ...sources:any[]):T;
export function mixin<T extends Object>(destination:any, ...sources:any[]):T;
export function mixin(destination:any, ...sources:any[]):any {
	if (!destination) {
		destination = {};
	}
	for (var i = 0; i < sources.length; i++) {
		_mixin(destination, sources[i]);
	}
	return destination;
}

export function delegate<T extends Object>(object:T, properties?:any):T;
export function delegate<T extends Object>(object:any, properties?:any):T;
export function delegate(object:any, properties?:any):any {
	object = Object.create(object);
	_mixin(object, properties);
	return object;
}

var _bind = Function.prototype.bind;
export function bind<T extends Function>(context:any, func:Function, ...extra:any[]):T;
export function bind<T extends Function>(context:any, method:string, ...extra:any[]):T;
export function bind(context:any, func:any, ...extra:any[]):any {
	if (typeof func === 'function') {
		return _bind.apply(func, [context].concat(extra));
	}
	return function () {
		return context[func].apply(context, extra.concat(slice.call(arguments, 0)));
	};
}

export function partial<T extends Function>(func:Function, ...extra:any[]):T;
export function partial(func:Function, ...extra:any[]):any {
	return function () {
		return func.apply(this, extra.concat(slice.call(arguments, 0)));
	};
}

export function deepMixin<T extends Object>(target:T, source:any):T;
export function deepMixin<T extends Object>(target:any, source:any):T;
export function deepMixin(target:any, source:any):any {
	if (source && typeof source === 'object') {
		if (Array.isArray(source)) {
			(<any>target).length = source.length;
		}
		for (var name in source) {
			var targetValue = target[name],
				sourceValue = source[name];

			if (targetValue !== sourceValue) {
				if (sourceValue && typeof sourceValue === 'object') {
					if (!targetValue || typeof targetValue !== 'object') {
						target[name] = targetValue = {};
					}
					deepMixin(targetValue, sourceValue);
				}
				else {
					target[name] = sourceValue;
				}
			}
		}
	}
	return target;
}

export function deepDelegate<T extends Object>(origin:T, properties?:any):T;
export function deepDelegate<T extends Object>(origin:any, properties?:any):T;
export function deepDelegate(origin:any, properties:any = null):any {
	var destination = delegate(origin);

	for (var name in origin) {
		var value = origin[name];

		if (value && typeof value === 'object') {
			destination[name] = deepDelegate<typeof value>(value);
		}
	}
	return deepMixin<any>(destination, properties);
}

export function isEqual(a:any, b:any):boolean {
	return a === b || /* both values are NaN */ (a !== a && b !== b);
}

export var getPropertyDescriptor:(object:any, property:string) => PropertyDescriptor;

if (has('es6-getpropertydescriptor')) {
	getPropertyDescriptor = (<any>Object).getPropertyDescriptor;
}
else {
	getPropertyDescriptor = (object:any, property:string):PropertyDescriptor => {
		var descriptor:PropertyDescriptor;

		while (object) {
			descriptor = Object.getOwnPropertyDescriptor(object, property);

			if (descriptor) {
				return descriptor;
			}

			object = Object.getPrototypeOf(object);
		}

		return null;
	};
}

export function pullFromArray<T>(haystack:T[], needle:T):T[] {
	var removed = [];
	var i = 0;
	while ((i = haystack.indexOf(needle, i)) > -1) {
		removed.push(haystack.splice(i, 1)[0]);
	}

	return removed;
}
