import { createContext, useContext } from 'react';

/**
 * Carries workflow-level metadata that node components need (workspaceId for
 * scoping aux tabs, etc.). Provided once at the canvas root so any node component
 * inside can read it without prop drilling.
 */
const WorkflowMetaContext = createContext({ workspaceId: null });

export function WorkflowMetaProvider({ workspaceId, children }) {
    return <WorkflowMetaContext.Provider value={{ workspaceId }}>{children}</WorkflowMetaContext.Provider>;
}

export function useWorkflowMeta() {
    return useContext(WorkflowMetaContext);
}
