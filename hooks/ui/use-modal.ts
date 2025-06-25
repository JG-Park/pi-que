'use client';

import { useState, useCallback, useId } from 'react';

export interface UseModalOptions {
  /**
   * Initial open state of the modal
   */
  defaultOpen?: boolean;
  /**
   * Controlled open state
   */
  open?: boolean;
  /**
   * Called when the open state changes
   */
  onOpenChange?: (open: boolean) => void;
  /**
   * Modal identifier for accessibility
   */
  modalId?: string;
  /**
   * Whether clicking outside should close the modal
   */
  closeOnOutsideClick?: boolean;
  /**
   * Whether pressing escape should close the modal
   */
  closeOnEscape?: boolean;
}

export interface UseModalReturn {
  /**
   * Current open state
   */
  isOpen: boolean;
  /**
   * Open the modal
   */
  open: () => void;
  /**
   * Close the modal
   */
  close: () => void;
  /**
   * Toggle the modal
   */
  toggle: () => void;
  /**
   * Props to spread on Dialog.Root
   */
  dialogProps: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
  };
  /**
   * Props to spread on Dialog.Content
   */
  contentProps: {
    onEscapeKeyDown?: (event: KeyboardEvent) => void;
    onPointerDownOutside?: (event: Event) => void;
    'aria-describedby'?: string;
  };
  /**
   * Modal ID for accessibility
   */
  modalId: string;
  /**
   * Description ID for accessibility
   */
  descriptionId: string;
}

/**
 * Custom hook for managing modal state with Radix UI Dialog
 * 
 * @example
 * ```tsx
 * const modal = useModal({
 *   closeOnOutsideClick: true,
 *   closeOnEscape: true
 * });
 * 
 * return (
 *   <>
 *     <button onClick={modal.open}>Open Modal</button>
 *     <Dialog.Root {...modal.dialogProps}>
 *       <Dialog.Portal>
 *         <Dialog.Overlay className="fixed inset-0 bg-black/50" />
 *         <Dialog.Content {...modal.contentProps} className="...">
 *           <Dialog.Title>Modal Title</Dialog.Title>
 *           <Dialog.Description id={modal.descriptionId}>
 *             Modal description
 *           </Dialog.Description>
 *           <button onClick={modal.close}>Close</button>
 *         </Dialog.Content>
 *       </Dialog.Portal>
 *     </Dialog.Root>
 *   </>
 * );
 * ```
 */
export function useModal(options: UseModalOptions = {}): UseModalReturn {
  const {
    defaultOpen = false,
    open: controlledOpen,
    onOpenChange,
    modalId: providedModalId,
    closeOnOutsideClick = true,
    closeOnEscape = true,
  } = options;

  // Generate unique IDs for accessibility
  const generatedModalId = useId();
  const modalId = providedModalId || `modal-${generatedModalId}`;
  const descriptionId = `${modalId}-description`;

  // Internal state (only used if not controlled)
  const [internalOpen, setInternalOpen] = useState(defaultOpen);

  // Determine if modal is controlled or uncontrolled
  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : internalOpen;

  // Handle open state changes
  const handleOpenChange = useCallback((open: boolean) => {
    if (!isControlled) {
      setInternalOpen(open);
    }
    onOpenChange?.(open);
  }, [isControlled, onOpenChange]);

  // Modal control functions
  const open = useCallback(() => {
    handleOpenChange(true);
  }, [handleOpenChange]);

  const close = useCallback(() => {
    handleOpenChange(false);
  }, [handleOpenChange]);

  const toggle = useCallback(() => {
    handleOpenChange(!isOpen);
  }, [handleOpenChange, isOpen]);

  // Event handlers for Dialog.Content
  const handleEscapeKeyDown = useCallback((event: KeyboardEvent) => {
    if (!closeOnEscape) {
      event.preventDefault();
    }
  }, [closeOnEscape]);

  const handlePointerDownOutside = useCallback((event: Event) => {
    if (!closeOnOutsideClick) {
      event.preventDefault();
    }
  }, [closeOnOutsideClick]);

  return {
    isOpen,
    open,
    close,
    toggle,
    dialogProps: {
      open: isOpen,
      onOpenChange: handleOpenChange,
    },
    contentProps: {
      onEscapeKeyDown: closeOnEscape ? undefined : handleEscapeKeyDown,
      onPointerDownOutside: closeOnOutsideClick ? undefined : handlePointerDownOutside,
      'aria-describedby': descriptionId,
    },
    modalId,
    descriptionId,
  };
}

/**
 * Hook for managing multiple modals
 * 
 * @example
 * ```tsx
 * const modals = useMultipleModals(['confirm', 'edit', 'delete']);
 * 
 * return (
 *   <>
 *     <button onClick={() => modals.open('confirm')}>Confirm</button>
 *     <button onClick={() => modals.open('edit')}>Edit</button>
 *     
 *     <Dialog.Root {...modals.getDialogProps('confirm')}>
 *       // Confirm modal content
 *     </Dialog.Root>
 *     
 *     <Dialog.Root {...modals.getDialogProps('edit')}>
 *       // Edit modal content
 *     </Dialog.Root>
 *   </>
 * );
 * ```
 */
export function useMultipleModals<T extends string>(modalKeys: T[]) {
  const modals = modalKeys.reduce((acc, key) => {
    acc[key] = useModal();
    return acc;
  }, {} as Record<T, UseModalReturn>);

  const open = useCallback((key: T) => {
    modals[key]?.open();
  }, [modals]);

  const close = useCallback((key: T) => {
    modals[key]?.close();
  }, [modals]);

  const closeAll = useCallback(() => {
    modalKeys.forEach((key) => {
      modals[key]?.close();
    });
  }, [modals, modalKeys]);

  const isAnyOpen = modalKeys.some((key) => modals[key]?.isOpen);

  const getDialogProps = useCallback((key: T) => {
    return modals[key]?.dialogProps || { open: false, onOpenChange: () => {} };
  }, [modals]);

  const getContentProps = useCallback((key: T) => {
    return modals[key]?.contentProps || {};
  }, [modals]);

  return {
    modals,
    open,
    close,
    closeAll,
    isAnyOpen,
    getDialogProps,
    getContentProps,
  };
} 