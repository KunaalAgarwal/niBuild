import { useState, useRef, useEffect, useCallback } from 'react';

export function usePinnableTooltip() {
    const [show, setShow] = useState(false);
    const [pos, setPos] = useState({ top: 0, left: 0 });
    const iconRef = useRef(null);
    const tooltipRef = useRef(null);

    const updatePosition = useCallback(() => {
        if (iconRef.current) {
            const rect = iconRef.current.getBoundingClientRect();
            setPos({ top: rect.top + rect.height / 2, left: rect.right + 10 });
        }
    }, []);

    const onClick = useCallback(
        (e) => {
            e.stopPropagation();
            setShow((prev) => {
                if (prev) return false;
                updatePosition();
                return true;
            });
        },
        [updatePosition],
    );

    const close = useCallback(() => setShow(false), []);

    useEffect(() => {
        if (!show) return;
        const handleClickOutside = (e) => {
            if (iconRef.current?.contains(e.target) || tooltipRef.current?.contains(e.target)) return;
            setShow(false);
        };
        document.addEventListener('mousedown', handleClickOutside, true);
        return () => document.removeEventListener('mousedown', handleClickOutside, true);
    }, [show]);

    return { show, pos, iconRef, tooltipRef, onClick, close };
}
