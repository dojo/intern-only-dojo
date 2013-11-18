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
	toUrl: (moduleId:string)=>string;
	nodeRequire: (moduleId:string)=>any;
}
declare var require: Require;

interface Define {
	(factory:Function):void;
	(dependencies:string[], factory:Function):void;
	(value:any):void;
}
declare var define: Define;

interface ILoaderPlugin {
	normalize?(id:string, normalize:Function):string;
	load(id:string, parentRequire:Require, loaded:Function, config?:any):void;
}

interface ILoaderFunctionPlugin extends ILoaderPlugin {
	(...args:any[]):any;
}

interface IHas extends ILoaderFunctionPlugin {
	(feature:string):any;
	add(feature:string, test:(global:any, document:Document, element:HTMLElement)=>boolean, now?:boolean, force?:boolean):void;
	add(feature:string, test:boolean, now?:boolean, force?:boolean):void;
}

interface IHandle {
	remove():void;
}

interface IEvented {
	on(type:string, listener:Function):IHandle;
	emit(type:string, ...args:any[]):boolean;
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

interface IPromiseFunction<T> {
	(value:T):void;
	(promise:IPromise<T>):void;
}
interface IPromiseResolver<T> {
	(resolve:IPromiseFunction<T>, reject:IPromiseFunction<any>):void;
}

interface IPromise<T> {
	catch<U>(onRejected:(reason:any)=>U):IPromise<U>;
	catch<U>(onRejected:(reason:any)=>IPromise<U>):IPromise<U>;
	then<U>(onFulfilled?:(value:T)=>U, onRejected?:(reason:any)=>U):IPromise<U>;
	then<U>(onFulfilled?:(value:T)=>U, onRejected?:(reason:any)=>IPromise<U>):IPromise<U>;
	then<U>(onFulfilled?:(value:T)=>IPromise<U>, onRejected?:(reason:any)=>U):IPromise<U>;
	then<U>(onFulfilled?:(value:T)=>IPromise<U>, onRejected?:(reason:any)=>IPromise<U>):IPromise<U>;
}
var IPromise: {
	new <T>(resolver:IPromiseResolver<T>);
	all(iterable:any):IPromise<any[]>;
	cast<T>(value:T):IPromise<T>;
	cast<T>(value:IPromise<T>):IPromise<T>;
	race(iterable:any):IPromise<any>;
	reject<T>(reason:any):IPromise<T>;
	resolve<T>(value:T):IPromise<T>;
};
