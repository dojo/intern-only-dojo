import core = require('../interfaces');
import on = require('../on');

function once(type:string):core.IExtensionEvent {
	return (target:any, listener:Function, capture?:boolean):core.IHandle => {
		var handle = on(target, type, () => {
			handle.remove();
			return listener.apply(this, arguments);
		});
		return handle;
	};
};

export = once;
