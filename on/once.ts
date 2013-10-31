/// <reference path="../interfaces.ts" />

import on = require('../on');

function once(type:string):IExtensionEvent {
	return (target:any, listener:Function, capture?:boolean) => {
		var handle = on(target, type, () => {
			handle.remove();
			return listener.apply(this, arguments);
		});
		return handle;
	};
};

export = once;
