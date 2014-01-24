import array = require('./array');
import core = require('./interfaces');

interface IPair<T extends core.IRegistryMatcher, U> {
	match:T;
	value:U;
}

class Registry<T extends core.IRegistryMatcher, U> {
	private _pairs:IPair<T, U>[] = [];
	private _defaultValue:U;

	constructor(defaultValue?:U) {
		if (arguments.length > 0) {
			this._defaultValue = defaultValue;
		}
	}

	register(matcher:T, value:U, first?:boolean):core.IHandle {
		var pair:IPair<T, U> = {
			match: matcher,
			value: value
		};
		this._pairs[first ? 'unshift' : 'push'](pair);

		return {
			remove: function () {
				this.remove = () => {};
				array.remove(this._pairs, pair);
				matcher = value = pair = null;
			}
		};
	}

	match(...args:any[]):U {
		var pairs = this._pairs.slice(0),
			pair:IPair<T, U>;

		for (var i = 0; (pair = this._pairs[i]); i++) {
			if (pair.match.apply(null, args)) {
				return pair.value;
			}
		}
		if (this.hasOwnProperty('_defaultValue')) {
			return this._defaultValue;
		}
		throw new Error('No match found');
	}
}

export = Registry;
