import { Edge, Face } from '@/lib/geom/shape';
import { THREE } from '@lib/three.js';
import { DrawingHelper } from '../helpers/drawing-helper';
import { PartObject } from '../part-objects/part-object';
import { Renderer } from '../renderer';
import {
  MouseHandlerEvent as BaseMouseHandlerEvent,
  MouseHandler,
} from './mouse-handler';
import { moverFactory, MoveTool } from './movers';
import { BaseMover } from './movers/base-mover';
import { Target, TargetFinder } from './target-finder';
import { ToolHandler } from './tool-handler';

const mouseHandlerModifiers = {
  ArrowUp: true,
} as const;
type MouseHandlerModifiers = typeof mouseHandlerModifiers;
type MouseHandlerEvent = BaseMouseHandlerEvent<MouseHandlerModifiers>;

export class MoveToolHandler extends ToolHandler {
  readonly tool: MoveTool = 'move';

  private mouseHandler: MouseHandler<MouseHandlerModifiers>;
  private targetFinder: TargetFinder;
  private drawingHelper: DrawingHelper;

  private selectedObject?: PartObject;
  private mover?: BaseMover;
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
    this.renderer.setRotateTarget();
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
    if (this.selectedObject && target) {
      this.doMove(target);
    }

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

    this.updateRenderer(target);
  };

  private updateFixedLine(event: MouseHandlerEvent) {
    const isFixedLine = event.modifiers.ArrowUp;
    if (isFixedLine === !!this.fixedLine) {
      return;
    }

    if (!isFixedLine) {
      this.fixedLine = undefined;
    } else if (this.mover && this.lastTarget) {
      this.fixedLine = new THREE.Line3(
        this.mover.startPoint,
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
    return this.mover !== undefined;
  }

  private initMove(target: Target) {
    const subShape = target.vertex ?? target.edge ?? target.face;
    if (!this.selectedObject || !subShape) {
      return;
    }

    const mover = moverFactory(
      this.tool,
      this.selectedObject.part,
      subShape,
      target,
    );
    if (mover.isMovable()) {
      this.mover = mover;
      this.selectedObject.traverse((object) => {
        object.layers.set(1);
      });
      this.lastTarget = undefined;
      this.fixedLine = undefined;
      this.updateConstraints();
    } else {
      // TODO: indicate this in the UI
      console.warn('Part cannot be moved in this direction');
    }
  }

  private endMove() {
    if (this.selectedObject) {
      this.selectedObject.traverse((object) => {
        object.layers.set(0);
      });
    }
    this.mover = undefined;
    this.lastTarget = undefined;
    this.fixedLine = undefined;
    this.updateConstraints();
  }

  private cancelMove() {
    if (this.mover) {
      this.mover.cancel();
    }
    this.endMove();
  }

  private doMove(target: Target) {
    if (!this.mover) {
      return;
    }
    const delta = target.constrainedPoint.clone().sub(this.mover.startPoint);
    this.mover.move(delta);
    this.lastTarget = target;
  }

  private confirmMove(target: Target) {
    this.doMove(target);
    this.endMove();
  }

  private updateConstraints() {
    if (this.fixedLine) {
      this.targetFinder.setConstraintLine(this.fixedLine);
    } else if (this.mover) {
      const constraint = this.mover.getConstraint();
      if (constraint == null) {
        this.targetFinder.setNeighborPoint(this.mover.startPoint);
      } else if (constraint instanceof THREE.Plane) {
        this.targetFinder.setConstraintPlane(
          constraint.normal,
          this.mover.startPoint,
        );
      } else {
        this.targetFinder.setConstraintLine(constraint);
      }
    } else {
      this.targetFinder.clearConstraints();
    }
  }

  ///
  // Render the selected objects

  protected updateRenderer(target: Optional<Target>): void {
    this.updateDrawingHelper(target);
    super.updateRenderer(target);
  }

  private updateDrawingHelper(target: Optional<Target>) {
    if (!target) {
      this.drawingHelper.clear();
      return;
    }

    const lines: THREE.Line3[] = [];
    const points: THREE.Vector3[] = [];
    const faces: Face[] = [];
    const edges: Edge[] = [];

    if (this.mover && this.lastTarget) {
      lines.push(
        new THREE.Line3(
          this.mover.startPoint,
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

  getOrbitTarget(target: Target) {
    if (this.isMoving) {
      return target.point;
    } else {
      return super.getOrbitTarget(target);
    }
  }
}

export class StretchToolHandler extends MoveToolHandler {
  readonly tool = 'stretch';
}
