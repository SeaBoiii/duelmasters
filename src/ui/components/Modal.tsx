import type { ReactNode } from "react";

interface ModalProps {
  title: string;
  open: boolean;
  onClose?: () => void;
  children: ReactNode;
}

export function Modal({ title, open, onClose, children }: ModalProps) {
  if (!open) {
    return null;
  }
  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="modal-header">
          <h3>{title}</h3>
          {onClose ? (
            <button type="button" onClick={onClose}>
              Close
            </button>
          ) : null}
        </header>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}
