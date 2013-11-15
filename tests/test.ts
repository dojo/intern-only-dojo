/// <amd-dependency path="../text!../on.js" />
/// <amd-dependency path="../domReady!" />

import Promise = require('../Promise');
import Evented = require('../Evented');
var template = require('../text!../on.js');

var resolve, reject,
	promise = new Promise((_resolve) => {
		_resolve(new Promise((_resolve, _reject) => {
			resolve = _resolve;
			reject = _reject;
		}));
	});

promise.then(
	(value) => {
		console.log('Here:', value);
	}
);

var promise1 = new Promise((resolve) => {
	resolve(5);
});

Promise.all({ one: promise, two: promise1 }).then((results) => {
	console.log(results);
}, (errors) => {
	console.log(errors);
});

resolve(4);

class MyEvented extends Evented {}

var me = new MyEvented();
me.emit('foo', 'bar', 'baz');

console.log(template);
