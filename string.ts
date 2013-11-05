/// <reference path="interfaces.ts" />

import lang = require('./lang');

declare var exports;

export function repeat(string:string, times:number):string {
	if (!string || times <= 0) {
		return '';
	}

	var buffer = [];
	while (true) {
		if (times & 1) {
			buffer.push(string);
		}
		times >>= 1;
		if (!times) {
			break;
		}
		string += string;
	}
	return buffer.join('');
}

function pad(text:string, size:number, character:string, end?:boolean):string {
	var pad = exports.repeat(character, Math.ceil((size - text.length) / character.length));

	return end ? text + pad : pad + text;
}

export function padr(text:string, size:number, character:string = ' '):string {
	return pad(text, size, character, true);
}
export function padl(text:string, size:number, character:string = ' '):string {
	return pad(text, size, character, false);
}

export interface ITransform {
	(value:any, key?:string):any;
}

var substitutePattern = /\$\{([^\s\:\}]+)(?:\:([^\s\:\}]+))?\}/g;
function defaultTransform(value) {
	return value;
};
export function substitute(template:string, map:Object, transform?:ITransform, context?:any):string;
export function substitute(template:string, map:Array, transform?:ITransform, context?:any):string;
export function substitute(template:string, map:any, transform?:ITransform, context?:any):string {
	context = context || undefined;
	transform = transform ? transform.bind(context) : defaultTransform;

	return template.replace(substitutePattern, (match, key, format) => {
		var value = lang.getProperty(map, key);
		if (format) {
			value = lang.getProperty(context, format).call(context, value, key);
		}
		return transform(value, key) + '';
	});
}

export function count(haystack:string, needle:string):number {
	var hits = 0,
		lastIndex = haystack.indexOf(needle);

	while (lastIndex > -1) {
		++hits;
		lastIndex = haystack.indexOf(needle, lastIndex + 1);
	}

	return hits;
}

var regExpPattern = /[-\[\]{}()*+?.,\\\^$|#\s]/g;
export function escapeRegExpString(string:string):string {
	return string.replace(regExpPattern, '\\$&');
}
