/// <reference path="chai.d.ts" />
/// <reference path="chai-assert.d.ts" />
/// <reference path="dojo.d.ts" />

interface IInternDeferred<T> extends IDeferred<T> {
	callback<U>(callback:U):U;
	rejectOnError<U>(callback:U):U;
}

declare module 'intern!object' {
	var createSuite:{
		(definition:Object):void;
	};
	export = createSuite;
}

declare module 'intern!tdd' {
	var tdd:{
		suite(name:string, factory:() => void):void;
		test(name:string, test:() => any):void;
		before(fn:() => any):void;
		after(fn:() => any):void;
		beforeEach(fn:() => any):void;
		afterEach(fn:() => any):void;
	};
	export = tdd;
}

declare module 'intern!bdd' {
	var bdd:{
		describe(name:string, factory:() => void):void;
		it(name:string, test:() => any):void;
		before(fn:() => any):void;
		after(fn:() => any):void;
		beforeEach(fn:() => any):void;
		afterEach(fn:() => any):void;
	};
	export = bdd;
}

declare module 'intern/chai!assert' {
	var assert:chai.Assert;
	export = assert;
}

declare module 'intern/chai!expect' {
	var expect:chai.Expect;
	export = expect;
}

declare module 'intern/chai!should' {
	var should:Function;
	export = should;
}
