import { Edge, Face } from '@/lib/geom/shape';
import _ from 'lodash';
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
  Control: false,
} as const;
type MouseHandlerModifiers = typeof mouseHandlerModifiers;
type MouseHandlerEvent = BaseMouseHandlerEvent<MouseHandlerModifiers>;

export class SelectToolHandler extends ToolHandler {
  readonly tool = 'select';

  private mouseHandler: MouseHandler<MouseHandlerModifiers>;
  private targetFinder: TargetFinder;
  private drawingHelper: DrawingHelper;
  private selectedObjects: PartObject[] = [];

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
    window.addEventListener('keydown', this.onKeyDown);
  }

  private removeListeners() {
    this.mouseHandler.removeEventListener('mousemove', this.onMouseMove);
    this.mouseHandler.removeEventListener('click', this.onClick);
    window.removeEventListener('keydown', this.onKeyDown);
  }

  ///
  // Select and deselect objects

  private onMouseMove = (event: MouseHandlerEvent) => {
    const target = this.targetFinder.findTarget(event.event);
    const object = target?.object;
    this.updateDrawingHelper(object);
    this.updateRenderer(target);
  };

  private onClick = (event: MouseHandlerEvent) => {
    const target = this.targetFinder.findTarget(event.event);
    const object = target?.object;

    if (!event.modifiers.Control) {
      this.setSelectedObject(object);
    } else if (object) {
      this.toggleSelectedObject(object);
    }

    this.updateDrawingHelper(object);
    this.updateRenderer(target);
  };

  private setSelectedObject(object?: PartObject) {
    this.selectedObjects = [];
    if (object) {
      this.selectedObjects.push(object);
    }
  }

  private toggleSelectedObject(object: PartObject) {
    if (this.selectedObjects.includes(object)) {
      _.pull(this.selectedObjects, object);
    } else {
      this.selectedObjects.push(object);
    }
  }

  ///
  // Do something with the selected objects

  private onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Delete') {
      this.deleteSelectedObjects();
    }
  };

  private deleteSelectedObjects() {
    for (const object of this.selectedObjects) {
      this.renderer.model.removePart(object.part);
    }
    this.selectedObjects = [];
    this.updateDrawingHelper();
  }

  ///
  // Render the selected objects

  private updateDrawingHelper(hoveredObject?: PartObject) {
    const faces: Face[] = [];
    const edges: Edge[] = [];

    const objects = [...this.selectedObjects];
    if (hoveredObject) {
      objects.push(hoveredObject);
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

  updateRenderer(target: Target | null) {
    this.renderer.setMouseTarget(target?.constrainedPoint);
    this.renderer.render();
  }
}
