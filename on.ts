/// <reference path="interfaces.ts" />

import has = require('./has');

var slice = Array.prototype.slice;

function addListener(target:any, type:string, listener:Function, capture?:boolean):IHandle {
	if (target.addEventListener) {
		target.addEventListener(type, listener, capture);

		var handle = {
			remove: () => {
				handle.remove = () => {};
				target.removeEventListener(type, listener, capture);
			}
		};
		return handle;
	}
	throw new Error('Target must be an event emitter');
}

var on = <IOn>function (target:any, type:any, listener:Function, capture?:boolean):IHandle {
	if (typeof target.on === 'function' && typeof type !== 'function' && !target.nodeType) {
		return target.on(type, listener, capture);
	}

	return on.parse(target, type, listener, this, addListener, capture);
}

function parse(target:any, type:any, listener:Function, context:any, addListener:Function, capture?:boolean):IHandle {
	if (type.call) {
		return type.call(context, target, listener, capture);
	}
	if (type.indexOf(',') > -1) {
		var events = type.split(/\s*,\s*/),
			handles = events.map((eventName:string) => {
				return addListener(target, eventName, listener, capture);
			}),
			handle = {
				remove: () => {
					handle.remove = () => {};
					handles.forEach((handle:IHandle) => {
						handle.remove();
					});
				}
			};
		return handle;
	}
	return addListener(target, type, listener, capture);
}
on.parse = parse;

function emit(target:any, type:string, event:any):boolean {
	if (typeof target.emit === 'function' && !target.nodeType) {
		return target.emit(type, event);
	}

	if (target.dispatchEvent && document.createEvent) {
		var nativeEvent = target.ownerDocument.createEvent('HTMLEvents');
		nativeEvent.initEvent(type, !!event.bubbles, !!event.cancelable);

		for (var i in event) {
			if (!(i in nativeEvent)) {
				nativeEvent[i] = event[i];
			}
		}
		return target.dispatchEvent(nativeEvent) && nativeEvent;
	}
	throw new Error('Target must be an event emitter');
}

on.emit = emit;

export = on;
