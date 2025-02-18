import { Edge, Face } from '@/lib/geom/shape';
import { Part } from '@/lib/model/parts';
import { Solver } from '@/lib/solver';
import { popFromSet } from '@/lib/util';
import { THREE } from '@lib/three.js';
import {
  DimensionHelper,
  DimensionHelperEvents,
} from '../helpers/dimension-helper';
import { DrawingHelper } from '../helpers/drawing-helper';
import { PartObject } from '../part-objects';
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
  Control: false,
  ArrowUp: true,
} as const;
type MouseHandlerModifiers = typeof mouseHandlerModifiers;
type MouseHandlerEvent = BaseMouseHandlerEvent<MouseHandlerModifiers>;

export class MoveToolHandler extends ToolHandler {
  readonly tool: MoveTool = 'move';

  private mouseHandler: MouseHandler<MouseHandlerModifiers>;
  private targetFinder: TargetFinder;
  private drawingHelper: DrawingHelper;
  protected dimensionHelper: DimensionHelper;

  private selectedObject?: PartObject;
  private mover?: BaseMover;
  private lastPoint?: THREE.Vector3;
  private fixedLine?: THREE.Line3;

  private solver?: Solver;
  private shouldSolveModel = false;

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

    this.dimensionHelper = new DimensionHelper();
    this.dimensionHelper.visible = false;
    this.renderer.addUpdating(this.dimensionHelper);

    this.setupListeners();
  }

  delete() {
    super.delete();
    this.cancelMove();
    this.mouseHandler.delete();
    this.targetFinder.delete();
    this.dimensionHelper.delete();
    this.renderer.removeUpdating(this.drawingHelper, this.dimensionHelper);
    this.renderer.setRotateTarget();
    this.removeListeners();
  }

  private setupListeners() {
    this.mouseHandler.addEventListener('mousemove', this.onMouseMove);
    this.mouseHandler.addEventListener('click', this.onClick);
    this.dimensionHelper.addEventListener('submit', this.onDimensionSubmit);
  }

  private removeListeners() {
    this.mouseHandler.removeEventListener('mousemove', this.onMouseMove);
    this.mouseHandler.removeEventListener('click', this.onClick);
    this.dimensionHelper.removeEventListener('submit', this.onDimensionSubmit);
  }

  ///
  // Handle events

  private onMouseMove = (event: MouseHandlerEvent) => {
    this.updateFixedLine(event);
    this.updateSolver(event);

    const target = this.targetFinder.findTarget(event.event);
    if (this.selectedObject && target) {
      this.doMove(target.constrainedPoint);
    }

    this.updateRenderer(target);
  };

  private onClick = (event: MouseHandlerEvent) => {
    this.updateFixedLine(event);
    const target = this.targetFinder.findTarget(event.event);
    const object = target?.object;

    if (this.isMoving) {
      if (target) {
        this.confirmMove(target.constrainedPoint);
        this.unsetSelectedObject();
      }
    } else if (object) {
      this.setSelectedObject(object, target);
    } else {
      this.unsetSelectedObject();
    }

    this.updateRenderer(target);
  };

  protected onDimensionSubmit = (event: DimensionHelperEvents['submit']) => {
    this.confirmMove(event.point);
    this.unsetSelectedObject();
    this.updateRenderer();
  };

  private updateFixedLine(event: MouseHandlerEvent) {
    const isFixedLine = event.modifiers.ArrowUp;
    if (isFixedLine === !!this.fixedLine) {
      return;
    }

    if (!isFixedLine) {
      this.fixedLine = undefined;
    } else if (this.mover && this.lastPoint) {
      this.fixedLine = new THREE.Line3(this.mover.startPoint, this.lastPoint);
    }
    this.updateConstraints();
  }

  private setSelectedObject(object: PartObject, target: Target) {
    this.selectedObject = object;
    this.updateSnappingParts();
    this.initMove(target);
  }
  private unsetSelectedObject() {
    this.cancelMove();
    this.selectedObject = undefined;
    this.updateSnappingParts();
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
    if (!mover.isMovable()) {
      // TODO: indicate this in the UI
      console.warn('Part cannot be moved in this direction');
      return;
    }

    this.mover = mover;
    this.lastPoint = target.constrainedPoint;
    this.fixedLine = undefined;
    this.updateConstraints();
    this.createSolver();
  }

  private endMove() {
    this.mover = undefined;
    this.solver = undefined;
    this.lastPoint = undefined;
    this.fixedLine = undefined;
    this.updateConstraints();
  }

  private doMove(point: THREE.Vector3) {
    if (!this.mover) {
      return;
    }
    const delta = point.clone().sub(this.mover.startPoint);
    this.mover.move(delta);
    this.lastPoint = point;
    this.solveModel();
  }

  private cancelMove() {
    if (this.solver) {
      this.solver.restoreModel();
    }
    this.endMove();
  }

  private confirmMove(point: THREE.Vector3) {
    this.doMove(point);

    if (this.selectedObject) {
      this.model.removeConstraints(this.selectedObject.part);
      this.model.addCoincidentConstraints(this.selectedObject.part);
    }

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

  protected updateSnappingParts() {
    const connectedParts = this.getConnectedParts();
    for (const partObject of this.renderer.partObjects) {
      const layer = connectedParts.has(partObject.part) ? 1 : 0;
      partObject.traverse((object) => {
        object.layers.set(layer);
      });
    }
    this.targetFinder.updateSnapObjects();
  }

  protected getConnectedParts(): Set<Part> {
    if (!this.selectedObject) {
      return new Set<Part>();
    } else if (!this.shouldSolveModel) {
      return new Set([this.selectedObject.part]);
    }

    const connectedParts = new Set<Part>();
    const partsToCheck = new Set([this.selectedObject.part]);
    while (partsToCheck.size > 0) {
      const part = popFromSet(partsToCheck);
      connectedParts.add(part);
      for (const connectedPart of part.getConnectedParts()) {
        if (!connectedParts.has(connectedPart)) {
          partsToCheck.add(connectedPart);
        }
      }
    }

    return connectedParts;
  }

  ///
  // Render the selected objects

  protected updateRenderer(target?: Optional<Target>): void {
    this.updateDrawingHelper(target);
    this.updateDimensionHelper(target);
    super.updateRenderer(target);
  }

  private updateDrawingHelper(target?: Optional<Target>) {
    if (!target) {
      this.drawingHelper.clear();
      return;
    }

    const lines: THREE.Line3[] = [];
    const points: THREE.Vector3[] = [];
    const faces: Face[] = [];
    const edges: Edge[] = [];

    if (target.object) {
      points.push(target.point);
    }

    const objects: PartObject[] = [];

    if (this.isMoving) {
      objects.push(this.selectedObject!);
      lines.push(
        new THREE.Line3(this.mover!.startPoint, target.constrainedPoint),
      );
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

  protected updateDimensionHelper(target?: Optional<Target>) {
    if (!target || !this.mover) {
      this.dimensionHelper.visible = false;
      return;
    }

    const line = new THREE.Line3(
      this.mover.startPoint,
      target.constrainedPoint,
    );
    this.dimensionHelper.setLine(line);
    this.dimensionHelper.visible = true;
  }

  ///
  // Solve the model

  private createSolver() {
    if (!this.selectedObject) {
      throw new Error('Illegal state');
    }
    const draggedParts = new Set([this.selectedObject.part]);
    this.solver = new Solver();
    this.solver.buildSketch(this.renderer.model, draggedParts);
  }

  private updateSolver(event: MouseHandlerEvent) {
    const shouldSolveModel = !event.modifiers.Control;
    if (shouldSolveModel === this.shouldSolveModel) {
      return;
    }

    this.shouldSolveModel = shouldSolveModel;
    if (this.solver && !this.shouldSolveModel) {
      this.solver.restoreModel();
    }
    this.updateSnappingParts();
  }

  private solveModel() {
    if (!this.solver) {
      throw new Error('Illegal state');
    }

    if (this.shouldSolveModel) {
      this.solver.reset();
      this.solver.solve();
      this.solver.apply();
    }
  }
}

export class StretchToolHandler extends MoveToolHandler {
  readonly tool = 'stretch';
}
