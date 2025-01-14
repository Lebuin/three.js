/**
 * The minimal basic Event that can be dispatched by a {@link EventDispatcher<>}.
 */
export interface BaseEvent<TEventType extends string = string> {
  readonly type: TEventType;
}

/**
 * The minimal expected contract of a fired Event that was dispatched by a {@link EventDispatcher<>}.
 */
export interface Event<TEventType extends string = string, TTarget = unknown> {
  readonly type: TEventType;
  readonly target: TTarget;
}

export type EventListener<TEventData, TEventType extends string, TTarget> = (
  event: TEventData & Event<TEventType, TTarget>,
) => void;

type EventListenerMap<TEventMap extends object, TTarget> = {
  [TEventType in Extract<keyof TEventMap, string>]?: EventListener<
    TEventMap[TEventType],
    TEventType,
    TTarget
  >[];
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-empty-object-type
type Constructor = new (...args: any[]) => {};

/**
 * Mixin that adds event dispatching capabilities to a class.
 *
 * Based on THREE.EventDispatcher.
 */
export function EventDispatcherMixin<
  TEventMap extends object,
  TBase extends Constructor,
>(Base: TBase) {
  class EventDispatcher extends Base {
    // Instead of `any`, we should use `this` here, but this breaks our types and I don't know why.
    // We should fix this, but it's not a priority right now. Also, our typing still works, since
    // we are able to use the correct type in the methods below.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private _listeners: EventListenerMap<TEventMap, any> = {};

    addEventListener<T extends Extract<keyof TEventMap, string>>(
      type: T,
      listener: EventListener<TEventMap[T], T, this>,
    ) {
      let listenerArray = this._listeners[type];
      if (listenerArray == null) {
        listenerArray = [];
        this._listeners[type] = listenerArray;
      }

      if (!listenerArray.includes(listener)) {
        listenerArray.push(listener);
      }
    }

    hasEventListener<T extends Extract<keyof TEventMap, string>>(
      type: T,
      listener: EventListener<TEventMap[T], T, this>,
    ) {
      return this._listeners[type]?.includes(listener);
    }

    removeEventListener<T extends Extract<keyof TEventMap, string>>(
      type: T,
      listener: EventListener<TEventMap[T], T, this>,
    ) {
      const listenerArray = this._listeners[type];
      if (listenerArray == null) {
        return;
      }

      const index = listenerArray.indexOf(listener);
      if (index !== -1) {
        listenerArray.splice(index, 1);
      }
    }

    dispatchEvent<T extends Extract<keyof TEventMap, string>>(
      event: BaseEvent<T> & TEventMap[T],
    ) {
      const eventWithTarget: Event<T, this> & TEventMap[T] = {
        ...event,
        target: this,
      };

      // Make a copy, in case listeners are removed while iterating.
      const listenerArray = this._listeners[event.type]?.slice(0);
      if (listenerArray) {
        for (const listener of listenerArray) {
          listener.call(this, eventWithTarget);
        }
      }
    }
  }

  return EventDispatcher;
}

/**
 * A version of EventDispatcherMixin where you don't have to provide the base class yourself.
 */
export function EventDispatcher<TEventMap extends object>() {
  class Base {}
  return EventDispatcherMixin<TEventMap, typeof Base>(Base);
}
