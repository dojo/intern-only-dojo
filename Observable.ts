import array = require('./array');
import core = require('./interfaces');
import lang = require('./lang');
import Scheduler = require('./Scheduler');

interface ICallbackObject {
	removed?:boolean;
	callback:core.IObservableCallback;
}

interface INotification {
	newValue:any;
	oldValue:any;
	callbacks:Array<ICallbackObject>;
}

class Observable implements core.IObservable {
	private _callbacks: { [property:string]:ICallbackObject[] };
	private _notifications: { [property:string]:INotification };
	private _timer:core.IHandle;

	constructor(props:any) {
		lang.mixin(this, props);

		Object.defineProperties(this, {
			_callbacks: {
				value: {}
			},
			_notifications: {
				value: Object.create(null),
				writable: true
			},
			_timer: {
				value: null,
				writable: true
			},
			_dispatch: {
				configurable: true,
				value: this._dispatch.bind(this),
				writable: true
			}
		});
	}

	private _dispatch() {
		if (this._timer) {
			this._timer.remove();
			this._timer = null;
		}

		var notifications = this._notifications;
		this._notifications = Object.create(null);
		for (var property in notifications) {
			var notification = notifications[property];

			if (!notification) {
				continue;
			}

			var callback:ICallbackObject;
			for (var i = 0; (callback = notification.callbacks[i]); i++) {
				if (!callback.removed) {
					callback.callback.call(this, notification.newValue, notification.oldValue);
				}
			}
		}
	}

	private _notify(property:string, newValue:any, oldValue:any) {
		var callbacks = this._callbacks[property];
		if (!callbacks || !callbacks.length) {
			return;
		}

		var notification = this._notifications[property];

		if (notification) {
			if (lang.isEqual(notification.oldValue, newValue)) {
				notification = this._notifications[property] = null;
			}
			else {
				notification.newValue = newValue;
			}
		}
		else if (!lang.isEqual(newValue, oldValue)) {
			this._notifications[property] = {
				newValue: newValue,
				oldValue: oldValue,
				callbacks: callbacks.slice(0)
			};
		}

		if (!this._timer) {
			this._timer = Scheduler.schedule(this._dispatch);
		}
	}

	observe(property:string, callback:core.IObservableCallback):core.IHandle {
		var callbacks = this._callbacks[property],
			callbackObject:ICallbackObject = {
				callback: callback
			};
		if (!callbacks) {
			var oldDescriptor = lang.getPropertyDescriptor(this, property),
				descriptor:PropertyDescriptor = {
					configurable: true,
					enumerable: true
				};

			if (oldDescriptor.get || oldDescriptor.set) {
				// accessor
				if (oldDescriptor.get) {
					descriptor.get = oldDescriptor.get;
				}
				if (oldDescriptor.set) {
					descriptor.set = (value:any) => {
						var oldValue = this[property];

						if (lang.isEqual(value, oldValue)) {
							return;
						}

						this._notify(property, value, oldValue);
						oldDescriptor.set.call(this, value);
					};
				}
			}
			else {
				// property
				var value = this[property];
				descriptor.get = () => {
					return value;
				};
				if (oldDescriptor.writable) {
					descriptor.set = (newValue:any) => {
						if (lang.isEqual(value, newValue)) {
							return;
						}
						this._notify(property, newValue, value);
						value = newValue;
					};
				}
			}
			Object.defineProperty(this, property, descriptor);

			callbacks = this._callbacks[property] = [callbackObject];
		}
		else {
			callbacks.push(callbackObject);
		}

		var self = this;
		return {
			remove: function () {
				this.remove = () => {};
				// remove from in-flight notifications
				callbackObject.removed = true;
				// remove from future notifications
				array.remove(self._callbacks[property], callbackObject);
			}
		};
	}
}

export = Observable;
