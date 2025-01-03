'use client';

import { Renderer as SceneRenderer } from '@/lib/renderer/renderer';
import React from 'react';

const Renderer: React.FC = () => {
  const mountRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const mount = mountRef.current;
    if (!mount) {
      return;
    }

    const renderer = new SceneRenderer(mount);
    mount.appendChild(renderer.domElement);
    renderer.start();

    return () => {
      renderer.destroy();
      mount.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div
      ref={mountRef}
      className="w-full h-full"
    />
  );
};

export default Renderer;
