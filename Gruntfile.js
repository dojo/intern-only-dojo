/* jshint node:true */

module.exports = function (grunt) {
	grunt.loadNpmTasks('grunt-ts');
	grunt.loadNpmTasks('grunt-contrib-clean');
	grunt.loadNpmTasks('intern');

	grunt.initConfig({
		ts: {
			options: {
				failOnTypeErrors: true,
				fast: process.env.CONTINUOUS_INTEGRATION ? 'never' : 'watch',
				module: 'commonjs',
				noImplicitAny: true,
				sourceMap: true,
				target: 'es5'
			},

			default: {
				src: [ '**/*.ts', '!**/*.d.ts', '!tests/**/*.ts', '!node_modules/**/*.ts', '!loader.ts' ]
			},

			loader: {
				src: [ 'loader.ts' ],
				options: {
					module: 'commonjs'
				}
			},

			watch: {
				watch: '.'
			},

			tests: {
				options: {
					module: 'amd'
				},
				src: [ 'tests/**/*.ts' ]
			}
		},

		clean: {
			dojo: {
				src: [ '**/{*.js,*.js.map}', 'sauce_connect.log', 'tscommand.tmp.txt', '!node_modules/**/*' ],
				filter: function (filepath) {
					var jsName = filepath.match(/(.*\.js)(?:\.map)?$/)[1];
					var tsName = jsName.slice(0, -3) + '.ts';
					var exists = grunt.file.exists;

					// Clean .js.map files, matching .js and .js.map files, and also clean JS files that have a matching
					// TS file.
					return exists(jsName + '.map') ||
						(exists(jsName) && (exists(jsName + '.map') || exists(tsName)));
				}
			}
		},

		intern: {
			client: {
				options: {
					runType: 'client',
					config: 'tests/intern'
				}
			}
		}
	});

	grunt.registerTask('test', [ 'intern:client' ]);

	grunt.registerTask('build', function (moduleType) {
		// Use `build:<moduleType>` to build Dojo 2 core using a different module type than the default
		if (moduleType) {
			grunt.config.set('ts.options.module', moduleType);
		}

		grunt.task.run('ts:default', 'ts:loader', 'ts:tests');
	});

	grunt.registerTask('default', [ 'build', 'ts:watch' ]);

	grunt.registerTask('ci', [ 'ts:tests', 'test' ]);
};
