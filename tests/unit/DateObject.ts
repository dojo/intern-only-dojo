import assert = require('intern/chai!assert');
import DateObject = require('src/DateObject');
import registerSuite = require('intern!object');

var date: Date;
var object: DateObject;

registerSuite({
	name: 'DateObject',

	'creation': function () {
		var date = new Date();
		var object = new DateObject();

		assert.closeTo(object.valueOf(), +date, 100);

		object = new DateObject(date);
		assert.strictEqual(object.valueOf(), +date);

		object = new DateObject(+date);
		assert.strictEqual(object.valueOf(), +date);

		object = new DateObject(date.toISOString());
		assert.strictEqual(object.valueOf(), +date);

		object = new DateObject({
			year: date.getFullYear(),
			month: date.getMonth() + 1
		});
		date.setDate(1);
		date.setHours(0, 0, 0, 0);
		assert.strictEqual(object.valueOf(), +date);
	},

	'properties': {
		beforeEach: function () {
			date = new Date();
			object = new DateObject(date);
		},

		'year': function () {
			assert.strictEqual(object.year, date.getFullYear());
			date.setFullYear(object.year = 1);
			assert.strictEqual(object.year, date.getFullYear());

			object = new DateObject({ year: 2005, month: 12, dayOfMonth: 27 });
			object.year += 1;
			assert.strictEqual(+object, +new Date(2006, 11, 27));

			object = new DateObject({ year: 2005, month: 12, dayOfMonth: 27 });
			object.year -= 1;
			assert.strictEqual(+object, +new Date(2004, 11, 27));

			object = new DateObject({ year: 2000, month: 2, dayOfMonth: 29 });
			object.year += 1;
			assert.strictEqual(+object, +new Date(2001, 1, 28));

			object = new DateObject({ year: 2000, month: 2, dayOfMonth: 29 });
			object.year += 5;
			assert.strictEqual(+object, +new Date(2005, 1, 28));

			object = new DateObject({ year: 1900, month: 12, dayOfMonth: 31 });
			object.year += 30;
			assert.strictEqual(+object, +new Date(1930, 11, 31));

			object = new DateObject({ year: 1995, month: 12, dayOfMonth: 31 });
			object.year += 35;
			assert.strictEqual(+object, +new Date(2030, 11, 31));
		},

		'month': function () {
			assert.strictEqual(object.month, date.getMonth() + 1);
			date.setMonth((object.month = 1) - 1);
			assert.strictEqual(object.month, date.getMonth() + 1);

			object = new DateObject({ year: 2000, month: 1, dayOfMonth: 1 });
			object.month += 1;
			assert.strictEqual(+object, +new Date(2000, 1, 1));

			object = new DateObject({ year: 2000, month: 1, dayOfMonth: 31 });
			object.month += 1;
			assert.strictEqual(+object, +new Date(2000, 1, 29));

			object = new DateObject({ year: 2000, month: 2, dayOfMonth: 29 });
			object.month += 12;
			assert.strictEqual(+object, +new Date(2001, 1, 28));
		},

		'dayOfMonth': function () {
			assert.strictEqual(object.dayOfMonth, date.getDate());
			date.setDate(object.dayOfMonth = 1);
			assert.strictEqual(object.dayOfMonth, date.getDate());
		},

		'hours': function () {
			assert.strictEqual(object.hours, date.getHours());
			date.setHours(object.hours = 12);
			assert.strictEqual(object.hours, date.getHours());
		},

		'minutes': function () {
			assert.strictEqual(object.minutes, date.getMinutes());
			date.setMinutes(object.minutes = 12);
			assert.strictEqual(object.minutes, date.getMinutes());
		},

		'seconds': function () {
			assert.strictEqual(object.seconds, date.getSeconds());
			date.setSeconds(object.seconds = 12);
			assert.strictEqual(object.seconds, date.getSeconds());
		},

		'milliseconds': function () {
			assert.strictEqual(object.milliseconds, date.getMilliseconds());
			date.setMilliseconds(object.milliseconds = 12);
			assert.strictEqual(object.milliseconds, date.getMilliseconds());
		},

		'time': function () {
			assert.strictEqual(object.time, +date);
			date.setTime(object.time = 0);
			assert.strictEqual(object.time, +date);
		},

		'dayOfWeek': function () {
			assert.strictEqual(object.dayOfWeek, date.getDay());
		},

		'timezoneOffset': function () {
			assert.strictEqual(object.timezoneOffset, date.getTimezoneOffset());
		}
	},

	'.to* methods': function () {
		var date = new Date();
		var object = new DateObject(date);

		assert.strictEqual(object.toString(), date.toString());
		assert.strictEqual(object.toDateString(), date.toDateString());
		assert.strictEqual(object.toTimeString(), date.toTimeString());
		assert.strictEqual(object.toLocaleString(), date.toLocaleString());
		assert.strictEqual(object.toLocaleDateString(), date.toLocaleDateString());
		assert.strictEqual(object.toLocaleTimeString(), date.toLocaleTimeString());
		assert.strictEqual(object.toISOString(), date.toISOString());
		assert.strictEqual(object.toJSON(), date.toJSON());
	},

	'.add': function () {
		var object1: DateObject;
		var object2: DateObject;

		// year
		object1 = new DateObject({ year: 2005, month: 12, dayOfMonth: 27 });
		object2 = object1.add({ year: 1 });
		assert.notStrictEqual(object1, object2);
		assert.strictEqual(+object2, +new Date(2006, 11, 27));

		object1 = new DateObject({ year: 2005, month: 12, dayOfMonth: 27 });
		object2 = object1.add({ year: -1 });
		assert.notStrictEqual(object1, object2);
		assert.strictEqual(+object2, +new Date(2004, 11, 27));

		object1 = new DateObject({ year: 2000, month: 2, dayOfMonth: 29 });
		object2 = object1.add({ year: 1 });
		assert.notStrictEqual(object1, object2);
		assert.strictEqual(+object2, +new Date(2001, 1, 28));

		object1 = new DateObject({ year: 2000, month: 2, dayOfMonth: 29 });
		object2 = object1.add({ year: 5 });
		assert.notStrictEqual(object1, object2);
		assert.strictEqual(+object2, +new Date(2005, 1, 28));

		object1 = new DateObject({ year: 1900, month: 12, dayOfMonth: 31 });
		object2 = object1.add({ year: 30 });
		assert.notStrictEqual(object1, object2);
		assert.strictEqual(+object2, +new Date(1930, 11, 31));

		object1 = new DateObject({ year: 1995, month: 12, dayOfMonth: 31 });
		object2 = object1.add({ year: 35 });
		assert.notStrictEqual(object1, object2);
		assert.strictEqual(+object2, +new Date(2030, 11, 31));

		// month
		object1 = new DateObject({ year: 2000, month: 1, dayOfMonth: 1 });
		object2 = object1.add({ month: 1 });
		assert.notStrictEqual(object1, object2);
		assert.strictEqual(+object2, +new Date(2000, 1, 1));

		object1 = new DateObject({ year: 2000, month: 1, dayOfMonth: 31 });
		object2 = object1.add({ month: 1 });
		assert.notStrictEqual(object1, object2);
		assert.strictEqual(+object2, +new Date(2000, 1, 29));

		object1 = new DateObject({ year: 2000, month: 2, dayOfMonth: 29 });
		object2 = object1.add({ month: 12 });
		assert.notStrictEqual(object1, object2);
		assert.strictEqual(+object2, +new Date(2001, 1, 28));

		// TODO: test multiple at once
	},

	'isLeapYear': function () {
		var date = new DateObject({
			year: 2006,
			month: 1,
			dayOfMonth: 1
		});

		assert.isFalse(date.isLeapYear);
		date.year = 2004;
		assert.isTrue(date.isLeapYear);
		date.year = 2000;
		assert.isTrue(date.isLeapYear);
		date.year = 1900;
		assert.isFalse(date.isLeapYear);
		date.year = 1800;
		assert.isFalse(date.isLeapYear);
		date.year = 1700;
		assert.isFalse(date.isLeapYear);
		date.year = 1600;
		assert.isTrue(date.isLeapYear);
	},

	'daysInMonth': function () {
		var date = new DateObject({
			year: 2006,
			month: 1,
			dayOfMonth: 1
		});

		assert.strictEqual(date.daysInMonth, 31);
		date.month = 2;
		assert.strictEqual(date.daysInMonth, 28);
		date.month = 3;
		assert.strictEqual(date.daysInMonth, 31);
		date.month = 4;
		assert.strictEqual(date.daysInMonth, 30);
		date.month = 5;
		assert.strictEqual(date.daysInMonth, 31);
		date.month = 6;
		assert.strictEqual(date.daysInMonth, 30);
		date.month = 7;
		assert.strictEqual(date.daysInMonth, 31);
		date.month = 8;
		assert.strictEqual(date.daysInMonth, 31);
		date.month = 9;
		assert.strictEqual(date.daysInMonth, 30);
		date.month = 10;
		assert.strictEqual(date.daysInMonth, 31);
		date.month = 11;
		assert.strictEqual(date.daysInMonth, 30);
		date.month = 12;
		assert.strictEqual(date.daysInMonth, 31);

		// Februarys
		date.month = 2;
		date.year = 2004;
		assert.strictEqual(date.daysInMonth, 29);
		date.year = 2000;
		assert.strictEqual(date.daysInMonth, 29);
		date.year = 1900;
		assert.strictEqual(date.daysInMonth, 28);
		date.year = 1800;
		assert.strictEqual(date.daysInMonth, 28);
		date.year = 1700;
		assert.strictEqual(date.daysInMonth, 28);
		date.year = 1600;
		assert.strictEqual(date.daysInMonth, 29);
	}
});
