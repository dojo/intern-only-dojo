/* jshint node:true */

module.exports = function (grunt) {
	grunt.loadNpmTasks('grunt-ts');
	grunt.loadNpmTasks('intern');

	grunt.initConfig({
		ts: {
			options: {
				target: 'es5',
				module: 'commonjs',
				sourceMap: true,
				noImplicitAny: true
			},

			default: {
				src: [ '**/*.ts', '!**/*.d.ts', '!tests/**/*.ts', '!node_modules/**/*.ts' ]
			},

			tests: {
				options: {
					module: 'amd'
				},
				src: [ 'tests/**/*.ts' ]
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
		if (moduleType) {
			grunt.config.set('ts.default.module', moduleType);
		}

		grunt.task.run('ts:default', 'ts:tests');
	});

	grunt.registerTask('default', [ 'build', 'test' ]);
};
