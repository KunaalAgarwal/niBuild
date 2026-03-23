import { useContext, useEffect } from 'react';
import { useUpdateNodeInternals } from 'reactflow';
import { ScatterPropagationContext } from '../context/ScatterPropagationContext.jsx';
import { WiredInputsContext } from '../context/WiredInputsContext.jsx';
import IONodeComponent from './IONodeComponent.jsx';
import BIDSNodeComponent from './BIDSNodeComponent.jsx';
import CustomWorkflowNodeComponent from './CustomWorkflowNodeComponent.jsx';
import ToolNodeComponent from './ToolNodeComponent.jsx';
import '../styles/workflowItem.css';

/**
 * Thin dispatcher that reads shared context and delegates to the appropriate
 * node sub-component based on node type (IO, BIDS, CustomWorkflow, or Tool).
 */
const NodeComponent = ({ data, id }) => {
    // Force ReactFlow to recompute handle bounds so edges route to left/right handles
    const updateNodeInternals = useUpdateNodeInternals();
    useEffect(() => {
        updateNodeInternals(id);
    }, []);

    // Check scatter propagation and source-node status
    const { propagatedIds, scatteredUpstreamInputs, gatherNodeIds } = useContext(ScatterPropagationContext);
    const isScatterInherited = propagatedIds.has(id);
    const isGatherNode = gatherNodeIds?.has(id) || false;
    const upstreamScatterInputs = scatteredUpstreamInputs.get(id) || new Set();

    // Get wired input state from context
    const wiredContext = useContext(WiredInputsContext);
    const wiredInputs = wiredContext?.get(id) || new Map();

    const isDummy = data.isDummy === true;

    // I/O dummy nodes (Input/Output)
    if (isDummy && !data.isBIDS) {
        return (
            <IONodeComponent
                data={data}
                id={id}
                isScatterInherited={isScatterInherited}
                isGatherNode={isGatherNode}
                propagatedIds={propagatedIds}
            />
        );
    }

    // BIDS dataset nodes
    if (isDummy && data.isBIDS) {
        return <BIDSNodeComponent data={data} isScatterInherited={isScatterInherited} isGatherNode={isGatherNode} />;
    }

    // Custom workflow (sub-workflow) nodes
    if (data.isCustomWorkflow) {
        return (
            <CustomWorkflowNodeComponent
                data={data}
                isScatterInherited={isScatterInherited}
                isGatherNode={isGatherNode}
                wiredInputs={wiredInputs}
            />
        );
    }

    // Regular tool nodes
    return (
        <ToolNodeComponent
            data={data}
            id={id}
            isScatterInherited={isScatterInherited}
            isGatherNode={isGatherNode}
            upstreamScatterInputs={upstreamScatterInputs}
            wiredInputs={wiredInputs}
        />
    );
};

export default NodeComponent;
