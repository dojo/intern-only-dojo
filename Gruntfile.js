/* jshint node:true */
module.exports = function (grunt) {
	grunt.loadNpmTasks('grunt-ts');
	grunt.loadNpmTasks('grunt-contrib-watch');
	grunt.loadNpmTasks('grunt-contrib-clean');

	var defaultSourceFiles = [ '**/*.ts', '!node_modules/**/*.ts', '!interfaces.d.ts' ];
	grunt.initConfig({
		ts: {
			dev: {
				src: defaultSourceFiles.slice(0),
				outDir: '.',
				options: {
					target: 'es5',
					module: 'amd',
					declaration: true,
					noImplicitAny: true
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
				src: [ '**/*.js', '**.d.ts', '**/*.js.map', '!node_modules/**/*', '!Gruntfile.js', '!loader.js', '!interfaces.d.ts' ]
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
			var src = changedFiles['interfaces.d.ts'] ? defaultSourceFiles.slice(0) : Object.keys(changedFiles);
			grunt.config('ts.dev.src', src);
			changedFiles = {};
		}, 200);
	grunt.event.on('watch', function (action, filepath) {
		changedFiles[filepath] = action;
		onChange();
	});
};
