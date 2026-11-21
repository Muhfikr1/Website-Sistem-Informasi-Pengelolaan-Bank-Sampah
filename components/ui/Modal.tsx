"use client";

import { useEffect, useRef, type ReactNode } from "react";

interface ModalProps {
  /** id elemen judul (h2/h3) di dalam modal; dibaca pembaca layar sebagai nama dialog. */
  labelledBy: string;
  onClose: () => void;
  /** Tahan penutupan (Esc, klik latar, tombol batal) selama proses berjalan, misalnya saat menyimpan. */
  disableClose?: boolean;
  /** id elemen yang mendapat fokus pertama (misalnya kolom isian pertama). Bawaan: elemen pertama yang bisa difokus. */
  initialFocusId?: string;
  /** Kelas lebar, contoh: "max-w-lg". */
  className?: string;
  children: ReactNode;
}

/**
 * Dialog modal berbasis elemen <dialog> bawaan browser. Gratis dari browser:
 *  - fokus terkunci di dalam dialog (Tab tidak keluar ke halaman di belakang),
 *  - tombol Esc menutup dialog,
 *  - fokus dikembalikan ke tombol pembuka saat dialog ditutup,
 *  - role="dialog" dan aria-modal sudah implisit.
 * Render komponen ini hanya saat modal harus tampil: {open && <Modal ...>}.
 */
export default function Modal({
  labelledBy,
  onClose,
  disableClose = false,
  initialFocusId,
  className = "max-w-lg",
  children,
}: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const latest = useRef({ onClose, disableClose });

  useEffect(() => {
    latest.current = { onClose, disableClose };
  });

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    if (initialFocusId) document.getElementById(initialFocusId)?.focus();

    // Esc: cegah penutupan bawaan agar logika penutupan tetap di tangan induk
    const handleCancel = (event: Event) => {
      event.preventDefault();
      if (!latest.current.disableClose) latest.current.onClose();
    };
    // Klik pada latar gelap (target = dialog itu sendiri, bukan isinya)
    const handleClick = (event: MouseEvent) => {
      if (event.target === dialog && !latest.current.disableClose) latest.current.onClose();
    };

    dialog.addEventListener("cancel", handleCancel);
    dialog.addEventListener("click", handleClick);
    return () => {
      dialog.removeEventListener("cancel", handleCancel);
      dialog.removeEventListener("click", handleClick);
      if (dialog.open) dialog.close();
    };
    // Hanya dijalankan saat dipasang; nilai terbaru dibaca lewat ref
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={labelledBy}
      className={`m-auto w-[calc(100%-2rem)] rounded-2xl bg-white p-0 text-neutral-900 shadow-2xl backdrop:bg-black/50 ${className}`}
    >
      {children}
    </dialog>
  );
}
