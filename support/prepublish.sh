#!/usr/bin/env bash
if [[ "$1" == "amd" ]]; then
	find . -name '*.ts' -not -wholename '*/tests/*' -not -wholename '*/node_modules/*' -not -wholename 'loader.ts' -not -name '*.d.ts' -exec ./node_modules/.bin/tsc -m amd -t ES5 {} +
	./node_modules/.bin/tsc -m commonjs -t ES5 loader.ts
else
	find . -name '*.ts' -not -wholename '*/tests/*' -not -wholename '*/node_modules/*' -not -name '*.d.ts' -exec ./node_modules/.bin/tsc -m commonjs -t ES5 {} +
fi
