import { Edge, Face } from '@/lib/geom/shape';
import { DrawingHelper } from '../helpers/drawing-helper';
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

  private mouseHandler: MouseHandler<MouseHandlerModifiers>;
  private targetFinder: TargetFinder;
  private drawingHelper: DrawingHelper;
  private selectedObjects = new Set<PartObject>();

  constructor(renderer: Renderer) {
    super(renderer);

    this.mouseHandler = new MouseHandler(
      renderer.canvas,
      mouseHandlerModifiers,
    );
    this.targetFinder = new TargetFinder(renderer);
    this.drawingHelper = new DrawingHelper();
    this.renderer.addUpdating(this.drawingHelper);

    this.setupListeners();
  }

  delete() {
    super.delete();
    this.mouseHandler.delete();
    this.targetFinder.delete();
    this.renderer.removeUpdating(this.drawingHelper);
    this.renderer.setMouseTarget();
    this.removeListeners();
  }

  private setupListeners() {
    this.mouseHandler.addEventListener('mousemove', this.onMouseMove);
    this.mouseHandler.addEventListener('click', this.onClick);
    keyboardHandler.addEventListener('keydown', this.onKeyDown);
  }

  private removeListeners() {
    this.mouseHandler.removeEventListener('mousemove', this.onMouseMove);
    this.mouseHandler.removeEventListener('click', this.onClick);
    keyboardHandler.removeEventListener('keydown', this.onKeyDown);
  }

  ///
  // Select and deselect objects

  private onMouseMove = (event: MouseHandlerEvent) => {
    const target = this.targetFinder.findTarget(event.event);
    this.updateRenderer(target);
  };

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
