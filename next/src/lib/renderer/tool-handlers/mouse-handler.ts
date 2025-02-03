import { mouseButtonPressed } from '@/lib/util';
import { EventDispatcher } from '@/lib/util/event-dispatcher';
import _ from 'lodash';

export type Sticky = boolean;
export type ModifierDefinition = Record<string, Sticky>;
export type Modifiers<T> = Record<keyof T, boolean>;

export interface MouseHandlerEvent<T> {
  event: MouseEvent;
  modifiers: Modifiers<T>;
}

export interface MouseHandlerEvents<T> {
  mousemove: MouseHandlerEvent<T>;
  mouseenter: MouseHandlerEvent<T>;
  mouseleave: MouseHandlerEvent<T>;
  click: MouseHandlerEvent<T>;
}

/**
 * Listen for mouse events, and refire them when a modifier key is pressed.
 */
export class MouseHandler<
  T extends ModifierDefinition,
> extends EventDispatcher()<MouseHandlerEvents<T>> {
  private elem: HTMLElement;
  private modifierDefinition: ModifierDefinition;

  private mouseMoveEvent?: MouseEvent;
  private modifiers: Modifiers<T>;

  constructor(elem: HTMLElement, modifierDefinition: T) {
    super();

    this.elem = elem;
    this.modifierDefinition = modifierDefinition;
    this.modifiers = _.mapValues(modifierDefinition, () => false);

    this.setupListeners();
  }

  delete() {
    this.removeListeners();
  }

  private setupListeners() {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    this.elem.addEventListener('mousemove', this.onMouseMove);
    this.elem.addEventListener('mouseenter', this.onMouseEvent);
    this.elem.addEventListener('mouseleave', this.onMouseLeave);
    this.elem.addEventListener('click', this.onMouseEvent);
  }

  private removeListeners() {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    this.elem.removeEventListener('mousemove', this.onMouseMove);
    this.elem.addEventListener('mouseenter', this.onMouseEvent);
    this.elem.addEventListener('mouseleave', this.onMouseLeave);
    this.elem.removeEventListener('click', this.onMouseEvent);
  }

  ///
  // Handle events

  private get modifierDefinitionEntries() {
    return Object.entries(this.modifierDefinition) as [keyof T, Sticky][];
  }

  private onKeyDown = (event: KeyboardEvent) => {
    let modifiersChanged = false;
    for (const [modifier, sticky] of this.modifierDefinitionEntries) {
      if (event.key === modifier) {
        this.modifiers[modifier] = sticky ? !this.modifiers[modifier] : true;
        modifiersChanged = true;
      }
    }

    if (modifiersChanged && this.mouseMoveEvent) {
      this.dispatchMouseEvent(this.mouseMoveEvent);
    }
  };

  private onKeyUp = (event: KeyboardEvent) => {
    let modifiersChanged = false;
    for (const [modifier, sticky] of this.modifierDefinitionEntries) {
      if (event.key === modifier && !sticky) {
        this.modifiers[modifier] = false;
        modifiersChanged = true;
      }
    }

    if (modifiersChanged && this.mouseMoveEvent) {
      this.dispatchMouseEvent(this.mouseMoveEvent);
    }
  };

  private onMouseMove = (event: MouseEvent) => {
    // Don't handle mouse events while the user is orbiting
    if (
      mouseButtonPressed(event, 'right') ||
      mouseButtonPressed(event, 'middle')
    ) {
      return;
    }

    this.mouseMoveEvent = event;
    this.dispatchMouseEvent(event);
  };

  private onMouseLeave = (event: MouseEvent) => {
    for (const [modifier, sticky] of this.modifierDefinitionEntries) {
      if (!sticky) {
        this.modifiers[modifier] = false;
      }
    }

    this.dispatchMouseEvent(event);
  };

  private onMouseEvent = (event: MouseEvent) => {
    this.dispatchMouseEvent(event);
  };

  ///
  // Raycasting

  private dispatchMouseEvent(event: MouseEvent) {
    this.dispatchEvent({
      type: event.type as keyof MouseHandlerEvents<T>,
      event,
      modifiers: this.modifiers,
    });
  }
}
