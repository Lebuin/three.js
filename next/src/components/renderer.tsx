'use client';

import { Model } from '@/lib/model/model';
import { Renderer as SceneRenderer } from '@/lib/renderer/renderer';
import { initOC } from '@lib/opencascade.js';
import { initSolveSpace } from '@lib/solvespace';
import React from 'react';
import { useImmer } from 'use-immer';
import { Tool, toolInfo } from './toolbar';

export interface RendererProps {
  tool: Tool;
  onTool: (tool: Tool) => void;
}
export interface RendererState {
  ocReady: boolean;
  slvsReady: boolean;
}

export default function Renderer(props: RendererProps) {
  const [state, setState] = useImmer<RendererState>({
    ocReady: false,
    slvsReady: false,
  });
  const rendererRef = React.useRef<SceneRenderer | null>(null);

  React.useEffect(() => {
    initOC()
      .then(() => {
        setState((state) => {
          state.ocReady = true;
        });
      })
      .catch((e: unknown) => {
        console.error(e);
      });
  }, [setState]);

  React.useEffect(() => {
    initSolveSpace()
      .then(() => {
        setState((state) => {
          state.slvsReady = true;
        });
      })
      .catch((e: unknown) => {
        console.error(e);
      });
  }, [setState]);

  const mountRef = React.useCallback(
    (mount: HTMLCanvasElement | null) => {
      if (!mount) {
        return;
      }

      const model = new Model();
      // void initModel(model);

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

  if (!state.ocReady || !state.slvsReady) {
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
