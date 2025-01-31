import { Edge, Face, Vertex } from '@/lib/geom/shape';
import { mouseButtonPressed } from '@/lib/util';
import { EventDispatcher } from '@/lib/util/event-dispatcher';
import { Axis } from '@/lib/util/geometry';
import { THREE } from '@lib/three.js';
import { DrawingHelper } from '../helpers/drawing-helper';
import { PlaneHelperRect } from '../helpers/plane-helper';
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

  delete() {
    this.renderer.removeUpdating(this.drawingHelper);
    this.renderer.setMouseTarget();
    this.targetFinder.delete();
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

    const fullTarget = this.targetFinder.findTarget(this.mouseEvent);
    if (!fullTarget) {
      return;
    }

    const { target, constrainedTarget, plane, face, edge, vertex } = fullTarget;

    const points: THREE.Vector3[] = [];
    const vertices: Vertex[] = [];
    const lines: THREE.Line3[] = [];
    const edges: Edge[] = [];
    const planes: PlaneHelperRect[] = [];
    const faces: Face[] = [];

    if (this.targetFinder.neighborPoint) {
      const line = new THREE.Line3(
        this.targetFinder.neighborPoint,
        constrainedTarget,
      );
      lines.push(line);
    }

    if (plane) {
      const origin = this.targetFinder.neighborPoint ?? new THREE.Vector3();
      const planeRect: PlaneHelperRect = {
        start: origin,
        end: constrainedTarget,
        normal: plane.normal,
      };
      planes.push(planeRect);
    }

    if (vertex) {
      vertices.push(vertex);
    }

    if (edge) {
      edges.push(edge);
      points.push(target);
    }

    if (face) {
      faces.push(face);
    }

    this.drawingHelper.setPoints(points);
    this.drawingHelper.setVertices(vertices);
    this.drawingHelper.setLines(lines);
    this.drawingHelper.setEdges(edges);
    this.drawingHelper.setPlanes(planes);
    this.drawingHelper.setFaces(faces);
    this.drawingHelper.visible = true;

    this.renderer.setMouseTarget(constrainedTarget);
    this.renderer.render();

    this.dispatchEvent({
      type,
      point: constrainedTarget,
      ctrlPressed: this.ctrlPressed,
    });
  }
}
