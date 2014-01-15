export interface Define {
	(factory:Function):void;
	(dependencies:string[], factory:Function):void;
	(value:any):void;
}

export declare var define: Define;

export interface IEvented {
	on(type:string, listener:Function):IHandle;
	emit(type:string, ...args:any[]):boolean;
}

export interface IExtensionEvent {
	(target:any, listener:Function):IHandle;
}

export interface IHandle {
	remove():void;
}

export interface IHas extends ILoaderFunctionPlugin {
	(feature:string):any;
	add(feature:string, test:(global:any, document:Document, element:HTMLElement)=>boolean, now?:boolean, force?:boolean):void;
	add(feature:string, test:boolean, now?:boolean, force?:boolean):void;
}

export interface ILoaderFunctionPlugin extends ILoaderPlugin {
	(...args:any[]):any;
}

export interface ILoaderPlugin {
	normalize?(id:string, normalize:Function):string;
	load(id:string, parentRequire:Require, loaded:Function, config?:any):void;
}

export interface IOn {
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

export interface IPromise<T> {
	catch<U>(onRejected:(reason:any)=>U):IPromise<U>;
	catch<U>(onRejected:(reason:any)=>IPromise<U>):IPromise<U>;
	then<U>(onFulfilled?:(value:T)=>U, onRejected?:(reason:any)=>U):IPromise<U>;
	then<U>(onFulfilled?:(value:T)=>U, onRejected?:(reason:any)=>IPromise<U>):IPromise<U>;
	then<U>(onFulfilled?:(value:T)=>IPromise<U>, onRejected?:(reason:any)=>U):IPromise<U>;
	then<U>(onFulfilled?:(value:T)=>IPromise<U>, onRejected?:(reason:any)=>IPromise<U>):IPromise<U>;
}

export interface IPromiseFunction<T> {
	(value:T):void;
	(promise:IPromise<T>):void;
}

export interface IPromiseResolver<T> {
	(resolve:IPromiseFunction<T>, reject:IPromiseFunction<any>):void;
}

export interface IRegistryMatcher {
	(...args:any[]):boolean;
}

export interface Require {
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
	toUrl: (moduleId:string)=>string;
	nodeRequire: (moduleId:string)=>any;
}

export declare var require: Require;
