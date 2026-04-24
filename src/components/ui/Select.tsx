import React from 'react';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  children: React.ReactNode;
}

export const Select: React.FC<SelectProps> = ({
  className = '',
  children,
  ...props
}) => {
  return (
    <select
      className={`w-full rounded-xl border border-border bg-card px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary ${className}`}
      {...props}
    >
      {children}
    </select>
  );
};


