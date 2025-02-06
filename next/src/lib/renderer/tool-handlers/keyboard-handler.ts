import { EventDispatcher } from '@/lib/util/event-dispatcher';
import _ from 'lodash';

export interface Modifiers {
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
}
export class KeyCombo {
  public key: string;
  public modifiers: Modifiers;

  constructor(key: string, modifiers: Partial<Modifiers> = {}) {
    this.key = key.toLowerCase();
    this.modifiers = {
      ctrl: false,
      alt: false,
      shift: false,
      ...modifiers,
    };
  }

  static fromKeyboardEvent(event: KeyboardEvent) {
    return new KeyCombo(event.key, {
      ctrl: event.ctrlKey,
      alt: event.altKey,
      shift: event.shiftKey,
    });
  }

  toString() {
    const parts = [];
    if (this.modifiers.ctrl) {
      parts.push('Ctrl');
    }
    if (this.modifiers.alt) {
      parts.push('Alt');
    }
    if (this.modifiers.shift) {
      parts.push('Shift');
    }
    parts.push(_.capitalize(this.key));
    return parts.join('+');
  }

  equals(keyCombo: KeyCombo) {
    return (
      this.key === keyCombo.key &&
      this.modifiers.ctrl === keyCombo.modifiers.ctrl &&
      this.modifiers.alt === keyCombo.modifiers.alt &&
      this.modifiers.shift === keyCombo.modifiers.shift
    );
  }
}

export interface KeyboardHandlerEvent {
  event: KeyboardEvent;
  keyCombo: KeyCombo;
}
export type KeyboardHandlerEvents = {
  keydown: KeyboardHandlerEvent;
  keyup: KeyboardHandlerEvent;
  keypress: KeyboardHandlerEvent;
};

class KeyboardHandler extends EventDispatcher()<KeyboardHandlerEvents> {
  constructor() {
    super();
    this.setupListeners();
  }

  delete() {
    this.removeListeners();
  }

  private setupListeners() {
    if (!global.window) {
      return;
    }
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('keypress', this.onKeyPress);
  }

  private removeListeners() {
    if (!global.window) {
      return;
    }
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('keypress', this.onKeyPress);
  }

  private onKeyDown = (event: KeyboardEvent) => {
    const keyCombo = KeyCombo.fromKeyboardEvent(event);
    this.dispatchEvent({ type: 'keydown', event, keyCombo });
  };

  private onKeyUp = (event: KeyboardEvent) => {
    const keyCombo = KeyCombo.fromKeyboardEvent(event);
    this.dispatchEvent({ type: 'keyup', event, keyCombo });
  };

  private onKeyPress = (event: KeyboardEvent) => {
    const keyCombo = KeyCombo.fromKeyboardEvent(event);
    this.dispatchEvent({ type: 'keypress', event, keyCombo });
  };
}

export const keyboardHandler = new KeyboardHandler();
