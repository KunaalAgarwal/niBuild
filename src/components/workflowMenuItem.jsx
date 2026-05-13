import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import '../styles/workflowMenuItem.css';

const TOOLTIP_DELAY_MS = 250;

function WorkflowMenuItem({ name, toolInfo, onDragStart, warningIcon }) {
    const [isHovered, setIsHovered] = useState(false);
    const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0 });
    const itemRef = useRef(null);
    const tooltipTimer = useRef(null);

    const handleMouseEnter = () => {
        if (itemRef.current) {
            const rect = itemRef.current.getBoundingClientRect();
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

    // Cancel any pending tooltip timer if the item unmounts mid-hover
    useEffect(
        () => () => {
            if (tooltipTimer.current) clearTimeout(tooltipTimer.current);
        },
        [],
    );

    const handleDoubleClick = () => {
        if (toolInfo?.docUrl) {
            window.open(toolInfo.docUrl, '_blank', 'noopener,noreferrer');
        }
    };

    return (
        <div
            ref={itemRef}
            className="workflow-menu-item"
            draggable
            onDragStart={(event) => onDragStart(event, name)}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onDoubleClick={handleDoubleClick}
        >
            <span className="tool-name">
                {warningIcon && (
                    <span className="menu-item-warning" title="Workflow has validation warnings">
                        !{' '}
                    </span>
                )}
                {name}
            </span>

            {toolInfo &&
                isHovered &&
                createPortal(
                    <div
                        className="workflow-tooltip"
                        style={{
                            top: tooltipPos.top,
                            left: tooltipPos.left,
                            transform: 'translateY(-50%)',
                        }}
                    >
                        {toolInfo.fullName && (
                            <div className="tooltip-section tooltip-fullname">
                                <span className="tooltip-text">{toolInfo.fullName}</span>
                            </div>
                        )}
                        <div className="tooltip-section">
                            <span className="tooltip-label">Function:</span>
                            <span className="tooltip-text">{toolInfo.function}</span>
                        </div>
                        {toolInfo.modality && (
                            <div className="tooltip-section">
                                <span className="tooltip-label">Expected Input:</span>
                                <span className="tooltip-text">{toolInfo.modality}</span>
                            </div>
                        )}
                        {toolInfo.keyParameters && (
                            <div className="tooltip-section">
                                <span className="tooltip-label">Key Parameters:</span>
                                <span className="tooltip-text">{toolInfo.keyParameters}</span>
                            </div>
                        )}
                        {toolInfo.keyPoints && (
                            <div className="tooltip-section">
                                <span className="tooltip-label">Key Points:</span>
                                <span className="tooltip-text">{toolInfo.keyPoints}</span>
                            </div>
                        )}
                        <div className="tooltip-section">
                            <span className="tooltip-label">Typical Use:</span>
                            <span className="tooltip-text">{toolInfo.typicalUse}</span>
                        </div>
                    </div>,
                    document.body,
                )}
        </div>
    );
}

export default WorkflowMenuItem;
