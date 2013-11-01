/* jshint node:true */
module.exports = function (grunt) {
	grunt.loadNpmTasks('grunt-ts');
	grunt.loadNpmTasks('grunt-contrib-watch');
	grunt.loadNpmTasks('grunt-contrib-clean');

	grunt.initConfig({
		ts: {
			dev: {
				src: [ '**/*.ts', '!node_modules/**/*.ts' ],
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
				src: [ '**/*.js', '**/*.js.map', '!node_modules/**/*', '!Gruntfile.js' ]
			}
		}
	});

	grunt.registerTask('default', [ 'ts:dev', 'watch:ts' ]);

	var changedFiles = {},
		onChange = grunt.util._.debounce(function () {
			grunt.config('ts.dev.src', Object.keys(changedFiles));
			changedFiles = {};
		}, 200);
	grunt.event.on('watch', function (action, filepath) {
		changedFiles[filepath] = action;
		onChange();
	});
};
