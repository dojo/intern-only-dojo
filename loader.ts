import core = require('./interfaces');

declare var process:any;
declare var require:<ModuleType>(moduleId:string) => ModuleType;
declare var module:{ exports:any; };

(function ():void {
	var req:core.IRootRequire = <core.IRootRequire> function (config:any, dependencies?:any, callback?:core.IRequireCallback):void {
		if (/* require([], cb) */ Array.isArray(config) || /* require(mid) */ typeof config === 'string') {
			callback = <core.IRequireCallback> dependencies;
			dependencies = <string[]> config;
			config = {};
		}

		if (has('loader-configurable')) {
			configure(config);
		}

		contextRequire(dependencies, callback);
	};

	var has:core.has = req.has = (function ():core.has {
		var hasCache:{ [name:string]:any; } = Object.create(null);
		var global:Window = this;
		var document:HTMLDocument = global.document;
		var element:HTMLDivElement = document && document.createElement('div');

		var has:core.has = <core.has> function(name:string):any {
			return typeof hasCache[name] === 'function' ? (hasCache[name] = hasCache[name](global, document, element)) : hasCache[name];
		};

		has.add = function (name:string, test:any, now:boolean, force:boolean):void {
			(!(name in hasCache) || force) && (hasCache[name] = test);
			now && has(name);
		};

		return has;
	})();

	has.add('host-browser', typeof document !== 'undefined' && typeof location !== 'undefined');
	has.add('host-node', typeof process === 'object' && process.versions && process.versions.node);
	has.add('debug', true);

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
		var configure:(config:core.IConfig) => void = req.config = function (config:core.IConfig):void {
			// TODO: Expose all properties on req as getter/setters? Plugin modules like dojo/node being able to
			// retrieve baseUrl is important. baseUrl is defined as a getter currently.
			baseUrl = (config.baseUrl || baseUrl).replace(/\/*$/, '/');

			forEach(config.packages, function (p:core.IPackage):void {
				// Allow shorthand package definition, where name and location are the same
				if (typeof p === 'string') {
					p = { name: <string> p, location: <string> p };
				}

				if (p.location != null) {
					p.location = p.location.replace(/\/*$/, '/');
				}

				packs[p.name] = p;
			});

			function computeMapProg(map:core.IModuleMapItem):core.IMapItem[] {
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

				var result:core.IMapItem[] = [];

				for (var moduleId in map) {
					var value:any = (<any> map)[moduleId];
					var valueIsMapReplacement:boolean = typeof value === 'object';

					var item = <core.IMapItem> {
						0: moduleId,
						1: valueIsMapReplacement ? computeMapProg(value) : value,
						2: new RegExp('^' + moduleId.replace(/[-\[\]{}()*+?.,\\\^$|#\s]/g, '\\$&') + '(?:\/|$)'),
						3: moduleId.length
					};
					result.push(item);

					if (valueIsMapReplacement && moduleId === '*') {
						(<core.IMapRoot>result).star = item[1];
					}
				}

				result.sort(function (lhs:any, rhs:any):number {
					return rhs[3] - lhs[3];
				});

				return result;
			}

			mix(map, config.map);

			mapProgs = computeMapProg(map);

			// Note that old paths will get destroyed if reconfigured
			config.paths && (pathsMapProg = computeMapProg(config.paths));
		};
	}

	//
	// loader state data
	//

	// AMD baseUrl config
	var baseUrl:string = './';

	// a map from pid to package configuration object
	var packs:core.IPackageMap = {};

	// list of (from-path, to-path, regex, length) derived from paths;
	// a "program" to apply paths; see computeMapProg
	var pathsMapProg:core.IPathMap[] = [];

	// AMD map config variable
	var map:core.IModuleMap = {};

	// array of quads as described by computeMapProg; map-key is AMD map key, map-value is AMD map value
	var mapProgs:core.IMapRoot = [];

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
	var modules:{ [moduleId:string]:core.IModule; } = {};

	// hash:(mid | url)-->(function | string)
	//
	// A cache of resources. The resources arrive via a require.cache application, which takes a hash from either mid --> function or
	// url --> string. The function associated with mid keys causes the same code to execute as if the module was script injected.
	//
	// Both kinds of key-value pairs are entered into cache via the function consumePendingCache, which may relocate keys as given
	// by any mappings *iff* the cache was received as part of a module resource request.
	var cache:{ [moduleId:string]:any; } = {};

	// hash:(mid | url)-->(function | string)
	//
	// Gives a set of cache modules pending entry into cache. When cached modules are published to the loader, they are
	// entered into pendingCacheInsert; modules are then pressed into cache upon (1) AMD define or (2) upon receiving another
	// independent set of cached modules. (1) is the usual case, and this case allows normalizing mids given in the pending
	// cache for the local configuration, possibly relocating modules.
	var pendingCacheInsert:{ [moduleId:string]:any; } = {};

	function forEach<T>(array:T[], callback:(value:T, index:number, array:T[]) => void):void {
		array && array.forEach(callback);
	}

	function mix(target:{}, source:{}):{} {
		for (var key in source) {
			(<any>target)[key] = (<any>source)[key];
		}
		return target;
	}

	function signal(type:string, event:any):void {
		req.signal.apply(req, arguments);
	}

	function consumePendingCacheInsert(referenceModule?:core.IModule):void {
		var item:any;

		for (var key in pendingCacheInsert) {
			item = pendingCacheInsert[key];

			cache[typeof item === 'string' ? toUrl(key, referenceModule) : getModuleInfo(key, referenceModule).mid] = item;
		}

		pendingCacheInsert = {};
	}

	var uidGenerator:number = 0;

	function contextRequire(moduleId:string, unused?:void, referenceModule?:core.IModule):core.IModule;
	function contextRequire(dependencies:string[], callback:core.IRequireCallback, referenceModule?:core.IModule):core.IModule;
	function contextRequire(a1:any, a2:any, referenceModule?:core.IModule):core.IModule {
		var module:core.IModule;
		if (typeof a1 === 'string') {
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
			guardCheckComplete(function ():void {
				forEach(module.deps, injectModule.bind(null, module));
			});
			execQ.push(module);
			checkComplete();
		}
		return module;
	}

	function createRequire(module:core.IModule):core.IRequire {
		var result:core.IRequire = (!module && req) || module.require;
		if (!result) {
			module.require = result = <core.IRequire> function (a1:any, a2:any):core.IModule {
				return contextRequire(a1, a2, module);
			};
			mix(mix(result, req), {
				toUrl: function (name:string):string {
					return toUrl(name, module);
				},
				toAbsMid: function (mid:string):string {
					return toAbsMid(mid, module);
				}
			});
		}
		return result;
	}

	// The list of modules that need to be evaluated.
	var execQ:core.IModule[] = [];

	// The arguments sent to loader via AMD define().
	var defArgs:any[] = null;

	// the number of modules the loader has injected but has not seen defined
	var waitingCount:number = 0;

	function runMapProg(targetMid:string, map:core.IMapItem[]):core.IMapSource {
		// search for targetMid in map; return the map item if found; falsy otherwise
		if (map) {
			for (var i = 0, j = map.length; i < j; ++i) {
				if (map[i][2].test(targetMid)) {
					return map[i];
				}
			}
		}

		return null;
	}

	function compactPath(path:string):string {
		var result:string[] = [];
		var segment:string;
		var lastSegment:string;
		var splitPath:string[] = path.replace(/\\/g, '/').split('/');

		while (splitPath.length) {
			segment = splitPath.shift();
			if (segment === '..' && result.length && lastSegment !== '..') {
				result.pop();
				lastSegment = result[result.length - 1];
			}
			else if (segment !== '.') {
				result.push((lastSegment = segment));
			} // else ignore "."
		}

		return result.join('/');
	}

	function getModuleInfo(mid:string, referenceModule?:core.IModule):core.IModule {
		var match:string[];
		var pid:string;
		var pack:core.IPackage;
		var midInPackage:string;
		var mapItem:core.IMapItem;
		var url:string;
		var result:core.IModule;

		// relative module ids are relative to the referenceModule; get rid of any dots
		mid = compactPath(/^\./.test(mid) && referenceModule ? (referenceModule.mid + '/../' + mid) : mid);
		// at this point, mid is an absolute mid

		// if there is a reference module, then use its module map, if one exists; otherwise, use the global map.
		// see computeMapProg for more information on the structure of the map arrays
		var moduleMap:core.IMapItem = referenceModule && runMapProg(referenceModule.mid, mapProgs);
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
			result = <core.IModule> <any> {
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
	}

	function resolvePluginResourceId(plugin:core.IModule, prid:string, contextRequire:core.IRequire):string {
		return plugin.normalize ? plugin.normalize(prid, contextRequire.toAbsMid) : contextRequire.toAbsMid(prid);
	}

	function getModule(mid:string, referenceModule?:core.IModule):core.IModule {
		// compute and construct (if necessary) the module implied by the mid with respect to referenceModule
		var match:string[];
		var plugin:core.IModule;
		var prid:string;
		var result:core.IModule;
		var contextRequire:core.IRequire;
		var loaded:boolean;

		match = mid.match(/^(.+?)\!(.*)$/);
		if (match) {
			// name was <plugin-module>!<plugin-resource-id>
			plugin = getModule(match[1], referenceModule);
			loaded = Boolean(plugin.load);

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
			result = <core.IModule> <any> {
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
		return modules[result.mid] || (modules[result.mid] = result);
	}

	function toAbsMid(mid:string, referenceModule:core.IModule):string {
		return getModuleInfo(mid, referenceModule).mid;
	}

	function toUrl(name:string, referenceModule:core.IModule):string {
		var moduleInfo:core.IModule = getModuleInfo(name + '/x', referenceModule);
		var url:string = moduleInfo.url;

		// "/x.js" since getModuleInfo automatically appends ".js" and we appended "/x" to make name look like a module id
		return url.slice(0, url.length - 5);
	}

	function makeCjs(mid:string):core.IModule {
		// TODO: Intentional incomplete coercion to core.IModule might be a bad idea
		var module:core.IModule = modules[mid] = <core.IModule> <any> {
			mid: mid,
			injected: true,
			executed: true
		};

		return module;
	}

	var cjsRequireModule:core.IModule = makeCjs('require');
	var cjsExportsModule:core.IModule = makeCjs('exports');
	var cjsModuleModule:core.IModule = makeCjs('module');

	var EXECUTING:string = 'executing';
	var abortExec:Object = {};
	var executedSomething:boolean = false;

	has.add('loader-debug-circular-dependencies', true);
	if (has('loader-debug-circular-dependencies')) {
		var circularTrace:string[] = [];
	}

	function execModule(module:core.IModule):any {
		// run the dependency array, then run the factory for module
		if (module.executed === EXECUTING) {
			// for circular dependencies, assume the first module encountered was executed OK
			// modules that circularly depend on a module that has not run its factory will get
			// the premade cjs.exports===module.result. They can take a reference to this object and/or
			// add properties to it. When the module finally runs its factory, the factory can
			// read/write/replace this object. Notice that so long as the object isn't replaced, any
			// reference taken earlier while walking the deps list is still valid.
			if (has('loader-debug-circular-dependencies') && module.deps.indexOf(cjsExportsModule) === -1) {
				console.warn('Circular dependency: ' + circularTrace.concat(module.mid).join(' -> '));
			}

			return module.cjs.exports;
		}

		if (!module.executed) {
			// TODO: This seems like an incorrect condition inference. Originally it was simply !module.def
			// which caused modules with falsy defined values to never execute.
			if (!module.def && !module.deps) {
				return abortExec;
			}

			var deps:core.IModule[] = module.deps;
			var factory:core.IFactory = module.def;
			var result:any;
			var args:any[];

			has('loader-debug-circular-dependencies') && circularTrace.push(module.mid);

			module.executed = EXECUTING;
			args = deps.map(function (dep:core.IModule):any {
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
				has('loader-debug-circular-dependencies') && circularTrace.pop();
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
				modules[module.mid] = undefined;
			}

			// if result defines load, just assume it's a plugin; harmless if the assumption is wrong
			result && result.load && [ 'dynamic', 'normalize', 'load' ].forEach(function (key:string):void {
				(<any>module)[key] = (<any>result)[key];
			});

			// for plugins, resolve the loadQ
			forEach(module.loadQ, function (pseudoPluginResource:core.IModule):void {
				// manufacture and insert the real module in modules
				var prid:string = resolvePluginResourceId(module, pseudoPluginResource.prid, pseudoPluginResource.req);
				var mid:string = module.dynamic ? pseudoPluginResource.mid.replace(/\*$/, prid) : (module.mid + '!' + prid);
				var pluginResource:core.IModule = <core.IModule> mix(mix({}, pseudoPluginResource), { mid: mid, prid: prid });

				if (!modules[mid]) {
					// create a new (the real) plugin resource and inject it normally now that the plugin is on board
					injectPlugin((modules[mid] = pluginResource));
				} // else this was a duplicate request for the same (plugin, rid) for a nondynamic plugin

				// pluginResource is really just a placeholder with the wrong mid (because we couldn't calculate it until the plugin was on board)
				// fix() replaces the pseudo module in a resolved deps array with the real module
				// lastly, mark the pseudo module as arrived and delete it from modules
				pseudoPluginResource.fix(modules[mid]);
				--waitingCount;
				modules[pseudoPluginResource.mid] = undefined;
			});
			module.loadQ = undefined;

			has('loader-debug-circular-dependencies') && circularTrace.pop();
		}

		// at this point the module is guaranteed fully executed
		return module.result;
	}

	var checkCompleteGuard:number = 0;

	// TODO: Figure out what proc actually is
	function guardCheckComplete(proc:Function):void {
		++checkCompleteGuard;
		proc();
		--checkCompleteGuard;
		!defArgs && !waitingCount && !execQ.length && !checkCompleteGuard && signal('idle', []);
	}

	function checkComplete():void {
		// keep going through the execQ as long as at least one factory is executed
		// plugins, recursion, cached modules all make for many execution path possibilities
		!checkCompleteGuard && guardCheckComplete(function ():void {
			for (var module:core.IModule, i = 0; i < execQ.length; ) {
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
	}

	function injectPlugin(module:core.IModule):void {
		// injects the plugin module given by module; may have to inject the plugin itself
		var plugin:core.IModule = module.plugin;
		var onLoad = function (def:any):void {
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
	}

	function injectModule(parent:core.IModule, module:core.IModule):void {
		// TODO: This is for debugging, we should bracket it
		if (!module) {
			module = parent;
			parent = null;
		}

		if (module.plugin) {
			injectPlugin(module);
		}
		else if (!module.injected) {
			var cached:core.IFactory;
			var onLoadCallback = function (node?:HTMLScriptElement):void {
				// defArgs is an array of [dependencies, factory]
				consumePendingCacheInsert(module);

				if (has('loader-ie9-compat') && node) {
					defArgs = (<any>node).defArgs;
				}

				// non-amd module
				if (!defArgs) {
					defArgs = [ [], undefined ];
				}

				defineModule(module, defArgs[0], defArgs[1]);
				defArgs = null;

				// checkComplete!==false holds the idle signal; we're not idle if we're injecting dependencies
				guardCheckComplete(function ():void {
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
	}

	function resolveDeps(deps:string[], module:core.IModule, referenceModule:core.IModule):core.IModule[] {
		// resolve deps with respect to this module
		return deps.map(function (dep:string, i:number):core.IModule {
			var result:core.IModule = getModule(dep, referenceModule);
			if (result.fix) {
				result.fix = function (m:core.IModule):void {
					module.deps[i] = m;
				};
			}
			return result;
		});
	}

	function defineModule(module:core.IModule, deps:string[], def:core.IFactory):core.IModule {
		--waitingCount;
		return <core.IModule> mix(module, {
			def: def,
			deps: resolveDeps(deps, module, module),
			cjs: {
				id: module.mid,
				uri: module.url,
				exports: (module.result = {}),
				setExports: function (exports:any):void {
					module.cjs.exports = exports;
				}
			}
		});
	}

	// PhantomJS
	has.add('function-bind', Boolean(Function.prototype.bind));
	if (!has('function-bind')) {
		injectModule.bind = function (thisArg:any):typeof injectModule {
			var slice = Array.prototype.slice;
			var args:any[] = slice.call(arguments, 1);

			return function ():void {
				return injectModule.apply(thisArg, args.concat(slice.call(arguments, 0)));
			};
		};
	}

	var setGlobals:(require:core.IRequire, define:core.IDefine) => void;
	var injectUrl:(url:string, callback:(node?:HTMLScriptElement) => void, module:core.IModule, parent?:core.IModule) => void;
	if (has('host-browser')) {
		injectUrl = function (url:string, callback:(node?:HTMLScriptElement) => void, module:core.IModule, parent?:core.IModule):void {
			// insert a script element to the insert-point element with src=url;
			// apply callback upon detecting the script has loaded.
			var node:HTMLScriptElement = document.createElement('script');
			var handler:EventListener = function (event:Event):void {
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

		setGlobals = function (require:core.IRequire, define:core.IDefine):void {
			this.require = require;
			this.define = define;
		};
	}
	else if (has('host-node')) {
		var vm:any = require('vm');
		var fs:any = require('fs');

		// retain the ability to get node's require
		req.nodeRequire = require;
		injectUrl = function (url:string, callback:(node?:HTMLScriptElement) => void, module:core.IModule, parent?:core.IModule):void {
			fs.readFile(url, 'utf8', function (error:Error, data:string):void {
				if (error) {
					console.log(module, parent);
					throw new Error('Failed to load module ' + module.mid + ' from ' + url + (parent ? ' (parent: ' + parent.mid + ')' : ''));
				}

				vm.runInThisContext(data, url);
				callback();
			});
		};

		setGlobals = function (require:core.IRequire, define:core.IDefine):void {
			module.exports = this.require = require;
			this.define = define;
		};
	}
	else {
		throw new Error('Unsupported platform');
	}

	has.add('loader-debug-internals', true);
	if (has('loader-debug-internals')) {
		req.inspect = function (name:string):any {
			/* tslint:disable:no-eval */
			// TODO: Should this use console.log so people do not get any bright ideas about using this in apps?
			return eval(name);
			/* tslint:enable:no-eval */
		};
	}

	has.add('loader-undef', true);
	if (has('loader-undef')) {
		req.undef = function (id:string):void {
			if (modules[id]) {
				modules[id] = undefined;
			}
		};
	}

	mix(req, {
		signal: function ():void {},
		toAbsMid: toAbsMid,
		toUrl: toUrl,

		cache: function (cache:{ [moduleId:string]:any; }):void {
			consumePendingCacheInsert();
			pendingCacheInsert = cache;
		}
	});

	Object.defineProperty(req, 'baseUrl', {
		get: function ():string {
			return baseUrl;
		},
		enumerable: true
	});

	has.add('loader-cjs-wrapping', true);
	if (has('loader-cjs-wrapping')) {
		var comments:RegExp = /\/\*[\s\S]*?\*\/|\/\/.*$/mg;
		var requireCall:RegExp = /require\s*\(\s*(["'])(.*?[^\\])\1\s*\)/g;
	}

	has.add('loader-explicit-mid', true);

	/**
	 * @param deps //(array of commonjs.moduleId, optional)
	 * @param factory //(any)
	 */
	var define:core.IDefine = <core.IDefine> mix(function (deps:string[], factory:core.IFactory):void {
		if (has('loader-explicit-mid') && arguments.length === 3) {
			var id:string = <any> deps;
			deps = <any> factory;
			factory = arguments[2];

			var module:core.IModule = getModule(id);
			module.injected = true;
			defineModule(module, deps, factory);
		}

		if (arguments.length === 1) {
			if (has('loader-cjs-wrapping') && typeof deps === 'function') {
				factory = <any> deps;
				deps = [ 'require', 'exports', 'module' ];

				// Scan factory for require() calls and add them to the
				// list of dependencies
				factory.toString()
					.replace(comments, '')
					.replace(requireCall, function ():string {
						deps.push(/* mid */ arguments[2]);
						return arguments[0];
					});
			}
			else if (/* define(value) */ !Array.isArray(deps)) {
				var value:any = deps;
				deps = [];
				factory = function ():any {
					return value;
				};
			}
		}

		if (has('loader-ie9-compat')) {
			for (var i = document.scripts.length - 1, script:HTMLScriptElement; (script = <HTMLScriptElement>document.scripts[i]); --i) {
				if (script.readyState === 'interactive') {
					(<any>script).defArgs = [ deps, factory ];
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
