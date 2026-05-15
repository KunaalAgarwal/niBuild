import { createPortal } from 'react-dom';
import { Handle, Position } from 'reactflow';
import { usePinnableTooltip } from '../hooks/usePinnableTooltip.js';
import { useWorkflowMeta } from '../context/WorkflowMetaContext.jsx';
import { useSidebar } from '../context/SidebarContext.jsx';
import { labelFontSize } from './nodeUtils.js';

/**
 * Renders custom workflow (sub-workflow) nodes with distinct styling.
 */
const CustomWorkflowNodeComponent = ({ id, data, isScatterInherited, isGatherNode }) => {
    const { workspaceId } = useWorkflowMeta();
    const { setSelectedNode, setActiveTab } = useSidebar();
    const customInfoTip = usePinnableTooltip();

    const nonDummyInternalNodes = (data.internalNodes || []).filter((n) => !n.isDummy);
    const nonDummyCount = nonDummyInternalNodes.length;
    const hasAnyWhen = nonDummyInternalNodes.some((n) => n.whenExpression);
    const hasAnyFx = nonDummyInternalNodes.some((n) => n.expressions && Object.keys(n.expressions).length > 0);
    const hasAnyScatter = nonDummyInternalNodes.some((n) => (n.scatterInputs?.length || 0) > 0);
    const internalBIDSNode = (data.internalNodes || []).find((n) => n.isBIDS);
    const hasBIDSNode = !!internalBIDSNode;
    const hasBIDSData = hasBIDSNode && internalBIDSNode.bidsStructure != null;

    // Select this custom-workflow node in the sidebar and switch the strip to
    // Params. Saves are still routed back through the registered handler in
    // workflowCanvas.jsx (registerSaveHandler('param-modal', id, ...)) — same
    // plumbing the aux tab path uses.
    const handleOpenCustomTab = () => {
        if (workspaceId) setSelectedNode(workspaceId, id);
        setActiveTab('params');
    };

    const toolLabels = nonDummyInternalNodes.map((n) => n.label);
    const internalEdgeCount = (data.internalEdges || []).filter((e) => {
        const src = (data.internalNodes || []).find((n) => n.id === e.source);
        const tgt = (data.internalNodes || []).find((n) => n.id === e.target);
        return src && tgt && !src.isDummy && !tgt.isDummy;
    }).length;

    return (
        <>
            <div className="node-wrapper node-custom-workflow" onDoubleClick={handleOpenCustomTab}>
                <div className="node-top-row">
                    {hasBIDSNode ? (
                        <span className="node-bottom-left">
                            <span className="node-custom-badge">
                                <span className="node-custom-badge-text">{nonDummyCount}</span>
                            </span>
                            {(isScatterInherited || hasAnyScatter) && (
                                <span className="node-scatter-badge">{'\u21BB'}</span>
                            )}
                            {isGatherNode && <span className="node-gather-badge">G</span>}
                            {hasAnyWhen && <span className="node-when-badge">?</span>}
                            {hasAnyFx && <span className="node-fx-badge">fx</span>}
                            {data.hasValidationWarnings && <span className="node-warning-badge">!</span>}
                        </span>
                    ) : (
                        <span className="node-custom-badge">
                            <span className="node-custom-badge-text">{nonDummyCount} tools</span>
                        </span>
                    )}
                    <span className="node-params-btn" onClick={handleOpenCustomTab}>
                        Params
                    </span>
                </div>
                <div className="node-content">
                    <Handle type="target" position={Position.Left} />
                    <span className="handle-label">IN</span>
                    <span className="node-label" style={{ fontSize: labelFontSize(data.displayLabel || data.label) }}>
                        {data.displayLabel || data.label}
                    </span>
                    <span className="handle-label">OUT</span>
                    <Handle type="source" position={Position.Right} />
                </div>
                <div className="node-bottom-row">
                    <span className="node-bottom-left">
                        {hasBIDSNode ? (
                            <span
                                className="node-params-btn"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (hasBIDSData) {
                                        data.onUpdateInternalBIDS?.({ _openModal: true });
                                    } else {
                                        data.onUpdateInternalBIDS?.({ _pickDirectory: true });
                                    }
                                }}
                            >
                                Data
                            </span>
                        ) : (
                            <>
                                {(isScatterInherited || hasAnyScatter) && (
                                    <span className="node-scatter-badge">{'\u21BB'}</span>
                                )}
                                {isGatherNode && <span className="node-gather-badge">G</span>}
                                {hasAnyWhen && <span className="node-when-badge">?</span>}
                                {hasAnyFx && <span className="node-fx-badge">fx</span>}
                                {data.hasValidationWarnings && <span className="node-warning-badge">!</span>}
                            </>
                        )}
                    </span>
                    <span ref={customInfoTip.iconRef} className="node-info-btn" onClick={customInfoTip.onClick}>
                        Info
                    </span>
                </div>
            </div>

            {customInfoTip.show &&
                createPortal(
                    <div
                        ref={customInfoTip.tooltipRef}
                        className="workflow-tooltip"
                        style={{
                            top: customInfoTip.pos.top,
                            left: customInfoTip.pos.left,
                            transform: 'translateY(-50%)',
                        }}
                    >
                        <button className="tooltip-close-btn" onClick={customInfoTip.close}>
                            &times;
                        </button>
                        <div className="tooltip-section tooltip-fullname">
                            <span className="tooltip-text">{data.label}</span>
                        </div>
                        <div className="tooltip-section">
                            <span className="tooltip-label">Tools ({nonDummyCount}):</span>
                            <span className="tooltip-text">{toolLabels.join(' \u2192 ')}</span>
                        </div>
                        <div className="tooltip-section">
                            <span className="tooltip-label">Internal Edges:</span>
                            <span className="tooltip-text">{internalEdgeCount}</span>
                        </div>
                        {(hasAnyScatter || hasAnyWhen || hasAnyFx) && (
                            <div className="tooltip-section">
                                <span className="tooltip-label">Features:</span>
                                <span className="tooltip-text">
                                    {[
                                        hasAnyScatter && 'Scatter',
                                        hasAnyWhen && 'Conditional',
                                        hasAnyFx && 'Expressions',
                                    ]
                                        .filter(Boolean)
                                        .join(', ')}
                                </span>
                            </div>
                        )}
                        {data.hasValidationWarnings && (
                            <div className="tooltip-section">
                                <span className="tooltip-label" style={{ color: 'var(--color-warning)' }}>
                                    Warning:
                                </span>
                                <span className="tooltip-text">Contains invalid edges or parameter mappings</span>
                            </div>
                        )}
                    </div>,
                    document.body,
                )}
        </>
    );
};

export default CustomWorkflowNodeComponent;
