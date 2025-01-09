'use client';

import { Model } from '@/lib/model/model';
import { Renderer as SceneRenderer } from '@/lib/renderer/renderer';
import React from 'react';
import { Tool, toolInfo } from './toolbar';

export interface RendererProps {
  tool: Tool;
  onTool: (tool: Tool) => void;
}

export default function Renderer(props: RendererProps) {
  const mountRef = React.useRef<HTMLCanvasElement>(null);
  const rendererRef = React.useRef<SceneRenderer | null>(null);

  React.useEffect(() => {
    const mount = mountRef.current;
    if (!mount) {
      return;
    }

    const model = new Model();
    const renderer = new SceneRenderer(mount, model);
    renderer.addEventListener('tool', (event) => {
      props.onTool.call(null, event.tool);
    });
    rendererRef.current = renderer;

    return () => {
      renderer.dispose();
    };
  }, [props.onTool]);

  React.useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer) {
      return;
    }

    renderer.setTool(props.tool);
  }, [props.tool]);

  return (
    <div className="relative flex-1">
      <canvas
        ref={mountRef}
        className="absolute top-0 left-0 w-full h-full"
        style={{ cursor: toolInfo[props.tool].cursor }}
      />
    </div>
  );
}
