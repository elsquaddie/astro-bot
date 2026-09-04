import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { clsx } from 'clsx';

// Editable Radix/cva primitive, following the shadcn/ui composition pattern.
const variants = cva('sky-button', { variants: {
  variant: { primary: 'sky-button-primary', secondary: 'sky-button-secondary', ghost: 'sky-button-ghost' },
}, defaultVariants: { variant: 'primary' } });
export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof variants> & { asChild?: boolean }>(function Button({ className, variant, asChild, ...props }, ref) {
  const Component = asChild ? Slot : 'button';
  return <Component ref={ref} className={clsx(variants({ variant }), className)} {...props} />;
});
