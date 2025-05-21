
import React from 'react';
import { cn } from '@/lib/utils';

interface CardProps {
  title?: string;
  className?: string;
  children: React.ReactNode;
}

const Card: React.FC<CardProps> = ({ title, className, children }) => {
  return (
    <div className={cn("kala-card", className)}>
      {title && <div className="kala-header">{title}</div>}
      <div className="p-4">
        {children}
      </div>
    </div>
  );
};

export default Card;
