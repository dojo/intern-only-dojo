var slice = Array.prototype.slice;

function getDottedProperty(object: Object, parts: Array, create: boolean) {
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

export function setProperty(object: Object, propertyName: string, value: any): void {
	var parts = propertyName.split('.'),
		part = parts.pop(),
		property = getDottedProperty(object, parts, true);

	if (property && part) {
		property[part] = value;
		return value;
	}
}

export function getProperty(object: Object, propertyName: string, create: boolean = false): any {
	return getDottedProperty(object, propertyName.split('.'), create);
}

function _mixin(destination: Object, source: Object): Object {
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

export function mixin<T>(destination: T, ...sources: Object[]): T;
export function mixin<T>(destination: T): T {
	if (!destination) {
		destination = <T>{};
	}
	for (var i = 1; i < arguments.length; i++) {
		_mixin(destination, arguments[i]);
	}
	return destination;
}

export function delegate<T>(object:T, properties?:Object): T {
	object = Object.create(object);
	_mixin(object, properties);
	return object;
}

export function bind<T>(context:Object, method:T, ...extra:any[]): T;
export function bind(context:Object, method:string, ...extra:any[]): Function;
export function bind(context:any, method:any): Function {
	var extra = slice.call(arguments, 2);
	if (typeof method === 'string') {
		// late binding
		return function () {
			return context[method].apply(context, extra.concat(slice.call(arguments)));
		};
	}
	return method.bind.apply(method, [context].concat(extra));
}

export function partial<T>(func:T, ...extra:any[]):T;
export function partial(func:Function):Function {
	var extra = slice.call(arguments, 1);
	return function () {
		return func.apply(this, extra.concat(slice.call(arguments)));
	};
}

export function deepMixin(target: any, source: any): any {
	if (source && typeof source === 'object') {
		if (Array.isArray(source)) {
			target.length = source.length;
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

export function deepDelegate(origin: Object, properties: Object = null): Object {
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