'use client';

import Renderer from '@/components/renderer';
import Toolbar, { Tool } from '@/components/toolbar';
import React from 'react';

interface MainPageState {
  selectedTool: Tool;
}

export default function MainPage() {
  const [state, setState] = React.useState<MainPageState>({
    selectedTool: 'select',
  });

  const setSelectedTool = React.useCallback((tool: Tool) => {
    setState((state) => ({
      ...state,
      selectedTool: tool,
    }));
  }, []);

  return (
    <div className="w-screen h-screen flex">
      <Toolbar
        selected={state.selectedTool}
        onSelect={setSelectedTool}
      />
      <Renderer tool={state.selectedTool} />
    </div>
  );
}
