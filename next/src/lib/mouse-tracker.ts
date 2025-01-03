export interface MouseTrackerOptions<T> {
  elem: HTMLElement;
  onMouseDown: (event: MouseEvent) => T;
  onMouseMove: (
    data: T,
    totalDrag: MouseDrag,
    lastDrag: MouseDrag,
    event: MouseEvent,
  ) => void;
  onMouseUp?: (event: MouseEvent) => void;
  filter?: (event: MouseEvent) => boolean;
}

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

  constructor(private options: MouseTrackerOptions<T>) {}

  start() {
    this.options.elem.addEventListener('mousedown', this.onMouseDown);
  }

  stop() {
    this.options.elem.removeEventListener('mousedown', this.onMouseDown);
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

    if (this.options.filter && !this.options.filter(event)) {
      return;
    }

    const mousePosition = this.getMousePosition(event);
    const data = this.options.onMouseDown(event);
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

    this.options.onMouseMove(
      this.mouseDownData.data,
      totalDrag,
      lastDrag,
      event,
    );
  };

  private onMouseUp = (event: MouseEvent) => {
    if (!this.mouseDownData) {
      return;
    }
    if (this.options.onMouseUp) {
      this.options.onMouseUp(event);
    }
    this.mouseDownData = undefined;

    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('mouseup', this.onMouseUp);
  };
}
