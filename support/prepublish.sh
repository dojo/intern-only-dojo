#!/usr/bin/env bash
find . -name '*.ts' -not -wholename '*/tests/*' -not -name '*.d.ts' -exec tsc -m commonjs -t ES5 {} +
