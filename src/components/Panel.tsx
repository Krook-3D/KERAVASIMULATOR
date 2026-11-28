import type { ReactNode } from 'react';

interface PanelProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
}

export function Panel({ title, onClose, children }: PanelProps) {
  return (
    <section className="card panel" aria-label={title}>
      <header className="panel__header">
        <h2 className="panel__title">{title}</h2>
        <button type="button" className="panel__close" onClick={onClose} aria-label="Sulje">
          ✕
        </button>
      </header>
      <div className="panel__body">{children}</div>
    </section>
  );
}
