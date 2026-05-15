import { useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Handle, Position } from 'reactflow';
import { getToolConfigSync } from '../utils/toolRegistry.js';
import { annotationByName } from '../utils/toolAnnotations.js';
import { usePinnableTooltip } from '../hooks/usePinnableTooltip.js';
import { useWorkflowMeta } from '../context/WorkflowMetaContext.jsx';
import { useSidebar } from '../context/SidebarContext.jsx';
import { labelFontSize } from './nodeUtils.js';

/**
 * Renders regular tool nodes. The parameter editor (docker version, scatter,
 * conditional, expressions, etc.) renders in the left sidebar's "Params" tab
 * — see SidebarParamContent / ToolParamPanel. Click "Params" or double-click
 * the node to select it and switch the sidebar to Params; saves are still
 * routed through the registered handler in workflowCanvas.jsx
 * (registerSaveHandler('tool-param-modal', id, ...)) — same plumbing the aux
 * tab path uses, so save behaviour is unchanged.
 *
 * Note: `upstreamScatterInputs` and `wiredInputs` props are no longer consumed here
 * because the panel computes them from the workspace in AuxTabRenderer /
 * SidebarParamContent. They're kept in the signature for compatibility with
 * NodeComponent's call site.
 */
const ToolNodeComponent = ({ data, id, isScatterInherited, isGatherNode }) => {
    const { workspaceId } = useWorkflowMeta();
    const { setSelectedNode, setActiveTab } = useSidebar();
    const infoTip = usePinnableTooltip();

    const tool = getToolConfigSync(data.label);
    const dockerImage = tool?.dockerImage || null;
    const dockerVersion = data.dockerVersion || 'latest';

    const toolInfo = useMemo(() => annotationByName.get(data.label) || null, [data.label]);

    // Select this node in the sidebar and switch the strip to Params. The
    // canvas's ReactFlow.onSelectionChange will also fire on the same click
    // and write the same selection — defence-in-depth so callers via the
    // explicit Params button (which doesn't go through ReactFlow's selection
    // logic) still target the sidebar correctly.
    const handleOpenTab = () => {
        if (workspaceId) setSelectedNode(workspaceId, id);
        setActiveTab('params');
    };

    return (
        <>
            <div className="node-wrapper" onDoubleClick={handleOpenTab}>
                <div className="node-top-row">
                    {dockerImage ? (
                        <span className="node-version">{dockerVersion}</span>
                    ) : (
                        <span className="node-version-spacer"></span>
                    )}
                    <span className="node-params-btn" onClick={handleOpenTab}>
                        Params
                    </span>
                </div>

                <div onDoubleClick={handleOpenTab} className="node-content">
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
                        {isScatterInherited && <span className="node-scatter-badge">&#x21BB;</span>}
                        {isGatherNode && <span className="node-gather-badge">G</span>}
                        {data.whenExpression && <span className="node-when-badge">?</span>}
                        {data.expressions && Object.keys(data.expressions).length > 0 && (
                            <span className="node-fx-badge">fx</span>
                        )}
                    </span>
                    {toolInfo ? (
                        <span ref={infoTip.iconRef} className="node-info-btn" onClick={infoTip.onClick}>
                            Info
                        </span>
                    ) : (
                        <span className="node-info-spacer"></span>
                    )}
                </div>
            </div>

            {/* Info Tooltip (same style as workflowMenuItem) */}
            {infoTip.show &&
                toolInfo &&
                createPortal(
                    <div
                        ref={infoTip.tooltipRef}
                        className="workflow-tooltip"
                        style={{
                            top: infoTip.pos.top,
                            left: infoTip.pos.left,
                            transform: 'translateY(-50%)',
                        }}
                    >
                        <button className="tooltip-close-btn" onClick={infoTip.close}>
                            &times;
                        </button>
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
        </>
    );
};

export default ToolNodeComponent;
