import { mouseButtonPressed } from '@/lib/util';
import { EventDispatcher } from '@/lib/util/event-dispatcher';
import { Axis } from '@/lib/util/geometry';
import * as THREE from 'three';
import { DrawingHelper } from '../helpers/drawing-helper';
import { Renderer } from '../renderer';
import { TargetFinder } from './target-finder';

export interface MouseHandlerEvent {
  point: THREE.Vector3;
  ctrlPressed: boolean;
}
export interface MouseHandlerEvents {
  mousemove: MouseHandlerEvent;
  click: MouseHandlerEvent;
}

/**
 * Handle mouse events, and derive from them a target point in the scene. Draw helpers to indicate
 * to the user where the target point is.
 *
 */
export class MouseHandler extends EventDispatcher<MouseHandlerEvents>() {
  private renderer: Renderer;
  private _targetFinder: TargetFinder;
  private drawingHelper: DrawingHelper;

  private mouseEvent?: MouseEvent;
  private ctrlPressed = false;
  private fixedAxis?: Axis;

  constructor(renderer: Renderer) {
    super();

    this.renderer = renderer;
    this._targetFinder = new TargetFinder(renderer);
    this.drawingHelper = new DrawingHelper();
    this.renderer.addUpdating(this.drawingHelper);

    this.setupListeners();
  }

  dispose() {
    this.renderer.removeUpdating(this.drawingHelper);
    this.renderer.setMouseTarget();
    this.drawingHelper.dispose();
    this.targetFinder.dispose();
    this.removeListeners();
  }

  private setupListeners() {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    this.renderer.canvas.addEventListener('mousemove', this.onMouseMove);
    this.renderer.canvas.addEventListener('mouseleave', this.onMouseLeave);
    this.renderer.canvas.addEventListener('click', this.onClick);
  }

  private removeListeners() {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    this.renderer.canvas.removeEventListener('mousemove', this.onMouseMove);
    this.renderer.canvas.addEventListener('mouseleave', this.onMouseLeave);
    this.renderer.canvas.removeEventListener('click', this.onClick);
  }

  ///
  // Getters

  get targetFinder() {
    return this._targetFinder;
  }

  ///
  // Handle events

  private onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Control') {
      this.ctrlPressed = true;
    } else if (event.key === 'ArrowRight') {
      this.fixedAxis = this.fixedAxis === 'x' ? undefined : 'x';
    } else if (event.key === 'ArrowUp') {
      this.fixedAxis = this.fixedAxis === 'y' ? undefined : 'y';
    } else if (event.key === 'ArrowLeft') {
      this.fixedAxis = this.fixedAxis === 'z' ? undefined : 'z';
    } else {
      return;
    }

    this.dispatchMouseEvent();
  };

  private onKeyUp = (event: KeyboardEvent) => {
    if (event.key === 'Control') {
      this.ctrlPressed = false;
    } else {
      return;
    }

    this.dispatchMouseEvent();
  };

  private onMouseMove = (event: MouseEvent) => {
    // Don't handle mouse events while the user is orbiting
    if (
      mouseButtonPressed(event, 'right') ||
      mouseButtonPressed(event, 'middle')
    ) {
      return;
    }

    this.mouseEvent = event;
    this.ctrlPressed = event.ctrlKey;

    this.dispatchMouseEvent();
  };

  private onClick = (event: MouseEvent) => {
    this.mouseEvent = event;
    this.ctrlPressed = event.ctrlKey;

    this.dispatchMouseEvent('click');
  };

  private onMouseLeave = () => {
    this.drawingHelper.visible = false;
  };

  ///
  // Raycasting

  private dispatchMouseEvent(type: 'mousemove' | 'click' = 'mousemove') {
    if (!this.mouseEvent) {
      return;
    }

    const raycaster = this.renderer.getRaycaster(this.mouseEvent);

    const {
      target,
      plane,
      snapPoint: snappedPoint,
      snappedLine,
    } = this.targetFinder.findTarget(raycaster);

    this.renderer.setMouseTarget(target);

    if (target) {
      this.dispatchEvent({
        type,
        point: target,
        ctrlPressed: this.ctrlPressed,
      });
    }

    this.drawingHelper.visible = true;
    if (target && plane) {
      const origin = this.targetFinder.neighborPoint ?? new THREE.Vector3();
      this.drawingHelper.setPlanePosition(origin, target, plane);
    } else {
      this.drawingHelper.hidePlane();
    }

    const lines: THREE.Line3[] = [];
    if (snappedLine) {
      lines.push(snappedLine);
    }

    if (target && snappedPoint) {
      this.drawingHelper.setPointPosition(snappedPoint.point);
      if (snappedPoint.lines) {
        lines.push(...snappedPoint.lines);
      }
    } else {
      this.drawingHelper.hidePoint();
    }

    if (target && lines.length > 0) {
      this.drawingHelper.setLines(lines, target);
    } else {
      this.drawingHelper.hideLines();
    }
  }
}
