import core = require('./interfaces');

declare var define;
declare var require;

var global = (function () { return this; })(),
	nodeRequire = global.require && global.require.nodeRequire;

if (!nodeRequire) {
	throw new Error('Cannot find the Node.js require');
}

export function load(id:string, contextRequire:core.Require, loaded:Function):void {
	var oldDefine = define,
		result;

	// Some modules attempt to detect an AMD loader by looking for global AMD `define`. This causes issues
	// when other CommonJS modules attempt to load them via the standard Node.js `require`, so hide it
	// during the load
	define = undefined;

	try {
		result = nodeRequire(id);
	}
	finally {
		define = oldDefine;
	}

	loaded(result);
}

export function normalize(id:string, normalize:Function):string {
	/**
	 * Produces a normalized CommonJS module ID to be used by Node.js `require`. Relative IDs
	 * are resolved relative to the requesting module's location in the filesystem and will
	 * return an ID with path separators appropriate for the local filesystem
	 */

	if (id.charAt(0) === '.') {
		// absolute module IDs need to be generated based on the AMD loader's knowledge of the parent module,
		// since Node.js will try to use the directory containing `dojo.js` as the relative root if a
		// relative module ID is provided
		id = require.toUrl(normalize('./' + id));
	}

	return id;
}
