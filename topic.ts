/// <reference path="interfaces.ts" />

import Evented = require('./Evented');

var hub = new Evented();

export function subscribe(topic:string, listener:Function):IHandle {
	return hub.on.apply(hub, arguments);
}

export function publish(topic:string, ...args:any[]):any;
export function publish(topic:string):any {
	return hub.emit.apply(hub, arguments);
}