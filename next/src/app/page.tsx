'use client';

import Renderer from '@/components/renderer';
import Toolbar, { Tool } from '@/components/toolbar';
import React from 'react';
import { useImmer } from 'use-immer';

interface MainPageState {
  selectedTool: Tool;
}

export default function MainPage() {
  const [state, setState] = useImmer<MainPageState>({
    selectedTool: 'select',
  });

  const setSelectedTool = React.useCallback(
    (tool: Tool) => {
      setState((state) => {
        if (tool != state.selectedTool) {
          state.selectedTool = tool;
        }
      });
    },
    [setState],
  );

  return (
    <div className="w-screen h-screen flex">
      <Toolbar
        selected={state.selectedTool}
        onSelect={setSelectedTool}
      />
      <Renderer
        tool={state.selectedTool}
        onTool={setSelectedTool}
      />
    </div>
  );
}
