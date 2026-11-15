import type { ReactNode } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';

interface Props {
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  /** Дополнительное действие, например «Удалить всю серию». */
  extra?: { label: string; onClick: () => void };
}

export function ConfirmDialog({ title, message, confirmLabel = 'Удалить', danger = true, onConfirm, onCancel, extra }: Props) {
  return (
    <Modal
      title={title}
      onClose={onCancel}
      footer={
        <>
          <Button variant="ghost" onClick={onCancel}>Отмена</Button>
          {extra && <Button variant="secondary" className="text-rose-600 dark:text-rose-400" onClick={extra.onClick}>{extra.label}</Button>}
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm}>{confirmLabel}</Button>
        </>
      }
    >
      <div className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">{message}</div>
    </Modal>
  );
}
