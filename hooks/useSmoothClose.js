'use client'

import { useState, useCallback } from 'react'

/**
 * Hook to provide Apple-style smooth exit animations before unmounting a modal/popup.
 * @param {Function} onClose The original onClose callback to call after the exit animation completes.
 * @param {number} duration The duration of the exit animation in ms (default 220ms).
 */
export function useSmoothClose(onClose, duration = 220) {
  const [isClosing, setIsClosing] = useState(false)

  const handleClose = useCallback(() => {
    if (isClosing) return
    setIsClosing(true)
    setTimeout(() => {
      onClose?.()
    }, duration)
  }, [isClosing, onClose, duration])

  return { isClosing, handleClose }
}

export default useSmoothClose
