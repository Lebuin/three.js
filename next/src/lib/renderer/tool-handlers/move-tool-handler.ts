import { Edge, Face } from '@/lib/geom/shape';
import { THREE } from '@lib/three.js';
import { DrawingHelper } from '../helpers/drawing-helper';
import { PartObject } from '../part-objects/part-object';
import { Renderer } from '../renderer';
import {
  MouseHandlerEvent as BaseMouseHandlerEvent,
  MouseHandler,
} from './mouse-handler';
import { Target, TargetFinder } from './target-finder';
import { ToolHandler } from './tool-handler';

const mouseHandlerModifiers = {
  ArrowUp: true,
} as const;
type MouseHandlerModifiers = typeof mouseHandlerModifiers;
type MouseHandlerEvent = BaseMouseHandlerEvent<MouseHandlerModifiers>;

export class MoveToolHandler extends ToolHandler {
  readonly tool = 'move';

  private mouseHandler: MouseHandler<MouseHandlerModifiers>;
  private targetFinder: TargetFinder;
  private drawingHelper: DrawingHelper;

  private selectedObject?: PartObject;
  private startPosition?: THREE.Vector3;
  private startTarget?: Target;
  private lastTarget?: Target;
  private fixedLine?: THREE.Line3;

  constructor(renderer: Renderer) {
    super(renderer);

    this.mouseHandler = new MouseHandler(
      renderer.canvas,
      mouseHandlerModifiers,
    );
    this.targetFinder = new TargetFinder(renderer, {
      snapToLines: true,
      snapToPoints: true,
    });
    this.drawingHelper = new DrawingHelper();
    this.renderer.addUpdating(this.drawingHelper);

    this.setupListeners();
  }

  delete() {
    super.delete();
    this.cancelMove();
    this.mouseHandler.delete();
    this.targetFinder.delete();
    this.renderer.removeUpdating(this.drawingHelper);
    this.renderer.setMouseTarget();
    this.removeListeners();
  }

  private setupListeners() {
    this.mouseHandler.addEventListener('mousemove', this.onMouseMove);
    this.mouseHandler.addEventListener('click', this.onClick);
  }

  private removeListeners() {
    this.mouseHandler.removeEventListener('mousemove', this.onMouseMove);
    this.mouseHandler.removeEventListener('click', this.onClick);
  }

  ///
  // Handle events

  private onMouseMove = (event: MouseHandlerEvent) => {
    this.updateFixedLine(event);
    const target = this.targetFinder.findTarget(event.event);
    const object = target?.object;

    if (this.selectedObject && target) {
      this.doMove(target);
    }

    this.updateDrawingHelper(target);
    this.updateRenderer(target);
  };

  private onClick = (event: MouseHandlerEvent) => {
    this.updateFixedLine(event);
    const target = this.targetFinder.findTarget(event.event);
    const object = target?.object;

    if (this.isMoving) {
      if (target) {
        this.confirmMove(target);
        this.unsetSelectedObject();
      }
    } else if (object) {
      this.setSelectedObject(object, target);
    } else {
      this.unsetSelectedObject();
    }

    this.updateDrawingHelper(target);
    this.updateRenderer(target);
  };

  private updateFixedLine(event: MouseHandlerEvent) {
    const isFixedLine = event.modifiers.ArrowUp;
    if (isFixedLine === !!this.fixedLine) {
      return;
    }

    if (!isFixedLine) {
      this.fixedLine = undefined;
    } else if (this.startTarget && this.lastTarget) {
      this.fixedLine = new THREE.Line3(
        this.startTarget.constrainedPoint,
        this.lastTarget.constrainedPoint,
      );
    }
    this.updateConstraints();
  }

  private setSelectedObject(object: PartObject, target: Target) {
    this.selectedObject = object;
    this.initMove(target);
  }
  private unsetSelectedObject() {
    this.cancelMove();
    this.selectedObject = undefined;
  }

  ///
  // Move the selected objects

  private get isMoving() {
    return this.startPosition !== undefined;
  }

  private initMove(target: Target) {
    if (!this.selectedObject) {
      return;
    }
    this.selectedObject.traverse((object) => {
      object.layers.set(1);
    });
    this.startPosition = this.selectedObject.part.position.clone();
    this.startTarget = target;
    this.lastTarget = undefined;
    this.fixedLine = undefined;
    this.updateConstraints();
  }

  private endMove() {
    if (this.selectedObject) {
      this.selectedObject.traverse((object) => {
        object.layers.set(0);
      });
    }
    this.startPosition = undefined;
    this.startTarget = undefined;
    this.lastTarget = undefined;
    this.fixedLine = undefined;
    this.updateConstraints();
  }

  private cancelMove() {
    if (this.selectedObject && this.startPosition) {
      this.selectedObject.part.position = this.startPosition;
    }
    this.endMove();
  }

  private doMove(target: Target) {
    if (!(this.selectedObject && this.startTarget && this.startPosition)) {
      return;
    }
    const delta = target.constrainedPoint
      .clone()
      .sub(this.startTarget.constrainedPoint);
    this.selectedObject.part.position = this.startPosition.clone().add(delta);
    this.lastTarget = target;
  }

  private confirmMove(target: Target) {
    this.doMove(target);
    this.endMove();
  }

  private updateConstraints() {
    if (!this.startTarget) {
      this.targetFinder.clearConstraints();
    } else if (this.fixedLine) {
      this.targetFinder.setConstraintLine(this.fixedLine);
    } else {
      this.targetFinder.setNeighborPoint(this.startTarget.constrainedPoint);
    }
  }

  ///
  // Render the selected objects

  private updateDrawingHelper(target: Optional<Target>) {
    if (!target) {
      this.drawingHelper.clear();
      return;
    }

    const lines: THREE.Line3[] = [];
    const points: THREE.Vector3[] = [];
    const faces: Face[] = [];
    const edges: Edge[] = [];

    if (this.startTarget && this.lastTarget) {
      lines.push(
        new THREE.Line3(
          this.startTarget.constrainedPoint,
          this.lastTarget.constrainedPoint,
        ),
      );
    }
    if (target.object) {
      points.push(target.point);
    }

    const objects = [];
    if (this.selectedObject) {
      objects.push(this.selectedObject);
    }

    if (this.isMoving) {
      if (target.edge) {
        edges.push(target.edge);
      }
      if (target.face) {
        faces.push(target.face);
      }
    } else {
      if (target.object) {
        objects.push(target.object);
      }
    }

    for (const object of objects) {
      if ('faces' in object.part.shape) {
        faces.push(...object.part.shape.faces);
      }
      edges.push(...object.part.shape.edges);
    }

    this.drawingHelper.setLines(lines);
    this.drawingHelper.setPoints(points);
    this.drawingHelper.setFaces(faces);
    this.drawingHelper.setEdges(edges);
  }

  getMouseTarget(target: Target) {
    if (this.isMoving) {
      return target.point;
    } else {
      return super.getMouseTarget(target);
    }
  }
}
