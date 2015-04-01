import assert = require('intern/chai!assert');
import string = require('src/string');
import registerSuite = require('intern!object');

registerSuite({
	name: 'string',

	'.repeat': function () {
		assert.strictEqual(string.repeat('a', 0), '');
		assert.strictEqual(string.repeat('', 4), '');
		assert.strictEqual(string.repeat('a', -1), '');

		assert.strictEqual(string.repeat('a', 5), 'aaaaa');
		assert.strictEqual(string.repeat('ab', 5), 'ababababab');
	}
});
