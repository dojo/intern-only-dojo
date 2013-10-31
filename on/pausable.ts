/// <reference path="../interfaces.ts" />

import on = require('../on');

function pausable(type:string):IExtensionEvent {
	return (target:any, listener:Function, capture?:boolean):IHandle => {
		var paused,
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
