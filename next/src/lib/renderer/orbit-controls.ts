import * as THREE from 'three';
import { OrbitControls as DefaultOrbitControls } from 'three/examples/jsm/Addons.js';

export class OrbitControls extends DefaultOrbitControls {
  mouseButtons = {
    LEFT: null,
    MIDDLE: null,
    RIGHT: THREE.MOUSE.ROTATE,
  };

  zoomToCursor = true;
  zoomSpeed = 2;
  minZoom = 0.05;
}
