/// <amd-dependency path="../domReady!" />

import core = require('../interfaces');
import Promise = require('../Promise');
import Evented = require('../Evented');
import lang = require('../lang');

var resolve:core.IPromiseFunction<number>, reject:core.IPromiseFunction<number>,
	promise = new Promise<number>((_resolve) => {
		_resolve(new Promise<number>((_resolve, _reject) => {
			resolve = _resolve;
			reject = _reject;
		}));
	});

promise.then(
	(value:number) => {
		console.log('Here:', value);
	}
);

var promise1 = new Promise<number>((resolve) => {
	resolve(5);
});

Promise.all({ one: promise, two: promise1 }).then((results:any) => {
	console.log(results);
}, (errors) => {
	console.log(errors);
});

resolve(4);

var recursiveResolve:core.IPromiseFunction<any>,
	recursive = new Promise((_resolve) => {
		recursiveResolve = _resolve;
	});

recursiveResolve(recursive);

recursive.catch((error) => {
	console.log('Error!', error);
});
