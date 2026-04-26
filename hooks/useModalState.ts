import { useState } from 'react';

/**
 * Hook for managing multiple modal states
 * Provides a convenient way to handle multiple modals with typing
 */
export function useModalState<T extends string = string>(modals: T[]) {
  const [modalStates, setModalStates] = useState<Record<T, boolean>>(
    () => Object.fromEntries(modals.map((m) => [m, false])) as Record<T, boolean>,
  );

  const openModal = (modal: T) => {
    setModalStates((prev) => ({ ...prev, [modal]: true }));
  };

  const closeModal = (modal: T) => {
    setModalStates((prev) => ({ ...prev, [modal]: false }));
  };

  const toggleModal = (modal: T) => {
    setModalStates((prev) => ({ ...prev, [modal]: !prev[modal] }));
  };

  const closeAll = () => {
    setModalStates((prev) => Object.fromEntries(Object.keys(prev).map((k) => [k, false])) as Record<T, boolean>);
  };

  return {
    modalStates,
    openModal,
    closeModal,
    toggleModal,
    closeAll,
  };
}

/**
 * Hook for managing a single modal state
 */
export function useSingleModal(initialState = false) {
  const [isOpen, setIsOpen] = useState(initialState);

  const open = () => setIsOpen(true);
  const close = () => setIsOpen(false);
  const toggle = () => setIsOpen((prev) => !prev);

  return {
    isOpen,
    open,
    close,
    toggle,
  };
}
