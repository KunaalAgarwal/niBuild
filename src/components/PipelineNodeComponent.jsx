import { createPortal } from 'react-dom';
import { Handle, Position } from 'reactflow';
import { usePinnableTooltip } from '../hooks/usePinnableTooltip.js';
import { getPipelineDefinition, filterPipelineByOptions } from '../data/pipelineDefinitions.js';
import { labelFontSize } from './nodeUtils.js';

/**
 * Renders a collapsed pipeline node (e.g. fMRIPrep, MRIQC).
 *
 * Mirrors CustomWorkflowNodeComponent visually but is backed by a pre-baked
 * pipeline definition from `src/data/pipelineDefinitions.js` rather than a
 * user-saved internal graph.
 *
 * Click "Expand" to splatter the constituent CLI nodes onto the canvas
 * (destructive — the wrapper is consumed and replaced by the constituent
 * graph, mirroring `kind: 'workflow'` saved custom workflows).
 */
const PipelineNodeComponent = ({ data }) => {
    const infoTip = usePinnableTooltip();

    const definition = getPipelineDefinition(data.pipelineId);
    const options = data.pipelineOptions || {};

    // Filter by current options so the badge counts reflect what would expand.
    const { nodes: activeNodes } = definition ? filterPipelineByOptions(definition, options) : { nodes: [] };
    const cliCount = activeNodes.length;
    const gapCount = activeNodes.filter((n) => n._gap).length;

    // Distinct stages (for the tooltip)
    const stages = Array.from(new Set(activeNodes.map((n) => n.stage).filter(Boolean)));

    const handleExpand = (e) => {
        e.stopPropagation();
        data.onExpand?.();
    };

    const handleOptions = (e) => {
        e.stopPropagation();
        data.onOpenOptions?.();
    };

    return (
        <>
            <div className="node-wrapper node-pipeline" onDoubleClick={handleExpand}>
                <div className="node-top-row">
                    <span className="node-pipeline-badge">
                        <span className="node-pipeline-badge-text">
                            {cliCount} steps{gapCount > 0 ? ` · ${gapCount} gaps` : ''}
                        </span>
                    </span>
                    <span className="node-params-btn" onClick={handleOptions}>
                        Options
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
                        <span className="node-params-btn node-pipeline-expand-btn" onClick={handleExpand}>
                            Expand
                        </span>
                    </span>
                    <span ref={infoTip.iconRef} className="node-info-btn" onClick={infoTip.onClick}>
                        Info
                    </span>
                </div>
            </div>

            {infoTip.show &&
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
                        <div className="tooltip-section tooltip-fullname">
                            <span className="tooltip-text">
                                {definition?.name || data.label}
                                {definition?.version ? ` (${definition.version})` : ''}
                            </span>
                        </div>
                        {definition?.description && (
                            <div className="tooltip-section">
                                <span className="tooltip-text">{definition.description}</span>
                            </div>
                        )}
                        <div className="tooltip-section">
                            <span className="tooltip-label">CLI steps:</span>
                            <span className="tooltip-text">{cliCount}</span>
                        </div>
                        {gapCount > 0 && (
                            <div className="tooltip-section">
                                <span className="tooltip-label" style={{ color: 'var(--color-warning)' }}>
                                    Missing CWL ({gapCount}):
                                </span>
                                <span className="tooltip-text">
                                    Some constituent CLI tools have no CWL wrapper in niBuild yet.
                                </span>
                            </div>
                        )}
                        {stages.length > 0 && (
                            <div className="tooltip-section">
                                <span className="tooltip-label">Stages ({stages.length}):</span>
                                <span className="tooltip-text">{stages.join(' · ')}</span>
                            </div>
                        )}
                        {definition?.docUrl && (
                            <div className="tooltip-section">
                                <a
                                    href={definition.docUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="tooltip-link"
                                >
                                    Documentation
                                </a>
                            </div>
                        )}
                    </div>,
                    document.body,
                )}
        </>
    );
};

export default PipelineNodeComponent;
