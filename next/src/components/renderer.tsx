'use client';

import { Model } from '@/lib/model/model';
import { Plank } from '@/lib/model/parts/plank';
import { Renderer as SceneRenderer } from '@/lib/renderer/renderer';
import React from 'react';
import * as THREE from 'three';

const Renderer: React.FC = () => {
  const mountRef = React.useRef<HTMLCanvasElement>(null);

  React.useEffect(() => {
    const mount = mountRef.current;
    if (!mount) {
      return;
    }

    const model = new Model();
    model.addPart(
      new Plank(
        new THREE.Vector3(600, 18, 400),
        new THREE.Vector3(0, 0, 0),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, 0)),
      ),
      new Plank(
        new THREE.Vector3(600, 18, 400),
        new THREE.Vector3(0, 600 - 18, 0),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, 0)),
      ),
      new Plank(
        new THREE.Vector3(600, 18, 400),
        new THREE.Vector3(18, 0, 0),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, Math.PI / 2)),
      ),
      new Plank(
        new THREE.Vector3(600, 18, 400),
        new THREE.Vector3(600, 0, 0),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, Math.PI / 2)),
      ),
    );
    const renderer = new SceneRenderer(mount, model);

    return () => {
      renderer.destroy();
    };
  }, []);

  return (
    <canvas
      ref={mountRef}
      className="w-full h-full"
    />
  );
};

export default Renderer;
