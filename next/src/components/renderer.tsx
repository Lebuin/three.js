'use client';

import { initModel, Model } from '@/lib/model/model';
import { Renderer as SceneRenderer } from '@/lib/renderer/renderer';
import { initOC } from '@lib/opencascade.js';
import React from 'react';
import { Tool, toolInfo } from './toolbar';

export interface RendererProps {
  tool: Tool;
  onTool: (tool: Tool) => void;
}
export interface RendererState {
  ocReady: boolean;
}

export default function Renderer(props: RendererProps) {
  const [state, setState] = React.useState<RendererState>({ ocReady: false });
  const rendererRef = React.useRef<SceneRenderer | null>(null);

  React.useEffect(() => {
    initOC()
      .then(() => {
        setState({ ocReady: true });
      })
      .catch((e: unknown) => {
        console.error(e);
      });
  }, []);

  const mountRef = React.useCallback(
    (mount: HTMLCanvasElement | null) => {
      if (!mount) {
        return;
      }

      const model = new Model();
      void initModel(model);

      const renderer = new SceneRenderer(mount, model);
      renderer.addEventListener('tool', (event) => {
        props.onTool.call(null, event.tool);
      });
      rendererRef.current = renderer;

      return () => {
        renderer.delete();
      };
    },
    [props.onTool],
  );

  React.useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer) {
      return;
    }

    renderer.setTool(props.tool);
  }, [props.tool]);

  if (!state.ocReady) {
    return <></>;
  }

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
