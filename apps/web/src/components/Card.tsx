import type { HTMLAttributes } from 'react';

type CardProps = HTMLAttributes<HTMLDivElement>;

export function Card({ className = '', ...props }: CardProps) {
  return (
    <div
      className={`rounded-lg border border-rule bg-elev p-4 text-ink ${className}`.trim()}
      {...props}
    />
  );
}
