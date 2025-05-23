
import React from 'react';
import { Box, ShoppingBag, BarChart, Receipt } from 'lucide-react';

// Custom inventory icon with proper typing for size and className props
export interface IconProps extends React.SVGProps<SVGSVGElement> {
  size?: number;
  className?: string;
}

export const Inventory = ({ size = 24, className, ...props }: IconProps) => (
  <ShoppingBag 
    width={size}
    height={size}
    className={className}
    {...props}
  />
);

export {
  Box,
  BarChart,
  Receipt
};
