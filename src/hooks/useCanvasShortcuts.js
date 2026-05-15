import { useEffect } from 'react';

/**
 * Canvas-scoped keyboard shortcuts.
 *
 * Bindings:
 *   Ctrl+Shift+L → auto-layout
 *   Ctrl+C       → copy current selection (skipped when focus is inside an input/textarea)
 *   Ctrl+V       → paste (skipped when focus is inside an input/textarea)
 *
 * Ctrl+S is handled globally in main.jsx so it works from the sidebar and aux
 * tabs too — don't add it here (would double-fire).
 *
 * The Delete key is handled natively by ReactFlow via onNodesDelete; it doesn't
 * route through here.
 *
 * @param {object} handlers
 * @param {() => void} handlers.onAutoLayout
 * @param {() => void} [handlers.onCopy]
 * @param {() => void} [handlers.onPaste]
 */
export function useCanvasShortcuts({ onAutoLayout, onCopy, onPaste }) {
    useEffect(() => {
        const isEditableTarget = (target) =>
            target &&
            (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

        const handleKeyDown = (e) => {
            if (e.ctrlKey && e.shiftKey && (e.key === 'L' || e.key === 'l')) {
                e.preventDefault();
                onAutoLayout?.();
            } else if (e.ctrlKey && !e.shiftKey && (e.key === 'c' || e.key === 'C')) {
                if (isEditableTarget(e.target)) return;
                e.preventDefault();
                onCopy?.();
            } else if (e.ctrlKey && !e.shiftKey && (e.key === 'v' || e.key === 'V')) {
                if (isEditableTarget(e.target)) return;
                e.preventDefault();
                onPaste?.();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onAutoLayout, onCopy, onPaste]);
}
