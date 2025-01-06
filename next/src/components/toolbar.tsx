import clsx from 'clsx';
import { IconType } from 'react-icons';
import { LiaMousePointerSolid } from 'react-icons/lia';
import { MdOutlineRectangle } from 'react-icons/md';
import Icon from './util/icon';

export interface ToolInfo {
  name: string;
  icon: IconType;
}

export const tools = ['select', 'plank'] as const;
export type Tool = (typeof tools)[number];

export const toolInfo: Record<Tool, ToolInfo> = {
  select: {
    name: 'Select',
    icon: LiaMousePointerSolid,
  },
  plank: {
    name: 'Plank',
    icon: MdOutlineRectangle,
  },
} as const;

export interface ToolbarProps {
  selected: Tool;
  onSelect: (tool: Tool) => void;
}

export default function Toolbar(props: ToolbarProps) {
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
