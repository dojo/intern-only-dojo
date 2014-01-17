import core = require('./interfaces');

class Registry<T extends core.IRegistryMatcher, U> {
	private _pairs:Array<{
		match:T;
		value:U;
	}> = [];
	private _defaultValue:U;

	constructor(defaultValue?:U) {
		if (arguments.length > 0) {
			this._defaultValue = defaultValue;
		}
	}

	register(matcher:T, value:U, first?:boolean):core.IHandle {
		var pair = {
			match: matcher,
			value: value
		};
		this._pairs[first ? 'unshift' : 'push'](pair);

		var handle = {
			remove: () => {
				handle.remove = () => {};
				var idx:number;
				if ((idx = this._pairs.indexOf(pair)) > -1) {
					this._pairs.splice(idx, 1);
				}
				handle = pair = null;
			}
		};
		return handle;
	}

	match(...args:any[]):U {
		var pairs = this._pairs.slice(0),
			pair:{ match: T; value: U; };

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
