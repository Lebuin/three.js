import { EventDispatcherMixin } from '@/lib/util/event-dispatcher';
import { THREE } from '@lib/three.js';
import { Renderer } from '../renderer';
import {
  keyboardHandler,
  KeyboardHandlerEvent,
  KeyCombo,
} from '../tool-handlers/keyboard-handler';
import { UpdatingObjectMixin } from './updating-object-mixin';

export interface DimensionHelperSubmitEvent {
  point: THREE.Vector3;
  keyCombo: KeyCombo;
}
export interface DimensionHelperEvents {
  submit: DimensionHelperSubmitEvent;
}

export class DimensionHelper extends EventDispatcherMixin(
  UpdatingObjectMixin(THREE.Object3D),
)<DimensionHelperEvents> {
  private line?: THREE.Line3;
  private elemInput: HTMLInputElement;
  private _visible = true;
  private hasInput = false;

  constructor() {
    super();
    this.elemInput = this.createInput();
    this._visible = false;
  }

  delete() {
    this.removeInput(this.elemInput);
  }

  reset() {
    this.hasInput = false;
    this.line = undefined;
    this.visible = false;
  }

  update(renderer: Renderer) {
    this.updateInput(renderer);
  }

  // @ts-expect-error We need to run custom logic when the visibility changes
  get visible() {
    return this._visible;
  }
  set visible(visible: boolean) {
    if (visible === this._visible) {
      return;
    }

    this._visible = visible;
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (this.elemInput) {
      this.updateInputVisibility();
    }
  }

  setLine(line: THREE.Line3) {
    this.line = line;
    line.getCenter(this.position);

    if (!this.hasInput) {
      const length = line.distance();
      let value = length.toFixed(0);
      if (Math.abs(length - Math.round(length)) >= 1e-6) {
        value = '~' + value;
      }
      this.elemInput.value = value;
      this.selectInputText();
    }
  }

  ///
  // Manage input element

  private createInput() {
    const elemInput = document.createElement('input');
    elemInput.type = 'text';
    elemInput.className = 'dimension-helper';
    elemInput.style.display = 'none';

    elemInput.addEventListener('input', this.onInput);
    keyboardHandler.addEventListener('keydown', this.onKeyDown);

    document.body.append(elemInput);
    return elemInput;
  }

  private removeInput(elemInput: HTMLInputElement) {
    elemInput.remove();
    elemInput.removeEventListener('input', this.onInput);
    keyboardHandler.removeEventListener('keydown', this.onKeyDown);
  }

  private updateInputVisibility() {
    this.elemInput.style.display = this.visible ? '' : 'none';
    this.selectInputText();
  }

  private selectInputText() {
    if (this.visible && !this.hasInput) {
      this.elemInput.focus();
      this.elemInput.select();
    }
  }

  private updateInput(renderer: Renderer) {
    const position = this.getScreenCoordinate(renderer);
    this.elemInput.style.transform = `translate(${position.x}px, ${position.y}px) translate(-50%, -50%)`;
  }

  private getScreenCoordinate(renderer: Renderer) {
    const position = this.getWorldPosition(new THREE.Vector3());
    const pointer = renderer.getPointerFromPosition(position);
    const screenCoordinate = renderer.getScreenCoordinate(pointer);
    return screenCoordinate;
  }

  private onInput = () => {
    this.hasInput = true;
  };

  private onKeyDown = (event: KeyboardHandlerEvent) => {
    if (this.line && this.hasInput && event.keyCombo.key === 'enter') {
      this.confirm(this.line, event.keyCombo);
    }
  };

  private confirm(line: THREE.Line3, keyCombo: KeyCombo) {
    let length;
    try {
      length = this.parseInput(this.elemInput.value);
    } catch (e) {
      // TODO: show an error to the user
      console.warn(e);
      return;
    }

    const direction = line.delta(new THREE.Vector3()).normalize();
    const point = line.start.clone().addScaledVector(direction, length);
    this.dispatchEvent({ type: 'submit', point, keyCombo });
  }

  private parseInput(input: string) {
    const value = parseFloat(input);
    if (isNaN(value)) {
      throw new Error('Invalid number');
    }
    return value;
  }
}
