import { forwardRef, useEffect, useState, useRef, useId, type InputHTMLAttributes, type PropsWithChildren } from 'react';
import * as Dialog from '@radix-ui/react-dialog';

type SheetProps = PropsWithChildren<{
  open: boolean; onOpenChange: (value: boolean) => void; title: string; description?: string; snap?: number;
}>;

// Position inside the visual viewport so the real mobile keyboard cannot cover the sheet.
export function BottomSheet({ open, onOpenChange, title, description, children }: SheetProps) {
  const content = useRef<HTMLDivElement>(null);
  const descriptionId = useId();
  const [viewport, setViewport] = useState({ height: window.innerHeight, bottom: 0 });
  useEffect(() => {
    if (!open) return;
    const vv = window.visualViewport;
    const update = () => setViewport({ height: vv?.height ?? window.innerHeight,
      bottom: Math.max(0, window.innerHeight - (vv?.height ?? window.innerHeight) - (vv?.offsetTop ?? 0)) });
    update();
    vv?.addEventListener('resize', update); vv?.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    return () => { vv?.removeEventListener('resize', update); vv?.removeEventListener('scroll', update); window.removeEventListener('resize', update); };
  }, [open]);
  return <Dialog.Root open={open} onOpenChange={onOpenChange}><Dialog.Portal>
    <Dialog.Overlay className="application-overlay" />
    <Dialog.Content ref={content} className="application-sheet" style={{ maxHeight: Math.max(160, viewport.height - 20), bottom: viewport.bottom }}
      aria-describedby={description ? descriptionId : undefined} onOpenAutoFocus={e => {
        // Open without summoning the keyboard; preserve focus trapping and Escape.
        e.preventDefault(); content.current?.focus();
      }}>
      <div className="sheet-header"><Dialog.Title className="sheet-title">{title}</Dialog.Title>
        {description && <Dialog.Description id={descriptionId} className="sheet-description">{description}</Dialog.Description>}
      </div>
      <div className="sheet-content">{children}</div>
    </Dialog.Content>
  </Dialog.Portal></Dialog.Root>;
}
export function MobileScroll({ children, className = '' }: PropsWithChildren<{ className?: string }>) {
  return <div className={`native-scroll ${className}`}>{children}</div>;
}
export const KeyboardInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>((props, ref) => <input {...props} ref={ref} />);
const keyboard = { hide() { if (document.activeElement instanceof HTMLInputElement) document.activeElement.blur(); } };
export function useKeyboard() { return keyboard; }
