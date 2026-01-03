import React from 'react';

interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export const Checkbox: React.FC<CheckboxProps> = ({
  label,
  className = '',
  ...props
}) => {
  return (
    <div className="flex items-center">
      <input
        type="checkbox"
        className={`w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500 ${className}`}
        {...props}
      />
      {label && (
        <label htmlFor={props.id} className="ml-2 text-sm text-gray-700">
          {label}
        </label>
      )}
    </div>
  );
};


