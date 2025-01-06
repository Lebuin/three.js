'use client';

import { Renderer as SceneRenderer } from '@/lib/renderer/renderer';
import React from 'react';

const Renderer: React.FC = () => {
  const mountRef = React.useRef<HTMLCanvasElement>(null);

  React.useEffect(() => {
    const mount = mountRef.current;
    if (!mount) {
      return;
    }

    const renderer = new SceneRenderer(mount);

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
