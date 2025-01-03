interface MousePosition {
  x: number;
  y: number;
}
export type MouseDrag = MousePosition;

interface MouseDownData<T> {
  data: T;
  mouseStart: MousePosition;
  mouseLast: MousePosition;
}

export interface DragEvent<T> {
  data: T;
  totalDragDistance: MouseDrag;
  lastDragDistance: MouseDrag;
}

export class MouseTracker<T> {
  private mouseDownData?: MouseDownData<T>;

  constructor(
    private elem: HTMLElement,
    private mouseDownCallback: (event: MouseEvent) => T,
    private mouseMoveCallback: (
      data: T,
      totalDrag: MouseDrag,
      lastDrag: MouseDrag,
      event: MouseEvent,
    ) => void,
    private mouseUpCallback?: (event: MouseEvent) => void,
  ) {}

  start() {
    this.elem.addEventListener('mousedown', this.onMouseDown);
  }

  stop() {
    this.elem.removeEventListener('mousedown', this.onMouseDown);
  }

  private getMousePosition(event: MouseEvent): MousePosition {
    return {
      x: event.clientX,
      y: event.clientY,
    };
  }

  private onMouseDown = (event: MouseEvent) => {
    if (this.mouseDownData) {
      this.onMouseUp(event);
    }

    const mousePosition = this.getMousePosition(event);
    const data = this.mouseDownCallback(event);
    this.mouseDownData = {
      data: data,
      mouseStart: { ...mousePosition },
      mouseLast: { ...mousePosition },
    };

    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('mouseup', this.onMouseUp);
  };

  private onMouseMove = (event: MouseEvent) => {
    if (!this.mouseDownData) {
      return;
    }

    const mousePosition = this.getMousePosition(event);
    const totalDrag: MouseDrag = {
      x: mousePosition.x - this.mouseDownData.mouseStart.x,
      y: mousePosition.y - this.mouseDownData.mouseStart.y,
    };
    const lastDrag: MouseDrag = {
      x: mousePosition.x - this.mouseDownData.mouseLast.x,
      y: mousePosition.y - this.mouseDownData.mouseLast.y,
    };
    this.mouseDownData.mouseLast = { ...mousePosition };

    this.mouseMoveCallback(this.mouseDownData.data, totalDrag, lastDrag, event);
  };

  private onMouseUp = (event: MouseEvent) => {
    if (!this.mouseDownData) {
      return;
    }
    if (this.mouseUpCallback) {
      this.mouseUpCallback(event);
    }
    this.mouseDownData = undefined;

    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('mouseup', this.onMouseUp);
  };
}
