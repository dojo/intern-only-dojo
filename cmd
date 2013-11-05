#!/usr/bin/env node
var repl = require('repl'),
	vm = require('vm'),
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

var req = require('./loader');
require.signal = function(type, args){
	if(args[0] instanceof Error){
		console.log('ERROR ' + type + ': ' + args[0]);
	}
};
req({
	// packages
	packages: [
		{ name: 'dojo', location: '.' }
	]
});

var r = repl.start({
	prompt: '> ',
	input: process.stdin,
	output: process.stdout,
	useGlobal: useGlobal,
	eval: evalWithHistory
});
r.context.require = function(module, callback){
	return req.apply(null, arguments);
};
