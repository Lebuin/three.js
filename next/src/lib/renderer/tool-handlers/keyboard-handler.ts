import { EventDispatcher } from '@/lib/util/event-dispatcher';
import _ from 'lodash';

export interface Modifiers {
  Control: boolean;
  Alt: boolean;
  Shift: boolean;
}
export class KeyCombo {
  public key: string;
  public modifiers: Modifiers;

  constructor(key: string, modifiers: Partial<Modifiers> = {}) {
    this.key = key.toLowerCase();
    this.modifiers = {
      Control: false,
      Alt: false,
      Shift: false,
      ...modifiers,
    };
  }

  static fromKeyboardEvent(event: KeyboardEvent) {
    return new KeyCombo(event.key, {
      Control: event.ctrlKey,
      Alt: event.altKey,
      Shift: event.shiftKey,
    });
  }

  toString() {
    const parts = [];
    if (this.modifiers.Control) {
      parts.push('Ctrl');
    }
    if (this.modifiers.Alt) {
      parts.push('Alt');
    }
    if (this.modifiers.Shift) {
      parts.push('Shift');
    }
    parts.push(_.capitalize(this.key));
    return parts.join('+');
  }

  equals(keyCombo: KeyCombo) {
    return (
      this.key === keyCombo.key &&
      this.modifiers.Control === keyCombo.modifiers.Control &&
      this.modifiers.Alt === keyCombo.modifiers.Alt &&
      this.modifiers.Shift === keyCombo.modifiers.Shift
    );
  }
}

export interface KeyboardHandlerEvent {
  event: KeyboardEvent;
  keyCombo: KeyCombo;
}
export interface KeyboardHandlerEvents {
  keydown: KeyboardHandlerEvent;
  keyup: KeyboardHandlerEvent;
  keypress: KeyboardHandlerEvent;
}

class KeyboardHandler extends EventDispatcher()<KeyboardHandlerEvents> {
  constructor() {
    super();
    this.setupListeners();
  }

  delete() {
    this.removeListeners();
  }

  private setupListeners() {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (!global.window) {
      return;
    }
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('keypress', this.onKeyPress);
  }

  private removeListeners() {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
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
