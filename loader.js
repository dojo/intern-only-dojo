(function () {
	/*jshint node:true */

	// Copyright (c) 2008-2012, Rawld Gill and ALTOVISO LLC (www.altoviso.com). Use, modification, and distribution
	// subject to terms of license.

	// Language and Acronyms and Idioms
	//
	// moduleId: a CJS module identifier, (used for public APIs)
	// mid: moduleId (used internally)
	// pid: package identifier
	// pack: pack is used internally to reference a package object (since javascript has reserved words including "package")
	// prid: plugin resource identifier

	/**
	 * The global require function.
	 * @param config //(object, optional) configuration options
	 * @param dependencies //(array of commonjs.moduleId, optional) list of modules to be loaded before applying callback
	 * @param callback //(function, optional) lamda expression to apply to module values implied by dependencies
	 */
	var req = function (config, dependencies, callback) {
		if (/* require([], cb) */ Array.isArray(config) || /* require(mid) */ typeof config === 'string') {
			callback = dependencies;
			dependencies = config;
			config = {};
		}
		if (has('loader-configurable')) {
			configure(config);
		}
		return contextRequire(dependencies, callback);
	};

	//
	// has.js
	//

	var has = req.has = (function () {
		var hasCache = Object.create(null),
			global = this,
			document = global.document,
			element = document && document.createElement('DIV');

		function has(name) {
			return typeof hasCache[name] === 'function' ? (hasCache[name] = hasCache[name](global, document, element)) : hasCache[name];
		}

		has.add = function (name, test, now, force) {
			(!(name in hasCache) || force) && (hasCache[name] = test);
			now && has(name);
		};

		return has;
	})();

	has.add('host-browser', typeof document !== 'undefined' && typeof location !== 'undefined');
	has.add('host-node', typeof process === 'object' && process.versions && process.versions.node);

	// IE9 will process multiple scripts at once before firing their respective onload events, so some extra work
	// needs to be done to associate the content of the define call with the correct node. This is known to be fixed
	// in IE10 and the bad behaviour cannot be inferred through feature detection, so simply target this one user-agent
	has.add('loader-ie9-compat', has('host-browser') && navigator.userAgent.indexOf('MSIE 9.0') > -1);

	has.add('loader-configurable', true);
	if (has('loader-configurable')) {
		/**
		 * Configures the loader.
		 *
		 * @param {{ ?baseUrl: string, ?map: Object, ?packages: Array.<({ name, ?location, ?main }|string)> }} config
		 * The configuration data.
		 */
		var configure = req.config = function (config) {
			// TODO: Expose all properties on req as getter/setters? Plugin modules like dojo/node being able to
			// retrieve baseUrl is important. baseUrl is defined as a getter currently.
			baseUrl = (config.baseUrl || baseUrl).replace(/\/*$/, '/');

			mix(map, config.map);

			forEach(config.packages, function (p) {
				// Allow shorthand package definition, where name and location are the same
				if (typeof p === 'string') {
					p = { name: p, location: p };
				}

				if (p.location != null) {
					p.location = p.location.replace(/\/*$/, '/');
				}

				packs[p.name] = p;
			});

			function computeMapProg(map) {
				// This method takes a map as represented by a JavaScript object and initializes an array of
				// arrays of (map-key, map-value, regex-for-map-key, length-of-map-key), sorted decreasing by length-
				// of-map-key. The regex looks for the map-key followed by either "/" or end-of-string at the beginning
				// of a the search source.
				//
				// Maps look like this:
				//
				// map: { C: { D: E } }
				//      A    B
				//
				// The computed mapping is a 4-array deep tree, where the outermost array corresponds to the source
				// mapping object A, the 2nd level arrays each correspond to one of the source mappings C -> B, the 3rd
				// level arrays correspond to each destination mapping object B, and the innermost arrays each
				// correspond to one of the destination mappings D -> E.
				//
				// So, the overall structure looks like this:
				//
				// mapProgs = [ source mapping array, source mapping array, ... ]
				// source mapping array = [
				//     source module id,
				//     [ destination mapping array, destination mapping array, ... ],
				//     RegExp that matches on source module id,
				//     source module id length
				// ]
				// destination mapping array = [
				//     original module id,
				//     destination module id,
				//     RegExp that matches on original module id,
				//     original module id length
				// ]

				var result = [],
					k;

				for (k in map) {
					result.push([
						k,
						map[k],
						new RegExp('^' + k.replace(/[-\[\]{}()*+?.,\\\^$|#\s]/g, '\\$&') + '(?:\/|$)'),
						k.length
					]);
				}

				result.sort(function (lhs, rhs) {
					return rhs[3] - lhs[3];
				});

				return result;
			}

			mapProgs = computeMapProg(map);
			forEach(mapProgs, function (item) {
				item[1] = computeMapProg(item[1], []);
				if (item[0] === '*') {
					mapProgs.star = item[1];
				}
			});

			// Note that old paths will get destroyed if reconfigured
			config.paths && (pathsMapProg = computeMapProg(config.paths));
		};
	}

	//
	// loader state data
	//

	// AMD baseUrl config
	var baseUrl = './',

		// a map from pid to package configuration object
		packs = {},

		// list of (from-path, to-path, regex, length) derived from paths;
		// a "program" to apply paths; see computeMapProg
		pathsMapProg = [],

		// AMD map config variable
		map = {},

		// array of quads as described by computeMapProg; map-key is AMD map key, map-value is AMD map value
		mapProgs = [],

		// A hash:(mid) --> (module-object) the module namespace
		//
		// pid: the package identifier to which the module belongs (e.g., "dojo"); "" indicates the system or default package
		// mid: the fully-resolved (i.e., mappings have been applied) module identifier without the package identifier (e.g., "dojo/io/script")
		// url: the URL from which the module was retrieved
		// pack: the package object of the package to which the module belongs
		// executed: false => not executed; EXECUTING => in the process of tranversing deps and running factory; true => factory has been executed
		// deps: the dependency array for this module (array of modules objects)
		// def: the factory for this module
		// result: the result of the running the factory for this module
		// injected: true => module has been injected
		// load, dynamic, normalize: plugin functions applicable only for plugins
		//
		// Modules go through several phases in creation:
		//
		// 1. Requested: some other module's definition or a require application contained the requested module in
		//    its dependency array
		//
		// 2. Injected: a script element has been appended to the insert-point element demanding the resource implied by the URL
		//
		// 3. Loaded: the resource injected in [2] has been evaluated.
		//
		// 4. Defined: the resource contained a define statement that advised the loader about the module.
		//
		// 5. Evaluated: the module was defined via define and the loader has evaluated the factory and computed a result.
		modules = {},

		// hash:(mid | url)-->(function | string)
		//
		// A cache of resources. The resources arrive via a require.cache application, which takes a hash from either mid --> function or
		// url --> string. The function associated with mid keys causes the same code to execute as if the module was script injected.
		//
		// Both kinds of key-value pairs are entered into cache via the function consumePendingCache, which may relocate keys as given
		// by any mappings *iff* the cache was received as part of a module resource request.
		cache = {},

		// hash:(mid | url)-->(function | string)
		//
		// Gives a set of cache modules pending entry into cache. When cached modules are published to the loader, they are
		// entered into pendingCacheInsert; modules are then pressed into cache upon (1) AMD define or (2) upon receiving another
		// independent set of cached modules. (1) is the usual case, and this case allows normalizing mids given in the pending
		// cache for the local configuration, possibly relocating modules.
		pendingCacheInsert = {},

		forEach = function (array, callback) {
			array && array.forEach(callback);
		},

		mix = function (dest, src) {
			for (var k in src) {
				dest[k] = src[k];
			}
			return dest;
		},

		signal = function () {
			req.signal.apply(req, arguments);
		},

		consumePendingCacheInsert = function (referenceModule) {
			var k,
				item;

			for (k in pendingCacheInsert) {
				item = pendingCacheInsert[k];

				cache[typeof item === 'string' ? toUrl(k, referenceModule) : getModuleInfo(k, referenceModule).mid] = item;
			}

			pendingCacheInsert = {};
		},

		uidGenerator = 0,

		contextRequire = function (a1, a2, referenceModule) {
			var module;
			if (typeof a1 === 'string') {
				// a1 is a string; therefore, signature is (moduleId)
				module = getModule(a1, referenceModule);
				if (module.executed !== true) {
					throw new Error('Attempt to require unloaded module ' + module.mid);
				}
				// Assign the result of the module to `module`
				// otherwise require('moduleId') returns the internal
				// module representation
				module = module.result;
			}
			else if (Array.isArray(a1)) {
				// signature is (requestList [,callback])
				// construct a synthetic module to control execution of the requestList, and, optionally, callback
				module = getModuleInfo('*' + (++uidGenerator));
				mix(module, {
					deps: resolveDeps(a1, module, referenceModule),
					def: a2 || {},
					gc: true // garbage collect
				});
				guardCheckComplete(function () {
					forEach(module.deps, injectModule.bind(null, module));
				});
				execQ.push(module);
				checkComplete();
			}
			return module;
		},

		createRequire = function (module) {
			var result = (!module && req) || module.require;
			if (!result) {
				module.require = result = function (a1, a2) {
					return contextRequire(a1, a2, module);
				};
				mix(mix(result, req), {
					toUrl: function (name) {
						return toUrl(name, module);
					},
					toAbsMid: function (mid) {
						return toAbsMid(mid, module);
					}
				});
			}
			return result;
		},

		// The list of modules that need to be evaluated.
		execQ = [],

		// The arguments sent to loader via AMD define().
		defArgs = null,

		// the number of modules the loader has injected but has not seen defined
		waitingCount = 0,

		runMapProg = function (targetMid, map) {
			// search for targetMid in map; return the map item if found; falsy otherwise
			if (map) {
				for (var i = 0; i < map.length; i++) {
					if (map[i][2].test(targetMid)) {
						return map[i];
					}
				}
			}
			return false;
		},

		compactPath = function (path) {
			var result = [],
				segment,
				lastSegment;

			path = path.replace(/\\/g, '/').split('/');
			while (path.length) {
				segment = path.shift();
				if (segment === '..' && result.length && lastSegment !== '..') {
					result.pop();
					lastSegment = result[result.length - 1];
				}
				else if (segment !== '.') {
					result.push(lastSegment = segment);
				} // else ignore "."
			}
			return result.join('/');
		},

		getModuleInfo = function (mid, referenceModule) {
			var match,
				pid,
				pack,
				midInPackage,
				mapItem,
				url,
				result;

			// relative module ids are relative to the referenceModule; get rid of any dots
			mid = compactPath(/^\./.test(mid) && referenceModule ? (referenceModule.mid + '/../' + mid) : mid);
			// at this point, mid is an absolute mid

			// if there is a reference module, then use its module map, if one exists; otherwise, use the global map.
			// see computeMapProg for more information on the structure of the map arrays
			var moduleMap = referenceModule && runMapProg(referenceModule.mid, mapProgs);
			moduleMap = moduleMap ? moduleMap[1] : mapProgs.star;

			if ((mapItem = runMapProg(mid, moduleMap))) {
				mid = mapItem[1] + mid.slice(mapItem[3]);
			}

			match = mid.match(/^([^\/]+)(\/(.+))?$/);
			pid = match ? match[1] : '';
			pack = packs[pid];

			if (pack) {
				mid = pid + '/' + (midInPackage = (match[3] || pack.main || 'main'));
			}
			else {
				pid = '';
			}

			if (!(result = modules[mid])) {
				mapItem = runMapProg(mid, pathsMapProg);
				url = mapItem ? mapItem[1] + mid.slice(mapItem[3]) : (pid ? pack.location + midInPackage : mid);
				result = {
					pid: pid,
					mid: mid,
					pack: pack,
					url: compactPath(
						// absolute urls should not be prefixed with baseUrl
						(/^(?:\/|\w+:)/.test(url) ? '' : baseUrl) +
						url +
						// urls with a javascript extension should not have another one added
						(/\.js(?:\?[^?]*)?$/.test(url) ? '' : '.js')
					)
				};
			}

			return result;
		},

		resolvePluginResourceId = function (plugin, prid, contextRequire) {
			return plugin.normalize ? plugin.normalize(prid, contextRequire.toAbsMid) : contextRequire.toAbsMid(prid);
		},

		getModule = function (mid, referenceModule) {
			// compute and construct (if necessary) the module implied by the mid with respect to referenceModule
			var match,
				plugin,
				prid,
				result,
				contextRequire,
				loaded;

			match = mid.match(/^(.+?)\!(.*)$/);
			if (match) {
				// name was <plugin-module>!<plugin-resource-id>
				plugin = getModule(match[1], referenceModule);
				loaded = plugin.load;

				contextRequire = createRequire(referenceModule);

				if (loaded) {
					prid = resolvePluginResourceId(plugin, match[2], contextRequire);
					mid = (plugin.mid + '!' + (plugin.dynamic ? ++uidGenerator + '!' : '') + prid);
				}
				else {
					// if the plugin has not been loaded, then can't resolve the prid and must assume this plugin is dynamic until we find out otherwise
					prid = match[2];
					mid = plugin.mid + '!' + (++uidGenerator) + '!*';
				}
				result = {
					plugin: plugin,
					mid: mid,
					req: contextRequire,
					prid: prid,
					fix: !loaded
				};
			}
			else {
				result = getModuleInfo(mid, referenceModule);
			}
			return  modules[result.mid] || (modules[result.mid] = result);
		},

		toAbsMid = function (mid, referenceModule) {
			return getModuleInfo(mid, referenceModule).mid;
		},

		toUrl = function (name, referenceModule) {
			var moduleInfo = getModuleInfo(name + '/x', referenceModule),
				url = moduleInfo.url;

			// "/x.js" since getModuleInfo automatically appends ".js" and we appended "/x" to make name look like a module id
			return url.slice(0, url.length - 5);
		},

		makeCjs = function (mid) {
			return modules[mid] = {
				mid: mid,
				injected: true,
				executed: true
			};
		},

		cjsRequireModule = makeCjs('require'),
		cjsExportsModule = makeCjs('exports'),
		cjsModuleModule = makeCjs('module'),

		EXECUTING = 'executing',
		abortExec = {},
		executedSomething = false;

	has.add('debug-circular-dependencies', true);
	if (has('debug-circular-dependencies')) {
		var circularTrace = [];
	}

	var execModule = function (module) {
			// run the dependency array, then run the factory for module
			if (module.executed === EXECUTING) {
				// for circular dependencies, assume the first module encountered was executed OK
				// modules that circularly depend on a module that has not run its factory will get
				// the premade cjs.exports===module.result. They can take a reference to this object and/or
				// add properties to it. When the module finally runs its factory, the factory can
				// read/write/replace this object. Notice that so long as the object isn't replaced, any
				// reference taken earlier while walking the deps list is still valid.
				has('debug-circular-dependencies') && console.warn('Circular dependency: ' + circularTrace.concat(module.mid).join(' -> '));
				return module.cjs.exports;
			}

			if (!module.executed) {
				// TODO: This seems like an incorrect condition inference. Originally it was simply !module.def
				// which caused modules with falsy defined values to never execute.
				if (!module.def && !module.deps) {
					return abortExec;
				}

				var deps = module.deps,
					factory = module.def,
					result,
					args;

				has('debug-circular-dependencies') && circularTrace.push(module.mid);

				module.executed = EXECUTING;
				args = deps.map(function (dep) {
					if (result !== abortExec) {
						result = ((dep === cjsRequireModule) ? createRequire(module) :
									((dep === cjsExportsModule) ? module.cjs.exports :
										((dep === cjsModuleModule) ? module.cjs :
											execModule(dep))));
					}
					return result;
				});

				if (result === abortExec) {
					module.executed = false;
					has('debug-circular-dependencies') && circularTrace.pop();
					return abortExec;
				}

				result = typeof factory === 'function' ? factory.apply(null, args) : factory;

				// TODO: But of course, module.cjs always exists.
				// Assign the new module.result to result so plugins can use exports
				// to define their interface; the plugin checks below use result
				result = module.result = result === undefined && module.cjs ? module.cjs.exports : result;
				module.executed = true;
				executedSomething = true;

				// delete references to synthetic modules
				if (module.gc) {
					delete modules[module.mid];
				}

				// if result defines load, just assume it's a plugin; harmless if the assumption is wrong
				result && result.load && [ 'dynamic', 'normalize', 'load' ].forEach(function (k) {
					module[k] = result[k];
				});

				// for plugins, resolve the loadQ
				forEach(module.loadQ, function (pseudoPluginResource) {
					// manufacture and insert the real module in modules
					var prid = resolvePluginResourceId(module, pseudoPluginResource.prid, pseudoPluginResource.req),
						mid = module.dynamic ? pseudoPluginResource.mid.replace(/\*$/, prid) : (module.mid + '!' + prid),
						pluginResource = mix(mix({}, pseudoPluginResource), { mid: mid, prid: prid });

					if (!modules[mid]) {
						// create a new (the real) plugin resource and inject it normally now that the plugin is on board
						injectPlugin(modules[mid] = pluginResource);
					} // else this was a duplicate request for the same (plugin, rid) for a nondynamic plugin

					// pluginResource is really just a placeholder with the wrong mid (because we couldn't calculate it until the plugin was on board)
					// fix() replaces the pseudo module in a resolved deps array with the real module
					// lastly, mark the pseudo module as arrived and delete it from modules
					pseudoPluginResource.fix(modules[mid]);
					--waitingCount;
					delete modules[pseudoPluginResource.mid];
				});
				delete module.loadQ;

				has('debug-circular-dependencies') && circularTrace.pop();
			}

			// at this point the module is guaranteed fully executed
			return module.result;
		},

		checkCompleteGuard = 0,

		guardCheckComplete = function (proc) {
			++checkCompleteGuard;
			proc();
			--checkCompleteGuard;
			!defArgs && !waitingCount && !execQ.length && !checkCompleteGuard && signal('idle', []);
		},

		checkComplete = function () {
			// keep going through the execQ as long as at least one factory is executed
			// plugins, recursion, cached modules all make for many execution path possibilities
			!checkCompleteGuard && guardCheckComplete(function () {
				for (var module, i = 0; i < execQ.length;) {
					module = execQ[i];
					if (module.executed === true) {
						execQ.splice(i, 1);
					}
					else {
						executedSomething = false;
						execModule(module);
						if (executedSomething) {
							// something was executed; this indicates the execQ was modified, maybe a
							// lot (for example a later module causes an earlier module to execute)
							i = 0;
						}
						else {
							// nothing happened; check the next module in the exec queue
							i++;
						}
					}
				}
			});
		},

		injectPlugin = function (module) {
			// injects the plugin module given by module; may have to inject the plugin itself
			var plugin = module.plugin,
				onLoad = function (def) {
					module.result = def;
					--waitingCount;
					module.executed = true;
					checkComplete();
				};

			if (plugin.load) {
				plugin.load(module.prid, module.req, onLoad);
			}
			else if (plugin.loadQ) {
				plugin.loadQ.push(module);
			}
			else {
				// the unshift instead of push is important: we don't want plugins to execute as
				// dependencies of some other module because this may cause circles when the plugin
				// loadQ is run; also, generally, we want plugins to run early since they may load
				// several other modules and therefore can potentially unblock many modules
				plugin.loadQ = [module];
				execQ.unshift(plugin);
				injectModule(module, plugin);
			}
		},

		injectModule = function (parent, module) {
			// TODO: This is for debugging, we should bracket it
			if (!module) {
				module = parent;
				parent = null;
			}

			if (module.plugin) {
				injectPlugin(module);
			}
			else if (!module.injected) {
				var cached,
					onLoadCallback = function (node) {
						// defArgs is an array of [dependencies, factory]
						consumePendingCacheInsert(module);

						if (has('loader-ie9-compat') && node) {
							defArgs = node.defArgs;
						}

						// non-amd module
						if (!defArgs) {
							defArgs = [ [], undefined ];
						}

						defineModule(module, defArgs[0], defArgs[1]);
						defArgs = null;

						// checkComplete!==false holds the idle signal; we're not idle if we're injecting dependencies
						guardCheckComplete(function () {
							forEach(module.deps, injectModule.bind(null, module));
						});
						checkComplete();
					};

				++waitingCount;
				module.injected = true;
				if ((cached = cache[module.mid])) {
					try {
						cached();
						onLoadCallback();
						return;
					}
					catch (error) {
						// If a cache load fails, notify and then retrieve using injectUrl
						signal('cachedThrew', [ error, module ]);
					}
				}
				injectUrl(module.url, onLoadCallback, module, parent);
			}
		},

		resolveDeps = function (deps, module, referenceModule) {
			// resolve deps with respect to this module
			return deps.map(function (dep, i) {
				var result = getModule(dep, referenceModule);
				if (result.fix) {
					result.fix = function (m) {
						module.deps[i] = m;
					};
				}
				return result;
			});
		},

		defineModule = function (module, deps, def) {
			--waitingCount;
			return mix(module, {
				def: def,
				deps: resolveDeps(deps, module, module),
				cjs: {
					id: module.mid,
					uri: module.url,
					exports: (module.result = {}),
					setExports: function (exports) {
						module.cjs.exports = exports;
					}
				}
			});
		};

	var setGlobals,
		injectUrl;
	if (has('host-browser')) {
		injectUrl = function (url, callback, module, parent) {
			// insert a script element to the insert-point element with src=url;
			// apply callback upon detecting the script has loaded.
			var node = document.createElement('script'),
				handler = function (event) {
					document.head.removeChild(node);

					if (event.type === 'load') {
						has('loader-ie9-compat') ? callback(node) : callback();
					}
					else {
						throw new Error('Failed to load module ' + module.mid + ' from ' + url + (parent ? ' (parent: ' + parent.mid + ')' : ''));
					}
				};

			node.addEventListener('load', handler, false);
			node.addEventListener('error', handler, false);

			node.charset = 'utf-8';
			node.src = url;
			document.head.appendChild(node);
		};

		setGlobals = function (require, define) {
			this.require = require;
			this.define = define;
		};
	}
	else if (has('host-node')) {
		var vm = require('vm'),
			fs = require('fs');

		// retain the ability to get node's require
		req.nodeRequire = require;
		injectUrl = function (url, callback, module, parent) {
			fs.readFile(url, 'utf8', function (error, data) {
				if (error) {
					throw new Error('Failed to load module ' + module.mid + ' from ' + url + (parent ? ' (parent: ' + parent.mid + ')' : ''));
				}

				vm.runInThisContext(data, url);
				callback();
			});
		};

		setGlobals = function (require, define) {
			module.exports = this.require = require;
			this.define = define;
		};
	}
	else {
		throw new Error('Unsupported platform');
	}

	has.add('debug-loader-internals', true);
	if (has('debug-loader-internals')) {
		req.inspect = function (name) {
			/*jshint evil: true */
			// TODO: Should this use console.log so people do not get any bright ideas about using this in apps?
			return eval(name);
		};
	}

	mix(req, {
		signal: function () {},
		toAbsMid: toAbsMid,
		toUrl: toUrl,

		cache: function (cache) {
			consumePendingCacheInsert();
			pendingCacheInsert = cache;
		}
	});

	Object.defineProperty(req, 'baseUrl', {
		get: function () {
			return baseUrl;
		},
		enumerable: true
	});

	has.add('loader-cjs-wrapping', true);
	if (has('loader-cjs-wrapping')) {
		var comments = /\/\*[\s\S]*?\*\/|\/\/.*$/mg,
			requireCall = /require\s*\(\s*(["'])(.*?[^\\])\1\s*\)/g;
	}

	/**
	 * @param deps //(array of commonjs.moduleId, optional)
	 * @param factory //(any)
	 */
	var define = mix(function (deps, factory) {
		if (arguments.length === 1) {
			if (has('loader-cjs-wrapping') && typeof deps === 'function') {
				factory = deps;
				deps = [ 'require', 'exports', 'module' ];

				// Scan factory for require() calls and add them to the
				// list of dependencies
				factory.toString()
					.replace(comments, '')
					.replace(requireCall, function () {
						deps.push(/* mid */ arguments[2]);
					});
			}
			else if (/* define(value) */ !Array.isArray(deps)) {
				var value = deps;
				deps = [];
				factory = function () {
					return value;
				};
			}
		}

		if (has('loader-ie9-compat')) {
			for (var i = document.scripts.length - 1, script; (script = document.scripts[i]); --i) {
				if (script.readyState === 'interactive') {
					script.defArgs = [ deps, factory ];
					break;
				}
			}
		}
		else {
			defArgs = [ deps, factory ];
		}
	}, {
		amd: { vendor: 'dojotoolkit.org' }
	});

	setGlobals(req, define);
})();
