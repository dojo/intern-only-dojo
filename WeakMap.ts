import core = require('./interfaces');
import has = require('./has');
import lang = require('./lang');

has.add('es6-weak-map', typeof (<any> WeakMap) !== 'undefined');

class WeakMapShim {
	private _name:string = undefined;
	static length:number = 1;

	constructor(iterable:any) {
		var self = this;
		self._name = '__wm' + lang.getUID() + (startId++ + '__');
		if (iterable && 'forEach' in iterable) {
			iterable.forEach(function (item, i) {
				if (Array.isArray(item) && item.length === 2) {
					self.set(iterable[i][0], iterable[i][1]);
				}
				else {
					self.set(iterable[i], i);
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
		return value;
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

var WM;

if (!has('es6-weak-map')) {
	var startId:number = Math.floor(Date.now() % 100000000);
	WM = WeakMapShim;
}
else {
	WM = WeakMap;
}

export = WM;
