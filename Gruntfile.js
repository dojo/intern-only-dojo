/* jshint node:true */
module.exports = function (grunt) {
	grunt.loadNpmTasks('grunt-ts');
	grunt.loadNpmTasks('grunt-contrib-watch');
	grunt.loadNpmTasks('grunt-contrib-clean');
	grunt.loadNpmTasks('intern');

	grunt.initConfig({
		ts: {
			lib: {
				src: [ '**/*.ts', '!**/*.d.ts', '!node_modules/**/*.ts', '!tests/**/*.ts' ],
				outDir: '.',
				options: {
					target: 'es5',
					module: 'amd',
					declaration: true,
					noImplicitAny: true
				}
			},
			tests: {
				src: [ 'tests/**/*.ts', '!tests/**/*.d.ts' ],
				outDir: 'tests',
				options: {
					target: 'es5',
					module: 'amd',
					noImplicitAny: true
				}
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
			lib: {
				files: [ '**/*.ts', '!**/*.d.ts', 'interfaces.d.ts', '!tests/**/*.ts', '!node_modules/**/*.ts' ],
				tasks: [ 'ts:lib', 'ts:tests' ]
			},
			tests: {
				files: [ 'tests/**/*.ts' ],
				tasks: [ 'ts:tests' ]
			}
		},
		clean: {
			ts: {
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

	grunt.registerTask('default', [ 'force:on', 'ts', 'force:restore', 'watch' ]);
	grunt.registerTask('build', [ 'ts:lib' ]);

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
			grunt.task.run('ts');
		}
		grunt.task.run('intern:' + target);
	});
};
