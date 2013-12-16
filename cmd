#!/usr/bin/env node
var repl = require('repl'),
	vm = require('vm'),
	path = require('path'),
	useGlobal = true;

function evalWithHistory(code, context, file, callback){
	// TOOD: write history saving routines
	var err, result;
	try{
		if(useGlobal){
			result = vm.runInThisContext(code, file);
		}else{
			result = vm.runInContext(code, context, file);
		}
	}catch(e){
		err = e;
	}
	callback(err, result);
}

var deps = [];
if (process.argv.length > 2) {
	deps = process.argv.slice(2).map(function (dep) {
		var ext = path.extname(dep);
		if (ext) {
			dep = dep.substring(0, dep.length - ext.length);
		}
		return dep;
	});
}

var req = require('./loader');
require.signal = function(type, args){
	if(args[0] instanceof Error){
		console.log('ERROR ' + type + ': ' + args[0]);
	}
};
req({
	// packages
	baseUrl: path.dirname(__dirname),
	packages: [
		{ name: 'core', location: 'core' }
	]
}, deps);

if (!deps.length) {
	var r = repl.start({
		prompt: '> ',
		input: process.stdin,
		output: process.stdout,
		useGlobal: useGlobal,
		eval: evalWithHistory
	});
	var creq = r.context.require = function(module, callback){
		return req.apply(null, arguments);
	};
	for (var key in req) {
		if (req.hasOwnProperty(key)) {
			creq[key] = req[key];
		}
	}
}
