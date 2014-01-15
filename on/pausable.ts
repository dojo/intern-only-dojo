import core = require('../interfaces');
import on = require('../on');

function pausable(type:string):core.IExtensionEvent {
	return (target:any, listener:Function, capture?:boolean):core.IHandle => {
		var paused:boolean,
			handle = <any>on(target, type, () => {
				if (!paused) {
					return listener.apply(this, arguments);
				}
			}, capture);

		handle.pause = () => {
			paused = true;
		};
		handle.resume = () => {
			paused = false;
		};
		return handle;
	};
}

export = pausable;
