import { useCallback, useMemo } from 'react';
import CWLPreviewContent from './CWLPreviewContent.jsx';
import BIDSDataPanel from './BIDSDataPanel.jsx';
import CustomWorkflowParamPanel from './CustomWorkflowParamPanel.jsx';
import ToolParamPanel from './ToolParamPanel.jsx';
import { useAuxTabsContext } from '../context/AuxTabContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useToolParamContext, useCustomWorkflowWiredInputs } from '../hooks/useNodeParamContext.js';

/**
 * Renders the active aux tab's content inside the editor area, dispatching on `tab.type`.
 *
 * For .cwl / .yml tabs, reads workflow data from the bound workspace.
 * For modal tabs (bids-modal, param-modal, tool-param-modal), reads node data
 * and routes saves through the registered handler from AuxTabContext.
 */
function AuxTabRenderer({ tab, workspace, getWorkflowData }) {
    const { closeAuxTab, invokeSaveHandler, clearInitialState, setTabDirty } = useAuxTabsContext();
    const { showInfo, showWarning } = useToast();

    const onCloseSelf = useCallback(() => closeAuxTab(tab.id), [tab.id, closeAuxTab]);

    // Wired into each editable panel. The panel emits dirty=true on its first
    // user edit (or on mount if hydrated from an initialDraft) and dirty=false
    // after a successful save. The reducer no-ops same-value dispatches.
    const handleDirtyChange = useCallback((isDirty) => setTabDirty(tab.id, isDirty), [setTabDirty, tab.id]);

    // Fallback: read data straight from the workspace if no live getter is available.
    const getDataFromWorkspace = useCallback(
        () => ({
            nodes: workspace?.nodes || [],
            edges: workspace?.edges || [],
        }),
        [workspace],
    );

    const effectiveGetData = useMemo(
        () => (typeof getWorkflowData === 'function' ? getWorkflowData : getDataFromWorkspace),
        [getWorkflowData, getDataFromWorkspace],
    );

    const node = useMemo(
        () => (tab.nodeId ? (workspace?.nodes || []).find((n) => n.id === tab.nodeId) : null),
        [workspace, tab.nodeId],
    );

    // Short user-facing label for log entries — falls back gracefully.
    const nodeLabel = node?.data?.displayLabel || node?.data?.label || tab.nodeId || 'node';

    // Per-tab-type context. Each hook returns its empty-shape default when not applicable
    // (no need to gate on tab.type at the call site — the panels only read these when relevant).
    const wiredInputs = useCustomWorkflowWiredInputs(tab.type === 'param-modal' ? node : null);
    const toolParamContext = useToolParamContext(
        tab.type === 'tool-param-modal' ? workspace : null,
        tab.type === 'tool-param-modal' ? tab.nodeId : null,
    );

    if (!tab) return null;

    if (tab.type === 'cwl' || tab.type === 'yml') {
        return (
            <div className="ide-aux-tab-content ide-aux-tab-cwl">
                <CWLPreviewContent
                    getWorkflowData={effectiveGetData}
                    pane={tab.type === 'cwl' ? 'workflow' : 'job'}
                    mode="tab"
                />
            </div>
        );
    }

    if (tab.type === 'bids-modal') {
        if (!node) {
            return (
                <div className="ide-aux-tab-empty">
                    BIDS node no longer exists in this workspace. Close this tab to dismiss.
                </div>
            );
        }
        return (
            <div className="ide-aux-tab-content ide-aux-tab-modal">
                <BIDSDataPanel
                    bidsStructure={node.data?.bidsStructure}
                    savedSelections={node.data?.bidsSelections}
                    initialDraft={tab.initialState}
                    onDirtyChange={handleDirtyChange}
                    onSave={(data) => {
                        const ok = invokeSaveHandler('bids-modal', tab.nodeId, data);
                        if (ok) {
                            clearInitialState(tab.id);
                            showInfo(`BIDS data saved for "${nodeLabel}"`);
                            // Defer so the canvas sync effect from setNodes (inside the
                            // save handler) commits before the tab tears down. Matches
                            // the same pattern used by tool-param-modal and param-modal.
                            // closeAuxTab automatically returns focus to the parent workspace.
                            queueMicrotask(() => closeAuxTab(tab.id));
                        } else {
                            console.warn('[AuxTabRenderer] No bids-modal save handler registered for', tab.nodeId);
                            showWarning(`Couldn't save BIDS data — "${nodeLabel}" is no longer on the canvas`);
                        }
                    }}
                    onCancel={onCloseSelf}
                    mode="tab"
                />
            </div>
        );
    }

    if (tab.type === 'tool-param-modal') {
        if (!node) {
            return (
                <div className="ide-aux-tab-empty">
                    Tool node no longer exists in this workspace. Close this tab to dismiss.
                </div>
            );
        }
        // Originating-workflow label for the breadcrumb header. Matches the
        // tab label shown in IDELayout.
        const workflowName = workspace?.name || 'Workspace';
        // Pass scatter/wired context into the panel along with an enriched nodeData
        // (the panel checks `nodeData?.isGatherNode` / `isScatterInherited` as hints).
        const enrichedNodeData = {
            ...(node.data || {}),
            isGatherNode: toolParamContext.isGatherNode,
            isScatterInherited: toolParamContext.isScatterInherited,
        };
        return (
            <div className="ide-aux-tab-content ide-aux-tab-modal">
                <ToolParamPanel
                    nodeData={enrichedNodeData}
                    nodeId={tab.nodeId}
                    workflowName={workflowName}
                    upstreamScatterInputs={toolParamContext.upstreamScatterInputs}
                    wiredInputs={toolParamContext.wiredInputs}
                    initialDraft={tab.initialState}
                    onDirtyChange={handleDirtyChange}
                    onSave={(payload) => {
                        const ok = invokeSaveHandler('tool-param-modal', tab.nodeId, payload);
                        if (ok) {
                            clearInitialState(tab.id);
                            showInfo(`Parameters saved for "${nodeLabel}"`);
                            // Defer so the canvas sync effect from setNodes (inside the
                            // save handler) commits before the tab tears down. closeAuxTab
                            // automatically returns focus to the parent workspace.
                            queueMicrotask(() => closeAuxTab(tab.id));
                        } else {
                            console.warn(
                                '[AuxTabRenderer] No tool-param-modal save handler registered for',
                                tab.nodeId,
                            );
                            showWarning(`Couldn't save parameters — "${nodeLabel}" is no longer on the canvas`);
                        }
                    }}
                    mode="tab"
                />
            </div>
        );
    }

    if (tab.type === 'param-modal') {
        if (!node) {
            return (
                <div className="ide-aux-tab-empty">
                    Custom workflow node no longer exists in this workspace. Close this tab to dismiss.
                </div>
            );
        }
        return (
            <div className="ide-aux-tab-content ide-aux-tab-modal">
                <CustomWorkflowParamPanel
                    workflowName={node.data?.label || ''}
                    internalNodes={node.data?.internalNodes || []}
                    internalEdges={node.data?.internalEdges || []}
                    wiredInputs={wiredInputs}
                    initialDraft={tab.initialState}
                    onDirtyChange={handleDirtyChange}
                    onSave={(updatedInternalNodes) => {
                        const ok = invokeSaveHandler('param-modal', tab.nodeId, updatedInternalNodes);
                        if (ok) {
                            clearInitialState(tab.id);
                            showInfo(`Workflow parameters saved for "${nodeLabel}"`);
                            // Same deferred close as tool-param-modal — closeAuxTab
                            // returns focus to the parent workspace automatically.
                            queueMicrotask(() => closeAuxTab(tab.id));
                        } else {
                            console.warn('[AuxTabRenderer] No param-modal save handler registered for', tab.nodeId);
                            showWarning(
                                `Couldn't save workflow parameters — "${nodeLabel}" is no longer on the canvas`,
                            );
                        }
                    }}
                    onCancel={onCloseSelf}
                    mode="tab"
                />
            </div>
        );
    }

    return null;
}

export default AuxTabRenderer;
