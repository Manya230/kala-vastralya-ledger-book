
import React from 'react';
import { Box, ShoppingBag, BarChart, Receipt } from 'lucide-react';

// Custom inventory icon since the native Inventory icon isn't available in lucide-react
export const Inventory = (props: React.SVGProps<SVGSVGElement>) => (
  <ShoppingBag {...props} />
);

export {
  Box,
  BarChart,
  Receipt
};
