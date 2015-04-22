/* jshint node:true */

var dtsGenerator = require('dts-generator');

module.exports = function (grunt) {
	grunt.loadNpmTasks('grunt-contrib-clean');
	grunt.loadNpmTasks('grunt-contrib-copy');
	grunt.loadNpmTasks('grunt-ts');
	grunt.loadNpmTasks('grunt-tslint');
	grunt.loadNpmTasks('intern');

	grunt.initConfig({
		all: [ 'src/**/*.ts', '!src/loader.ts', 'typings/tsd.d.ts' ],

		clean: {
			dist: {
				src: [ 'dist/' ]
			},
			loaderTmp: {
				src: [ 'dist-loader-tmp/' ]
			}
		},

		copy: {
			sourceForDebugging: {
				expand: true,
				cwd: 'src/',
				src: [ '**/*.ts' ],
				dest: 'dist/_debug/'
			},
			staticFiles: {
				expand: true,
				cwd: '.',
				src: [ 'README.md', 'LICENSE', 'package.json', 'bower.json' ],
				dest: 'dist/'
			},
			typings: {
				expand: true,
				cwd: 'typings/',
				src: [ '**/*.d.ts', '!tsd.d.ts' ],
				dest: 'dist/typings/'
			},
			loader: {
				expand: true,
				cwd: 'dist-loader-tmp/',
				src: [ 'loader.js', '_debug/loader.js.map' ],
				dest: 'dist/'
			}
		},

		dts: {
			options: {
				baseDir: 'src',
				name: 'dojo'
			},
			dojo: {
				options: {
					out: 'dist/typings/dojo/dojo-2.0.d.ts'
				},
				src: [ '<%= all %>' ]
			}
		},

		intern: {
			runner: {
				options: {
					runType: 'runner',
					config: 'tests/intern'
				}
			},
			client: {
				options: {
					config: 'tests/intern'
				}
			}
		},

		rename: {
			sourceMaps: {
				expand: true,
				cwd: 'dist/',
				src: [ '**/*.js.map' ],
				dest: 'dist/_debug/'
			}
		},

		rewriteSourceMapSources: {
			framework: {
				options: {
					find: /^.*\/([^\/]+)$/,
					replace: '$1'
				},
				src: [ 'dist/**/*.js.map' ]
			}
		},

		ts: {
			options: {
				failOnTypeErrors: true,
				fast: 'never',
				mapRoot: '../dist/_debug',
				noImplicitAny: true,
				sourceMap: true,
				target: 'es5'
			},
			dojo: {
				options: {
					module: 'camd'
				},
				outDir: 'dist',
				src: [ '<%= all %>', '!src/loader.ts' ]
			},
			loader: {
				options: {
					mapRoot: '../dist-loader-tmp/_debug',
					module: 'commonjs'
				},
				outDir: 'dist-loader-tmp',
				src: [ 'src/loader.ts', 'typings/tsd.d.ts' ]
			},
			tests: {
				options: {
					module: 'amd'
				},
				src: [ 'tests/**/*.ts', 'typings/tsd.d.ts' ]
			}
		},

		tslint: {
			options: {
				configuration: grunt.file.readJSON('tslint.json')
			},
			dojo: {
				src: [ '<%= all %>' ]
			}
		}
	});

	grunt.registerMultiTask('dts', function () {
		var done = this.async();
		var onProgress = grunt.verbose.writeln.bind(grunt.verbose);

		var kwArgs = this.options();
		var path = require('path');
		kwArgs.files = this.filesSrc.map(function (filename) {
			return path.relative(kwArgs.baseDir, filename);
		});

		dtsGenerator.generate(kwArgs, onProgress).then(function () {
			grunt.log.writeln('Generated d.ts bundle at \x1b[36m' + kwArgs.out + '\x1b[39;49m');
			done();
		}, done);
	});

	grunt.registerMultiTask('rewriteSourceMapSources', function () {
		var find = this.options().find;
		var replace = this.options().replace;

		grunt.log.writeln('Replacing ' + find + ' with ' + replace + ' in ' + this.filesSrc.length + ' files');

		this.filesSrc.forEach(function (file) {
			var map = JSON.parse(grunt.file.read(file));
			map.sources = map.sources.map(function (source) {
				return source.replace(find, replace);
			});
			grunt.file.write(file, JSON.stringify(map));
		});
	});

	grunt.registerMultiTask('rename', function () {
		this.files.forEach(function (file) {
			if (grunt.file.isFile(file.src[0])) {
				grunt.file.mkdir(require('path').dirname(file.dest));
			}
			require('fs').renameSync(file.src[0], file.dest);
			grunt.verbose.writeln('Renamed ' + file.src[0] + ' to ' + file.dest);
		});
		grunt.log.writeln('Moved ' + this.files.length + ' files');
	});

	grunt.registerTask('build', [
		'ts:loader',
		'ts:dojo',
		'copy:loader',
		'clean:loaderTmp',
		'copy:typings',
		'copy:sourceForDebugging',
		'copy:staticFiles',
		'rewriteSourceMapSources',
		'rename:sourceMaps',
		'dts:dojo'
	]);
	grunt.registerTask('test', [ 'ts:tests', 'intern:client' ]);
	grunt.registerTask('ci', [ 'tslint', 'build', 'test' ]);
	grunt.registerTask('default', [ 'clean', 'build' ]);
};
