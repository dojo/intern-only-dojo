import has = require('./has');
import lang = require('./lang');

has.add('es6-weak-map', typeof (<any> WeakMap) !== 'undefined');

class WeakMapPolyfill<K, V> {
	private _name:string = undefined;
	static length:number = 1;

	constructor(iterable:any) {
		this._name = '__wm' + lang.getUID() + (startId++ + '__');
		if (iterable && 'forEach' in iterable) {
			iterable.forEach((item:any, i:number) => {
				if (Array.isArray(item) && item.length === 2) {
					this.set(iterable[i][0], iterable[i][1]);
				}
				else {
					this.set(iterable[i], i);
				}
			});
		}
	}

	set(key:any, value:any):any {
		var entry = key[this._name];
		if (entry && entry[0] === key) {
			entry[1] = value;
		}
		else {
			Object.defineProperty(key, this._name, {
				value: [key, value],
				writable: true
			});
		}
		return this;
	}

	get(key:any):any {
		var entry = key[this._name];
		return entry && entry[0] === key ? entry[1] : undefined;
	}

	has(key:any):boolean {
		var entry = key[this._name];
		return Boolean(entry && entry[0] === key && entry[1]);
	}

	delete(key:any):void {
		this.set(key, undefined);
	}
}

var WM:any;

if (!has('es6-weak-map')) {
	var startId:number = Math.floor(Date.now() % 100000000);
	WM = WeakMapPolyfill;
}
else {
	WM = WeakMap;
}

export = WM;
