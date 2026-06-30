'use client';

import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';

const fieldClass =
  'w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 focus:bg-white transition-all disabled:opacity-50';

interface FieldWrapperProps {
  id?: string;
  label: string;
  required?: boolean;
  optionalLabel?: string;
  error?: string | null;
  hideLabel?: boolean;
  children: React.ReactNode;
}

function FieldWrapper({
  id,
  label,
  required = false,
  optionalLabel,
  error,
  hideLabel = false,
  children,
}: FieldWrapperProps) {
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={id}
        className={cn(
          'text-xs font-semibold text-gray-700 uppercase tracking-wider',
          hideLabel && 'sr-only',
        )}
      >
        {label}
        {required && ' *'}
        {optionalLabel && (
          <span className="ml-1 text-[10px] font-medium normal-case tracking-normal text-gray-400">
            {optionalLabel}
          </span>
        )}
      </label>
      {children}
      {error && <p className="text-xs font-medium text-red-600">{error}</p>}
    </div>
  );
}

type InputFieldProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string | null;
  optionalLabel?: string;
  hideLabel?: boolean;
};

export function InputField({
  label,
  error,
  optionalLabel,
  hideLabel,
  className,
  required,
  id,
  ...props
}: InputFieldProps) {
  return (
    <FieldWrapper id={id} label={label} required={required} optionalLabel={optionalLabel} error={error} hideLabel={hideLabel}>
      <input
        id={id}
        required={required}
        className={cn(fieldClass, error && 'border-red-200 focus:border-red-500', className)}
        {...props}
      />
    </FieldWrapper>
  );
}

type SelectFieldProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  error?: string | null;
  optionalLabel?: string;
  hideLabel?: boolean;
  children: React.ReactNode;
};

export function SelectField({
  label,
  error,
  optionalLabel,
  hideLabel,
  className,
  required,
  id,
  children,
  ...props
}: SelectFieldProps) {
  return (
    <FieldWrapper id={id} label={label} required={required} optionalLabel={optionalLabel} error={error} hideLabel={hideLabel}>
      <select
        id={id}
        required={required}
        className={cn(fieldClass, error && 'border-red-200 focus:border-red-500', className)}
        {...props}
      >
        {children}
      </select>
    </FieldWrapper>
  );
}

type TextareaFieldProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  error?: string | null;
  optionalLabel?: string;
  hideLabel?: boolean;
};

export function TextareaField({
  label,
  error,
  optionalLabel,
  hideLabel,
  className,
  required,
  id,
  ...props
}: TextareaFieldProps) {
  return (
    <FieldWrapper id={id} label={label} required={required} optionalLabel={optionalLabel} error={error} hideLabel={hideLabel}>
      <textarea
        id={id}
        required={required}
        className={cn(fieldClass, 'resize-none', error && 'border-red-200 focus:border-red-500', className)}
        {...props}
      />
    </FieldWrapper>
  );
}

type PasswordFieldProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  label: string;
  error?: string | null;
  optionalLabel?: string;
  hideLabel?: boolean;
};

export function PasswordField({
  label,
  error,
  optionalLabel,
  hideLabel,
  className,
  required,
  id,
  ...props
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);

  return (
    <FieldWrapper id={id} label={label} required={required} optionalLabel={optionalLabel} error={error} hideLabel={hideLabel}>
      <div className="relative">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          required={required}
          className={cn(fieldClass, 'pr-11', error && 'border-red-200 focus:border-red-500', className)}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((value) => !value)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
          aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </FieldWrapper>
  );
}

