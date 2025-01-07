import clsx from 'clsx';
import React from 'react';
import { IconType } from 'react-icons';
import { LiaMousePointerSolid } from 'react-icons/lia';
import { MdOutlineRectangle } from 'react-icons/md';
import Icon from './util/icon';

export interface ToolInfo {
  name: string;
  icon: IconType;
  cursor: 'default' | 'crosshair';
}

export const tools = ['select', 'plank'] as const;
export type Tool = (typeof tools)[number];

export const toolInfo: Record<Tool, ToolInfo> = {
  select: {
    name: 'Select',
    icon: LiaMousePointerSolid,
    cursor: 'default',
  },
  plank: {
    name: 'Plank',
    icon: MdOutlineRectangle,
    cursor: 'crosshair',
  },
} as const;

export interface ToolbarProps {
  selected: Tool;
  onSelect: (tool: Tool) => void;
}

export default function Toolbar(props: ToolbarProps) {
  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        props.onSelect('select');
      } else if (event.key === 'p') {
        props.onSelect('plank');
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  return (
    <div className="flex flex-col gap-2 p-2 bg-gray-800">
      {tools.map((tool) => (
        <button
          key={tool}
          className={clsx(
            'flex gap-2 p-2 text-white rounded-md active:bg-gray-500',
            {
              'bg-gray-700 hover:bg-gray-600': tool !== props.selected,
              'bg-gray-500': tool === props.selected,
            },
          )}
          onClick={() => props.onSelect(tool)}
        >
          <Icon icon={toolInfo[tool].icon} />
        </button>
      ))}
    </div>
  );
}
