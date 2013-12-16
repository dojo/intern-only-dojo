var slice = Array.prototype.slice;

function getDottedProperty(object:any, parts:Array<string>, create:boolean):any {
	var key,
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

function _mixin<T>(destination:T, source:any):T {
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

export function mixin<T>(destination:T, ...sources:any[]):T;
export function mixin<T>(destination:T):T {
	if (!destination) {
		destination = <T>{};
	}
	for (var i = 1; i < arguments.length; i++) {
		_mixin(destination, arguments[i]);
	}
	return destination;
}

export function delegate<T>(object:T, properties?:any):T {
	object = Object.create(object);
	_mixin(object, properties);
	return object;
}

var _bind = Function.prototype.bind;
export function bind<T extends Function>(context:any, func:Function, ...extra:any[]):T;
export function bind<T extends Function>(context:any, method:string, ...extra:any[]):T;
export function bind(context:any, func:any):any {
	if (typeof func === 'function') {
		return _bind.apply(func, [context].concat(slice.call(arguments, 2)));
	}
	var extra = slice.call(arguments, 2);
	return function () {
		return context[func].apply(context, extra.concat(slice.call(arguments)));
	};
}

export function partial<T extends Function>(func:Function, ...extra:any[]):T;
export function partial(func:Function):any {
	var extra = slice.call(arguments, 1);
	return function () {
		return func.apply(this, extra.concat(slice.call(arguments)));
	};
}

export function deepMixin<T>(target:T, source:any):T {
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

export function deepDelegate<T>(origin:T, properties:any = null):T {
	var destination = delegate(origin);
	properties = properties || null;

	for (var name in origin) {
		var value = origin[name];

		if (value && typeof value === 'object') {
			destination[name] = deepDelegate(value);
		}
	}
	return deepMixin(destination, properties);
}
