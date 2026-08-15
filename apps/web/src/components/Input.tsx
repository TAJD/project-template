import type { ComponentProps } from 'react';

// ComponentProps<'input'> (rather than InputHTMLAttributes) so callers can pass
// `ref` straight through — React 19 treats it as an ordinary prop.
interface InputProps extends ComponentProps<'input'> {
  label: string;
}

export function Input({ label, id, className = '', ...props }: InputProps) {
  const inputId = id ?? props.name;

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={inputId} className="text-sm font-medium text-ink">
        {label}
      </label>
      <input
        id={inputId}
        className={`rounded-md border border-rule bg-paper px-3 py-2 text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${className}`.trim()}
        {...props}
      />
    </div>
  );
}
