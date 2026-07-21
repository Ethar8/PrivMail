import React from 'react';

interface IconProps {
  size?: number;
  className?: string;
  'aria-label'?: string;
}

const createMockIcon = (name: string) => {
  const Icon = (props: IconProps) => React.createElement('svg', { 'data-testid': `icon-${name}`, ...props });
  Icon.displayName = name;
  return Icon;
};

export const Lock = createMockIcon('lock');
export const Trash2 = createMockIcon('trash2');
export const Reply = createMockIcon('reply');
export const ShieldCheck = createMockIcon('shield-check');
export const Unlock = createMockIcon('unlock');
export const ShieldAlert = createMockIcon('shield-alert');
export const AlertTriangle = createMockIcon('alert-triangle');
export const AlertCircle = createMockIcon('alert-circle');
export const Send = createMockIcon('send');
