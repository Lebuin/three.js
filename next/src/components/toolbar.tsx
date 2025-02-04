import clsx from 'clsx';
import React from 'react';
import { IconType } from 'react-icons';
import { LiaMousePointerSolid } from 'react-icons/lia';
import { MdOutlineRectangle } from 'react-icons/md';
import { RiDragMove2Fill } from 'react-icons/ri';
import Icon from './util/icon';

export interface ToolInfo {
  name: string;
  icon: IconType;
  cursor: 'default' | 'crosshair' | 'move';
  shortcut: string;
}

export const tools = ['select', 'board', 'move'] as const;
export type Tool = (typeof tools)[number];

export const toolInfo: Record<Tool, ToolInfo> = {
  select: {
    name: 'Select',
    icon: LiaMousePointerSolid,
    cursor: 'default',
    shortcut: ' ',
  },
  board: {
    name: 'Board',
    icon: MdOutlineRectangle,
    cursor: 'crosshair',
    shortcut: 'b',
  },
  move: {
    name: 'Move',
    icon: RiDragMove2Fill,
    cursor: 'move',
    shortcut: 'm',
  },
} as const;

export interface ToolbarProps {
  selected: Tool;
  onSelect: (tool: Tool) => void;
}

export default function Toolbar(props: ToolbarProps) {
  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      for (const [tool, info] of Object.entries(toolInfo)) {
        if (info.shortcut.toLowerCase() === event.key.toLowerCase()) {
          props.onSelect.call(null, tool as Tool);
        }
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [props.onSelect]);

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
