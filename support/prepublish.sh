#!/usr/bin/env bash
find . -name '*.ts' -not -wholename '*/tests/*' -not -wholename '*/node_modules/*' -not -name '*.d.ts' -exec ./node_modules/.bin/tsc -m commonjs -t ES5 {} +
