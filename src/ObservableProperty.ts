import core = require('./interfaces');
import Observable = require('./Observable');

class ObservableProperty<T> extends Observable {
	private _observable: core.IObservable;
	private _propertyName: string;
	private _handle: core.IHandle;

	get value(): T {
		return (<any> this._observable)[this._propertyName];
	}
	set value(value: T) {
		(<any> this._observable)[this._propertyName] = value;
	}

	constructor(observable: core.IObservable, property: string) {
		this._observable = observable;
		this._propertyName = property;

		this._handle = observable.observe(property, (newValue: T, oldValue: T) => {
			(<any> this)._notify('value', newValue, oldValue);
		});

		super();

		// The following line keeps notifications getting set up for 'value'
		(<any> this)._callbacks['value'] = [];
	}

	destroy() {
		this._handle.remove();
		this._observable = null;
	}

	_schedule(): void {
		(<any> this)._dispatch();
	}
}

export = ObservableProperty;
