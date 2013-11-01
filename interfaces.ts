interface Require {
	(config:any):void;
	(config:any, modules:string[]):void;
	(config:any, modules:string[], factory:Function):void;
	(modules:string[]):void;
	(modules:string[], factory:Function):void;
	(moduleName:string):any;
	has: {
		(feature:string):any;
		add(feature:string, test:any, now?:boolean, force?:boolean):void;
	}
}
declare var require: Require;

interface Define {
	(factory:Function):void;
	(dependencies:string[], factory:Function):void;
	(value:any):void;
}
declare var define: Define;

interface IHas {
	(feature:string):any;
	add(feature:string, test:(global:any, document:Document, element:HTMLElement)=>boolean, now?:boolean, force?:boolean):void;
	add(feature:string, test:boolean, now?:boolean, force?:boolean):void;
	normalize(id:string, normalize:Function):string;
	load(id:string, parentRequire:Require, loaded:Function, config?:any):void;
}

interface IHandle {
	remove():void;
}

interface IEvented {
	on(type:string, listener:Function):IHandle;
	emit(type:string, event:Object):boolean;
}

interface IAroundFactory {
	(previous:Function):Function;
}

interface IExtensionEvent {
	(target:any, listener:Function):IHandle;
}
interface IOn {
	(target:HTMLElement, type:string, listener:Function, capture?:boolean):IHandle;
	(target:HTMLElement, type:IExtensionEvent, listener:Function, capture?:boolean):IHandle;
	(target:IEvented, type:string, listener:Function, capture?:boolean):IHandle;
	(target:IEvented, type:IExtensionEvent, listener:Function, capture?:boolean):IHandle;
	parse(target:HTMLElement, type:string, listener:Function, context:any, addListener:Function, capture?:boolean):IHandle;
	parse(target:HTMLElement, type:IExtensionEvent, listener:Function, context:any, addListener:Function, capture?:boolean):IHandle;
	parse(target:IEvented, type:string, listener:Function, context:any, addListener:Function, capture?:boolean):IHandle;
	parse(target:IEvented, type:IExtensionEvent, listener:Function, context:any, addListener:Function, capture?:boolean):IHandle;
	emit(target:HTMLElement, type:string, event:any):boolean;
	emit(target:IEvented, type:string, event:any):boolean;
}
