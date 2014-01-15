import core = require('./interfaces');
import has = require('./has');

declare var require:core.Require;

var getText = function (url:string, load:Function) {
	throw new Error('dojo/text not supported on this platform');
};

if (has('host-browser')) {
	getText = function (url, load) {
		var xhr = new XMLHttpRequest();

		xhr.onreadystatechange = function () {
			if (xhr.readyState !== 4) {
				return;
			}
			var text = xhr.responseText;
			xhr.onreadystatechange = null;
			load(text);
		};
		xhr.open('GET', url, true);
		xhr.send(null);
	};
}
else if (has('host-node')) {
	var fs = require.nodeRequire('fs');
	getText = function (url, load) {
		fs.readFile(url, { encoding: 'utf-8' }, function (err:Error, data:string) {
			if (err) {
				throw err;
			}
			load(data);
		});
	};
}

export function load(id:string, contextRequire:core.Require, loaded:Function):void {
	getText(id, loaded);
}
