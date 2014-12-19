export interface IArrayObserver<T> {
	(index:number, inserted:IObservableArray<T>, removedItems:IObservableArray<T>):void;
}

export interface IDateObject {
	dayOfMonth:number;
	dayOfWeek:number;
	daysInMonth:number;
	hours:number;
	isLeapYear:boolean;
	milliseconds:number;
	minutes:number;
	month:number;
	seconds:number;
	year:number;
}

export interface IDateObjectArguments extends IDateObjectOperationArguments {
	month:number;
	year:number;
}

export interface IDateObjectOperationArguments {
	dayOfMonth?:number;
	hours?:number;
	milliseconds?:number;
	minutes?:number;
	month?:number;
	seconds?:number;
	year?:number;
}

export interface IHandle {
	remove():void;
}

export interface IObservable {
	observe<T>(property:string, observer:IObserver<T>):IHandle;
}

export interface IObservableArray<T> {
	[index:number]:T;
	observe(observer:IArrayObserver<T>):IHandle;
	set(index:number, value:T):void;
}

export interface IObserver<T> {
	(newValue:T, oldValue:T):void;
}

export interface IHas {
	(name:string):any;
	add(name:string, value:(global:Window, document?:HTMLDocument, element?:HTMLDivElement) => any, now?:boolean, force?:boolean):void;
	add(name:string, value:any, now?:boolean, force?:boolean):void;
}

/* tslint:disable:class-name */
export interface has extends IHas, ILoaderPlugin {}
/* tslint:enable:class-name */

export interface IConfig {
	baseUrl?:string;
	map?:IModuleMap;
	packages?:IPackage[];
	paths?:{ [path:string]:string; };
}

export interface IDefine {
	(moduleId:string, dependencies:string[], factory:IFactory):void;
	(dependencies:string[], factory:IFactory):void;
	(factory:IFactory):void;
	(value:any):void;
}

export interface IFactory {
	(...modules:any[]):any;
}

export interface ILoaderPlugin {
	dynamic?:boolean;
	load?:(resourceId:string, require:IRequire, load:(value?:any) => void, config?:Object) => void;
	normalize?:(moduleId:string, normalize:(moduleId:string) => string) => string;
}

export interface IMapItem extends Array<any> {
	/* prefix */      0:string;
	/* replacement */ 1:any;
	/* regExp */      2:RegExp;
	/* length */      3:number;
}

export interface IMapReplacement extends IMapItem {
	/* replacement */ 1:string;
}

export interface IMapRoot extends Array<IMapSource> {
	star?:IMapSource;
}

export interface IMapSource extends IMapItem {
	/* replacement */ 1:IMapReplacement[];
}

export interface IModule extends ILoaderPlugin {
	cjs:{
		exports:any;
		id:string;
		setExports:(exports:any) => void;
		uri:string;
	};
	def:IFactory;
	deps:IModule[];
	executed:any; // TODO: enum
	injected:boolean;
	fix?:(module:IModule) => void;
	gc:boolean;
	mid:string;
	pack:IPackage;
	req:IRequire;
	require?:IRequire; // TODO: WTF?
	result:any;
	url:string;

	// plugin interface
	loadQ?:IModule[];
	plugin?:IModule;
	prid:string;
}

export interface IModuleMap extends IModuleMapItem {
	[sourceMid:string]:IModuleMapReplacement;
}

export interface IModuleMapItem {
	[mid:string]:/*IModuleMapReplacement|IModuleMap*/any;
}

export interface IModuleMapReplacement extends IModuleMapItem {
	[findMid:string]:/* replaceMid */string;
}

export interface IPackage {
	location?:string;
	main?:string;
	name?:string;
}

export interface IPackageMap {
	[packageId:string]:IPackage;
}

export interface IPathMap extends IMapReplacement {}

export interface IRequire {
	(config:IConfig, dependencies?:string[], callback?:IRequireCallback):void;
	(dependencies:string[], callback:IRequireCallback):void;
	<ModuleType>(moduleId:string):ModuleType;

	toAbsMid(moduleId:string):string;
	toUrl(path:string):string;
}

export interface IRequireCallback {
	(...modules:any[]):void;
}

export interface IRootRequire extends IRequire {
	config(config:IConfig):void;
	has:has;
	inspect?:(name:string) => any;
	nodeRequire?:<ModuleType>(moduleId:string) => ModuleType;
	signal:(type:string, data:any[]) => void;
	undef:(moduleId:string) => void;
}
