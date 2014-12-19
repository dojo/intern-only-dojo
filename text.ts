/// <reference path="./nodejs" />
import has = require('./has');
import core = require('./interfaces');

var getText:(url:string, callback:(value:string) => void) => void;

if (has('host-browser')) {
	getText = function (url:string, callback:(value:string) => void):void {
		var xhr = new XMLHttpRequest();

		xhr.onload = function ():void {
			callback(xhr.responseText);
		};

		xhr.open('GET', url, true);
		xhr.send(null);
	};
}
else if (has('host-node')) {
	var fs = require('fs');
	getText = function (url:string, callback:(value:string) => void):void {
		fs.readFile(url, { encoding: 'utf8' }, function (error:Error, data:string):void {
			if (error) {
				throw error;
			}

			callback(data);
		});
	};
}
else {
	getText = function ():void {
		throw new Error('dojo/text not supported on this platform');
	};
}

export function load(resourceId:string, require:core.IRequire, load:(value?:any) => void):void {
	getText(resourceId, load);
}
