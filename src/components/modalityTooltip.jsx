import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import '../styles/workflowMenuItem.css';

const TOOLTIP_DELAY_MS = 250;

function ModalityTooltip({ children, name, description }) {
    const [isHovered, setIsHovered] = useState(false);
    const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0 });
    const elementRef = useRef(null);
    const tooltipTimer = useRef(null);

    const handleMouseEnter = () => {
        if (elementRef.current) {
            const rect = elementRef.current.getBoundingClientRect();
            setTooltipPos({
                top: rect.top + rect.height / 2,
                left: rect.right + 10,
            });
        }
        if (tooltipTimer.current) clearTimeout(tooltipTimer.current);
        tooltipTimer.current = setTimeout(() => setIsHovered(true), TOOLTIP_DELAY_MS);
    };

    const handleMouseLeave = () => {
        if (tooltipTimer.current) {
            clearTimeout(tooltipTimer.current);
            tooltipTimer.current = null;
        }
        setIsHovered(false);
    };

    // Cancel any pending tooltip timer if the component unmounts mid-hover
    useEffect(
        () => () => {
            if (tooltipTimer.current) clearTimeout(tooltipTimer.current);
        },
        [],
    );

    return (
        <>
            <div ref={elementRef} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
                {children}
            </div>
            {isHovered &&
                description &&
                createPortal(
                    <div
                        className="workflow-tooltip"
                        style={{
                            top: tooltipPos.top,
                            left: tooltipPos.left,
                            transform: 'translateY(-50%)',
                        }}
                    >
                        <div className="tooltip-section tooltip-fullname">
                            <span className="tooltip-text">{name}</span>
                        </div>
                        <div className="tooltip-section">
                            <span className="tooltip-label">Description</span>
                            <span className="tooltip-text">{description}</span>
                        </div>
                    </div>,
                    document.body,
                )}
        </>
    );
}

export default ModalityTooltip;
