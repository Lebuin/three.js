import { Edge, Face } from '@/lib/geom/shape';
import { mouseButtonPressed } from '@/lib/util';
import { THREE } from '@lib/three.js';
import { Frustum } from '../frustum';
import { DrawingHelper } from '../helpers/drawing-helper';
import { Direction, SelectionBoxHelper } from '../helpers/selection-box-helper';
import { PartObject } from '../part-objects/part-object';
import { Renderer } from '../renderer';
import {
  keyboardHandler,
  KeyboardHandlerEvent,
  KeyCombo,
} from './keyboard-handler';
import {
  MouseHandlerEvent as BaseMouseHandlerEvent,
  MouseHandler,
} from './mouse-handler';
import { Target, TargetFinder } from './target-finder';
import { ToolHandler } from './tool-handler';

const mouseHandlerModifiers = {
  Control: false,
} as const;
type MouseHandlerModifiers = typeof mouseHandlerModifiers;
type MouseHandlerEvent = BaseMouseHandlerEvent<MouseHandlerModifiers>;

export class SelectToolHandler extends ToolHandler {
  readonly tool = 'select';
  readonly mouseMovedThreshold = 5;

  private mouseHandler: MouseHandler<MouseHandlerModifiers>;
  private targetFinder: TargetFinder;
  private drawingHelper: DrawingHelper;
  private selectionBoxHelper: SelectionBoxHelper;

  private mouseDownEvent?: MouseHandlerEvent;
  private selectedObjects = new Set<PartObject>();

  constructor(renderer: Renderer) {
    super(renderer);

    this.mouseHandler = new MouseHandler(
      renderer.canvas,
      mouseHandlerModifiers,
    );
    this.targetFinder = new TargetFinder(renderer);
    this.drawingHelper = new DrawingHelper();
    this.selectionBoxHelper = new SelectionBoxHelper(renderer);
    this.selectionBoxHelper.visible = false;
    this.renderer.addUpdating(this.drawingHelper, this.selectionBoxHelper);

    this.setupListeners();
  }

  delete() {
    super.delete();
    this.mouseHandler.delete();
    this.targetFinder.delete();
    this.renderer.removeUpdating(this.drawingHelper, this.selectionBoxHelper);
    this.renderer.setMouseTarget();
    this.removeListeners();
  }

  private setupListeners() {
    this.mouseHandler.addEventListener('mousedown', this.onMouseDown);
    this.mouseHandler.addEventListener('mouseup', this.onMouseUp);
    this.mouseHandler.addEventListener('mousemove', this.onMouseMove);
    keyboardHandler.addEventListener('keydown', this.onKeyDown);
  }

  private removeListeners() {
    this.mouseHandler.removeEventListener('mousedown', this.onMouseDown);
    this.mouseHandler.removeEventListener('mouseup', this.onMouseUp);
    this.mouseHandler.removeEventListener('mousemove', this.onMouseMove);
    keyboardHandler.removeEventListener('keydown', this.onKeyDown);
  }

  ///
  // Select and deselect objects

  private get isDragging() {
    return !!this.mouseDownEvent;
  }

  private onMouseDown = (event: MouseHandlerEvent) => {
    if (!mouseButtonPressed(event.event, 'left')) {
      return;
    }

    this.mouseDownEvent = event;
    const pointer = this.renderer.getPointerFromEvent(event.event);
    this.selectionBoxHelper.start = pointer.clone();
    this.selectionBoxHelper.end = pointer.clone();
  };

  private onMouseUp = (event: MouseHandlerEvent) => {
    if (!this.mouseDownEvent) {
      return;
    }

    const mouseStart = new THREE.Vector2(
      this.mouseDownEvent.event.clientX,
      this.mouseDownEvent.event.clientY,
    );
    const mouseEnd = new THREE.Vector2(
      event.event.clientX,
      event.event.clientY,
    );
    const mouseMoved =
      mouseStart.distanceTo(mouseEnd) > this.mouseMovedThreshold;

    this.mouseDownEvent = undefined;
    this.selectionBoxHelper.visible = false;
    if (mouseMoved) {
      this.onMouseMove(event);
    } else {
      this.onClick(event);
    }
  };

  private onMouseMove = (event: MouseHandlerEvent) => {
    if (this.isDragging) {
      this.onDrag(event);
      return;
    }

    const target = this.targetFinder.findTarget(event.event);
    this.updateRenderer(target);
  };

  private onDrag(event: MouseHandlerEvent) {
    const pointer = this.renderer.getPointerFromEvent(event.event);
    this.selectionBoxHelper.end = pointer;
    this.selectionBoxHelper.visible = true;

    const frustum = Frustum.createFromSelection(
      this.renderer.camera,
      this.selectionBoxHelper.start,
      this.selectionBoxHelper.end,
    );
    const objects =
      this.selectionBoxHelper.direction === Direction.TO_RIGHT
        ? frustum.getContained(this.renderer.partObjects)
        : frustum.getIntersecting(this.renderer.partObjects);
    this.setSelectedObjects(objects);

    this.updateRenderer();
  }

  private onClick = (event: MouseHandlerEvent) => {
    const target = this.targetFinder.findTarget(event.event);

    const objects = target?.object ? [target.object] : [];
    if (event.modifiers.Control) {
      this.toggleSelectedObjects(objects);
    } else {
      this.setSelectedObjects(objects);
    }

    this.updateRenderer(target);
  };

  private setSelectedObjects(objects: PartObject[]) {
    this.selectedObjects = new Set(objects);
  }

  private toggleSelectedObjects(objects: PartObject[]) {
    const newObjects = new Set(objects);
    const hasNewObjects = !newObjects.isSubsetOf(this.selectedObjects);
    if (hasNewObjects) {
      this.selectedObjects = this.selectedObjects.union(newObjects);
    } else {
      this.selectedObjects = this.selectedObjects.difference(newObjects);
    }
  }

  ///
  // Do something with the selected objects

  private onKeyDown = (event: KeyboardHandlerEvent) => {
    // Key events also trigger a mouse move event through MouseHandler, so we don't need to update
    // the renderer or drawing helper here.
    if (event.keyCombo.equals(new KeyCombo('Delete'))) {
      this.deleteSelectedObjects();
    } else if (event.keyCombo.equals(new KeyCombo('a', { ctrl: true }))) {
      this.setSelectedObjects(this.renderer.partObjects);
    } else {
      return;
    }

    const mouseEvent = this.mouseHandler.mouseMoveEvent;
    const target = mouseEvent ? this.targetFinder.findTarget(mouseEvent) : null;
    this.updateRenderer(target);
  };

  private deleteSelectedObjects() {
    for (const object of this.selectedObjects) {
      this.renderer.model.removePart(object.part);
    }
    this.setSelectedObjects([]);
    this.updateRenderer();
  }

  ///
  // Render the selected objects

  protected updateRenderer(target?: Optional<Target>) {
    this.updateDrawingHelper(target);
    super.updateRenderer(target);
  }

  private updateDrawingHelper(target: Optional<Target>) {
    const faces: Face[] = [];
    const edges: Edge[] = [];

    const objects = [...this.selectedObjects];
    if (target?.object) {
      objects.push(target.object);
    }

    for (const object of objects) {
      if ('faces' in object.part.shape) {
        faces.push(...object.part.shape.faces);
      }
      edges.push(...object.part.shape.edges);
    }

    this.drawingHelper.setFaces(faces);
    this.drawingHelper.setEdges(edges);
  }
}
