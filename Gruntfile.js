/* jshint node:true */

var path = require('path'),
	_ = require('lodash'),
	globule = require('globule');

module.exports = function (grunt) {
	grunt.loadNpmTasks('grunt-typescript');
	grunt.loadNpmTasks('grunt-contrib-watch');
	grunt.loadNpmTasks('grunt-contrib-clean');
	grunt.loadNpmTasks('intern');

	grunt.initConfig({
		all: [ '**/*.ts', '!**/*.d.ts', '!node_modules/**/*.ts' ],
		onlyTests: [ 'tests/**/*.ts', '!tests/**/*.d.ts' ],

		defaultLib: [ '<%= all %>', '!tests/**/*.ts' ],
		defaultTests: [ '<%= onlyTests %>' ],

		typescript: {
			options: {
				target: 'es5',
				module: 'amd',
				sourcemap: true,
				noImplicitAny: true
			},
			lib: {
				src: [ '<%= defaultLib %>' ],
				options: {
					declaration: true
				}
			},
			tests: {
				src: [ '<%= defaultTests %>' ]
			}
		},
		intern: {
			/*local: {
				options: {
					runType: 'runner',
					config: 'tests/intern.local',
					reporters: ['runner']
				}
			},*/
			remote: {
				options: {
					runType: 'runner',
					config: 'tests/config',
					reporters: ['runner']
				}
			},
			proxy: {
				options: {
					runType: 'runner',
					proxyOnly: true,
					config: 'tests/config.proxy',
					reporters: ['runner']
				}
			},
			node: {
				options: {
					runType: 'client',
					config: 'tests/config',
					reporters: ['console']
				}
			}
		},
		watch: {
			all: {
				files: [ '<%= all %>', 'interfaces.d.ts', 'tests/**/*.d.ts' ],
				tasks: [ 'typescript:lib', 'typescript:tests' ],
				options: {
					spawn: false
				}
			}
		},
		clean: {
			typescript: {
				src: [
					'**/*.js', '**/*.d.ts', '**/*.js.map', 'sauce_connect.log', 'tscommand.tmp.txt',
					'!node_modules/**/*', '!Gruntfile.js', '!loader.js',
					'!interfaces.d.ts', '!tests/*.d.ts', '!tests/**/all.js'
				]
			}
		}
	});

	var previousForceState = grunt.option('force');

	grunt.registerTask('force', function (set) {
		if (set === 'on') {
			grunt.option('force', true);
		}
		else if (set === 'off') {
			grunt.option('force', false);
		}
		else if (set === 'restore') {
			grunt.option('force', previousForceState);
		}
	});

	grunt.registerTask('build', [ 'typescript:lib' ]);

	grunt.registerTask('test', function (target) {
		if (!target || target === 'coverage' || target === 'nocompile') {
			target = 'remote';
		}

		function addReporter(reporter) {
			var property = 'intern.' + target + '.options.reporters',
				value = grunt.config.get(property);

			if (value.indexOf(reporter) !== -1) {
				return;
			}

			value.push(reporter);
			grunt.config.set(property, value);
		}
		if (this.flags.coverage) {
			addReporter('lcovhtml');
		}
		if (this.flags.console) {
			addReporter('console');
		}

		if (this.flags.recompile) {
			grunt.task.run('typescript');
		}
		grunt.task.run('intern:' + target);
	});

	grunt.registerTask('default', function () {
		var dependsOn = {},
			commentsRE = /\/\*[\s\S]*?\*\/|\/\/.*$/mg,
			importRE = /import\s+\w+\s+=\s+require\(\s*(['"])(\..*?[^\\])\1\s*\)/g,
			referenceRE = /\/\/\/\s+<reference\s+path="(.*?)\.d\.ts"\s*?\/>/g;

		function analyzeDependencies(filepath, action) {
			if (typeof action === 'string' && action !== 'added') {
				for (var key in dependsOn) {
					if (dependsOn[key].length) {
						var index = dependsOn[key].indexOf(filepath);
						if (index > -1) {
							dependsOn[key].splice(index, 1);
						}
					}
				}
			}
			if (action === 'removed') {
				return;
			}
			var deps = [];
			grunt.file.read(filepath)
				.replace(referenceRE, function (whole, dep) {
					deps.push(dep);

					return whole;
				})
				.replace(commentsRE, '')
				.replace(importRE, function (whole, quote, dep) {
					deps.push(dep);

					return whole;
				});

			if (!deps.length) {
				return;
			}

			var dirname = path.dirname(filepath);
			deps.forEach(function (dep) {
				dep = path.normalize(path.join(dirname, dep));

				if (!dependsOn[dep]) {
					dependsOn[dep] = [filepath];
				}
				else {
					dependsOn[dep].push(filepath);
				}
			});
		}

		function getDependents(filepath, seen) {
			filepath = filepath.replace(/(?:\.d)?\.ts$/, '');
			seen = seen || [];

			var res = [];
			if (seen.indexOf(filepath) > -1) {
				return res;
			}

			seen.push(filepath);
			if (filepath in dependsOn) {
				dependsOn[filepath].forEach(function (filepath) {
					res.push(filepath);
					var _res = getDependents(filepath, seen);
					if (_res.length) {
						res.push.apply(res, _res);
					}
				});
			}

			return res;
		}

		var patterns = _.chain(grunt.config.get('watch.all.files')).flatten().map(function (pattern) {
			return grunt.config.process(pattern);
		}).value();

		var files = globule.find(patterns);

		files.forEach(analyzeDependencies);

		var recompile = {};
		var onChange = grunt.util._.debounce(function () {
			var files = Object.keys(recompile),
				libs = grunt.file.match(grunt.config.get('defaultLib'), files),
				tests = grunt.file.match(grunt.config.get('defaultTests'), files);

			grunt.config.set('typescript.lib.src', libs);
			grunt.config.set('typescript.tests.src', tests);

			recompile = {};
		}, 200);

		grunt.event.on('watch', function (action, filepath, task) {
			if (grunt.file.isFile(filepath)) {
				recompile[filepath] = action;

				analyzeDependencies(filepath, action);

				getDependents(filepath).forEach(function (filepath) {
					recompile[filepath] = true;
				});
			}
			onChange();
		});

		grunt.task.run([ 'force:on', 'typescript', 'force:restore', 'watch' ]);
	});
};
