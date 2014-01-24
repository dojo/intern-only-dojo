import CallbackQueue = require('./CallbackQueue');
import core = require('./interfaces');
import nextTick = require('./nextTick');

class Scheduler {
	static schedule(callback:() => void):core.IHandle {
		return scheduler.schedule(callback);
	}

	private _callbacks:CallbackQueue<() => void> = new CallbackQueue<() => void>();

	schedule(callback:() => void):core.IHandle {
		var handle = this._callbacks.add(callback);

		nextTick(() => {
			this._callbacks.drain();
		});

		return handle;
	}
}

var scheduler = new Scheduler();

export = Scheduler;
