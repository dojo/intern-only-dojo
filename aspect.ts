/// <reference path="interfaces.ts" />

var nextId = 0;

interface IAdvised {
	id?: number;
	advice: Function
	previous?: IAdvised;
	next?: IAdvised;
	receiveArguments?: boolean;
}

interface IDispatcher {
	(): any;
	target: Object;
	before?: IAdvised;
	around?: IAdvised;
	after?: IAdvised;
}

function advise(dispatcher:IDispatcher, type:string, advice:Function, receiveArguments?:boolean): IHandle {
	var previous = dispatcher[type],
		advised = <IAdvised>{
			id: nextId++,
			advice: advice,
			receiveArguments: receiveArguments
		};

	if (previous) {
		if (type === 'after') {
			// add the listener to the end of the list
			// note that we had to change this loop a little bit to workaround a bizarre IE10 JIT bug
			while (previous.next && (previous = previous.next)) {}
			previous.next = advised;
			advised.previous = previous;
		}
		else {
			// add to the beginning
			dispatcher.before = advised;
			advised.next = previous;
			previous.previous = advised;
		}
	}
	else {
		dispatcher[type] = advised;
	}

	advice = previous = null;

	return {
		remove: () => {
			if (advised) {
				var previous = advised.previous,
					next = advised.next;

				if (!previous && !next) {
					dispatcher[type] = null;
				}
				else {
					if (previous) {
						previous.next = next;
					}
					else {
						dispatcher[type] = next;
					}
					if (next) {
						next.previous = previous;
					}
				}

				dispatcher = advised = null;
			}
		}
	};
}

function getDispatcher(target:Object, methodName:string): IDispatcher {
	var existing = target[methodName],
		dispatcher;

	if (!existing || existing.target !== target) {
		// no dispatcher
		target[methodName] = dispatcher = <IDispatcher>() => {
			var executionId = nextId,
				args = arguments,
				results,
				before = dispatcher.before;

			while (before) {
				args = before.advice.apply(this, args) || args;
				before = before.next;
			}

			if (dispatcher.around) {
				results = dispatcher.around.advice(this, args);
			}

			var after = dispatcher.after;
			while (after && after.id < executionId) {
				if (after.receiveArguments) {
					var newResults = after.advice.apply(this, args);
					results = newResults === undefined ? results : newResults;
				}
				else {
					results = after.advice.call(this, results, args);
				}
				after = after.next;
			}
			return results;
		};

		if (existing) {
			dispatcher.around = {
				advice: (target, args) => {
					return existing.apply(target, args);
				}
			};
		}
		dispatcher.target = target;
	}
	else {
		dispatcher = existing;
	}

	target = null;

	return dispatcher;
}

export function before(target:Object, methodName:string, advice:Function): IHandle {
	return advise(getDispatcher(target, methodName), 'before', advice);
}

export interface IAroundFactory {
	(previous:Function):Function;
}

export function around(target:Object, methodName:string, advice:IAroundFactory): IHandle {
	var dispatcher = getDispatcher(target, methodName),
		previous = dispatcher.around,
		advised = advice(() => {
			return previous.advice(this, arguments);
		});

	dispatcher.around = {
		advice: (target, args) => {
			return advised ?
				advised.apply(target, args) :
				previous.advice(target, args);
		}
	};

	advice = null;

	return {
		remove: () => {
			if (advised) {
				advised = dispatcher = null;
			}
		}
	};
}

export function after(target:Object, methodName:string, advice:Function): IHandle {
	return advise(getDispatcher(target, methodName), 'after', advice);
}
export function on(target:Object, methodName:string, advice:Function): IHandle {
	return advise(getDispatcher(target, methodName), 'after', advice, true);
}
