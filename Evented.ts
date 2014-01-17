import core = require('./interfaces');
import on = require('./on');
import aspect = require('./aspect');

var slice = Array.prototype.slice;

class Evented implements core.IEvented {
	on(type:string, listener:Function):core.IHandle {
		return on.parse(this, type, listener, this, (target:Evented, type:string) => {
			return aspect.on(this, '__on' + type, listener);
		});
	}

	emit(type:string, ...args:any[]):boolean {
		type = '__on' + type;
		if (this[type]) {
			return this[type].apply(this, args);
		}
	}
}

export = Evented;
