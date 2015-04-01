import core = require('./interfaces');

class ObservableArray<T> implements core.IObservableArray<T> {
	[index: number]: T;
	length: number;

	static from<U>(items: U[]): ObservableArray<U> {
		var observable = new ObservableArray<U>(items.length);

		for (var i = 0; i < items.length; i++) {
			if (items.hasOwnProperty(<any> i)) {
				observable[i] = items[i];
			}
		}

		return observable;
	}

	constructor(length: number = 0) {
		Object.defineProperty(this, 'length', {
			configurable: false,
			enumerable: false,
			value: length,
			writable: true
		});
	}

	concat<U extends T[]>(...items: U[]): ObservableArray<T>;
	concat<U extends ObservableArray<T>>(...items: U[]): ObservableArray<T>;
	concat(...items: T[]): ObservableArray<T>;
	concat(...items: any[]): any {
		// Array#concat claims to be generic in the spec, but only actual arrays
		// are flattened. The following code flattens ObservableArray instances
		// by changing them to arrays before running concat
		var array: T[] = [];

		this.forEach((item: T, index: number) => {
			array[index] = item;
		});

		items = items.map((item: any): any => {
			if (item instanceof (<any> this).constructor) {
				return Array.prototype.slice.call(item, 0);
			}
			return item;
		});

		return ObservableArray.from(Array.prototype.concat.apply(array, items));
	}

	every(callback: (value: T, index: number, array: ObservableArray<T>) => boolean, thisObject?: any): boolean {
		return Array.prototype.every.apply(this, arguments);
	}

	filter(callback: (value: T, index: number, array: ObservableArray<T>) => boolean, thisObject?: any): ObservableArray<T> {
		return ObservableArray.from<T>(Array.prototype.filter.apply(this, arguments));
	}

	forEach(callback: (value: T, index: number, array: ObservableArray<T>) => void, thisObject?: any): void {
		Array.prototype.forEach.apply(this, arguments);
	}

	indexOf(searchElement: T, fromIndex?: number): number {
		return Array.prototype.indexOf.apply(this, arguments);
	}

	join(separator?: string): string {
		return Array.prototype.join.apply(this, arguments);
	}

	lastIndexOf(searchElement: T, fromIndex?: number): number {
		return Array.prototype.lastIndexOf.apply(this, arguments);
	}

	map<U>(callback: (value: T, index: number, array: ObservableArray<T>) => U, thisObject?: any): ObservableArray<U> {
		return ObservableArray.from<U>(Array.prototype.map.apply(this, arguments));
	}

	observe(observer: core.IArrayObserver<T>): core.IHandle {
		return {
			remove: () => {}
		};
	}

	pop(): T {
		return this.splice(this.length - 1, 1)[0];
	}

	push(...items: T[]): number {
		this.splice.apply(this, (<any[]> [ this.length, 0 ]).concat(items));
		return this.length;
	}

    reduce(callback: (previousValue: T, currentValue: T, currentIndex: number, array: T[]) => T, initialValue?: T): T;
    reduce<U>(callback: (previousValue: U, currentValue: T, currentIndex: number, array: T[]) => U, initialValue: U): U;
	reduce(callback: Function, initialValue?: any): any {
		return Array.prototype.reduce.apply(this, arguments);
	}

    reduceRight(callback: (previousValue: T, currentValue: T, currentIndex: number, array: T[]) => T, initialValue?: T): T;
    reduceRight<U>(callback: (previousValue: U, currentValue: T, currentIndex: number, array: T[]) => U, initialValue: U): U;
	reduceRight(callback: Function, initialValue?: any): any {
		return Array.prototype.reduceRight.apply(this, arguments);
	}

	reverse(): ObservableArray<T> {
		// TODO: notification
		Array.prototype.reverse.call(this);
		return this;
	}

	set(index: number, value: T): void {
		this[index] = value;
		// TODO: notification
	}

    shift(): T {
		return this.splice(0, 1)[0];
	}

    slice(start: number, end?: number): ObservableArray<T> {
		return ObservableArray.from<T>(Array.prototype.slice.apply(this, arguments));
	}

    some(callback: (value: T, index: number, array: ObservableArray<T>) => boolean, thisObject?: any): boolean {
		return Array.prototype.some.apply(this, arguments);
	}

    sort(compare?: (a: T, b: T) => number): ObservableArray<T> {
		// TODO: notification
		Array.prototype.sort.apply(this, arguments);
		return this;
	}

	splice(start: number): ObservableArray<T>;
	splice(start: number, deleteCount: number, ...items: T[]): ObservableArray<T>;
	splice(start: number, deleteCount: number = 1, ...items: T[]): ObservableArray<T> {
		var removals = Array.prototype.splice.apply(this, arguments);

		// TODO: notify

		return ObservableArray.from<T>(removals);
	}

    unshift(...items: T[]): number {
		this.splice.apply(this, (<any[]> [ 0, 0 ]).concat(items));
		return this.length;
	}
}

var oldPrototype = ObservableArray.prototype,
	newPrototype = ObservableArray.prototype = Object.create(Array.prototype);

// Configure properties of new prototype using descriptor properties from Array.prototype
// along with functions from the old prototype
Object.getOwnPropertyNames(Array.prototype).forEach((name: string) => {
	var descriptor = Object.getOwnPropertyDescriptor(Array.prototype, name);

	if (name in oldPrototype) {
		descriptor.value = (<any> oldPrototype)[name];
	}

	Object.defineProperty(newPrototype, name, descriptor);
});

export = ObservableArray;
