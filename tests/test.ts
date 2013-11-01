import Promise = require('./Promise');
import Evented = require('./Evented');

var resolve, reject,
	promise = new Promise((_resolve) => {
		_resolve(new Promise((_resolve, _reject) => {
			resolve = _resolve;
			reject = _reject;
		}));
	});

promise.then(
	(value) => {
		console.log(value);
	}
);

var promise1 = new Promise((resolve) => {
	resolve(5);
});

Promise.all({ one: promise, two: promise1 }).then((results) => {
	console.log(results);
});

resolve(4);

class MyEvented extends Evented {}

var me = new MyEvented();
