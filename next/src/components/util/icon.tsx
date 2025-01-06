import { IconType } from 'react-icons';

export interface IconProps {
  size?: number;
  icon: IconType;
}

export default function Icon({ size = 24, icon: IconType }: IconProps) {
  return <IconType size={size} />;
}
