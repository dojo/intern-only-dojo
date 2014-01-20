import core = require('./interfaces');

declare var process:any;
declare var require:core.Require;

// The following interface will export because it has the
// same name as the variable being exported
interface has extends core.IHas, core.ILoaderPluginFunction {}
var has:has = <any>require.has;

if (!has) {
	has = (() => {
		var hasCache = Object.create(null),
			global = (function () { return this; })(),
			document = global.document,
			element = document && document.createElement('DiV');

		var has:has = <any>function(feature:string):any {
			return typeof hasCache[feature] === 'function' ? (hasCache[feature] = hasCache[feature](global, document, element)) : hasCache[feature];
		};
		has.add = function (feature:string, test:any, now?:boolean, force?:boolean):void {
			(!(feature in hasCache) || force) && (hasCache[feature] = test);
			now && has(feature);
		};

		return has;
	})()
}

has.add('host-browser', typeof document !== 'undefined' && typeof location !== 'undefined');
has.add('host-node', typeof process === 'object' && process.versions && process.versions.node);

has.normalize = function (id:string, normalize:Function):string {
	var tokens = id.match(/[\?:]|[^:\?]*/g),
		i = 0,
		get = function (skip?:boolean) {
			var term = tokens[i++];
			if (term === ':') {
				// empty string module name, resolves to 0
				return 0;
			}
			else {
				// postfixed with a ? means it is a feature to branch on, the term is the name of the feature
				if (tokens[i++] === '?') {
					if (!skip && has(term)) {
						// matched the feature, get the first value from the options
						return get();
					}
					else {
						// did not match, get the second value, passing over the first
						get(true);
						return get(skip);
					}
				}

				// a module
				return term || 0;
			}
		};

	id = get();
	return id && normalize(id);
};

has.load = function (id:string, parentRequire:core.Require, loaded:Function):void {
	if (id) {
		parentRequire([ id ], loaded);
	}
	else {
		loaded();
	}
};

export = has;
