import { EventDispatcherMixin } from '@/lib/util/event-dispatcher';
import { THREE } from '@lib/three.js';
import { Renderer } from '../renderer';
import { UpdatingObjectMixin } from './updating-object-mixin';

export interface DimensionHelperSubmitEvent {
  point: THREE.Vector3;
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

  constructor() {
    super();
    this.elemInput = this.createInput();
    this.updateInputVisibility();
  }

  delete() {
    this.removeInput(this.elemInput);
  }

  update(renderer: Renderer) {
    this.updateInput(renderer);
  }

  // @ts-expect-error We need to run custom logic when the visibility changes
  get visible() {
    return this._visible;
  }
  set visible(visible: boolean) {
    this._visible = visible;
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (this.elemInput) {
      this.updateInputVisibility();
    }
  }

  setLine(line: THREE.Line3) {
    this.line = line;
    line.getCenter(this.position);

    const length = line.distance();
    let value = length.toFixed(0);
    if (Math.abs(length - Math.round(length)) >= 1e-6) {
      value = '~' + value;
    }
    this.elemInput.value = value;
  }

  ///
  // Manage input element

  private createInput() {
    const elemForm = document.createElement('form');

    const elemInput = document.createElement('input');
    elemInput.type = 'text';
    elemInput.className = 'dimension-helper';

    elemForm.addEventListener('submit', this.onSubmit);

    elemForm.append(elemInput);
    document.body.append(elemForm);
    return elemInput;
  }

  private removeInput(elemInput: HTMLInputElement) {
    const elemForm = elemInput.parentElement!;
    elemForm.remove();
    elemInput.remove();

    elemForm.removeEventListener('submit', this.onSubmit);
  }

  private updateInputVisibility() {
    this.elemInput.style.display = this.visible ? '' : 'none';
    if (this.visible) {
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

  private onSubmit = (event: SubmitEvent) => {
    event.preventDefault();

    if (!this.line) {
      return;
    }

    let length;
    try {
      length = this.parseInput(this.elemInput.value);
    } catch (e) {
      // TODO: show an error to the user
      console.warn(e);
      return;
    }

    const direction = this.line.delta(new THREE.Vector3()).normalize();
    const point = this.line.start.clone().addScaledVector(direction, length);
    this.dispatchEvent({ type: 'submit', point });
  };

  private parseInput(input: string) {
    const value = parseFloat(input);
    if (isNaN(value)) {
      throw new Error('Invalid number');
    }
    return value;
  }
}
