/* jshint node:true */
module.exports = function (grunt) {
	grunt.loadNpmTasks('grunt-ts');
	grunt.loadNpmTasks('grunt-contrib-watch');
	grunt.loadNpmTasks('grunt-contrib-clean');

	grunt.initConfig({
		ts: {
			dev: {
				src: [ '**/*.ts', '!node_modules/**/*.ts', '!interfaces.ts' ],
				outDir: '.',
				options: {
					target: 'es5',
					module: 'amd'
				}
			}
		},
		watch: {
			ts: {
				files: [ '**/*.ts', '!node_modules/**/*.ts' ],
				tasks: [ 'ts:dev' ],
				options: {
					spawn: false
				}
			}
		},
		clean: {
			ts: {
				src: [ '**/*.js', '**/*.js.map', '**/*.d.ts', '!node_modules/**/*', '!Gruntfile.js', '!loader.js' ]
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

	grunt.registerTask('default', [ 'force:on', 'ts:dev', 'force:restore', 'watch:ts' ]);
	grunt.registerTask('build', [ 'ts:dev' ]);

	var changedFiles = {},
		onChange = grunt.util._.debounce(function (all) {
			if (!changedFiles['interfaces.ts']) {
				grunt.config('ts.dev.src', Object.keys(changedFiles));
			}
			changedFiles = {};
		}, 200);
	grunt.event.on('watch', function (action, filepath) {
		changedFiles[filepath] = action;
		onChange();
	});
};
