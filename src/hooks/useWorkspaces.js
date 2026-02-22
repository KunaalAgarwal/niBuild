import { useState } from 'react';
import { useDebouncedStorage } from './useDebouncedStorage.js';

const DEFAULT_WORKSPACES = [{ id: crypto.randomUUID(), nodes: [], edges: [], name: '', workflowName: '' }];

export function useWorkspaces() {
  // Initialize state from localStorage or use defaults if nothing is stored.
  // Each workspace is now an object with 'nodes' and 'edges'
  const [workspaces, setWorkspaces] = useState(() => {
    try {
      const savedWorkspaces = JSON.parse(localStorage.getItem('workspaces'));
      if (savedWorkspaces) {
        // Migrate existing data to include name and id fields
        return savedWorkspaces.map(ws => ({
          id: ws.id || crypto.randomUUID(),
          nodes: ws.nodes || [],
          edges: ws.edges || [],
          name: ws.name || '',
          workflowName: ws.workflowName || ''
        }));
      }
    } catch {
      // Corrupted localStorage — fall through to default
    }
    return DEFAULT_WORKSPACES;
  });

  const [currentWorkspace, setCurrentWorkspace] = useState(() => {
    const savedIndex = parseInt(localStorage.getItem('currentWorkspace'), 10);
    return !isNaN(savedIndex) ? savedIndex : 0; // Default to the first workspace
  });

  // Debounced localStorage writes (300ms delay prevents main thread blocking)
  useDebouncedStorage('workspaces', workspaces, 300);
  useDebouncedStorage('currentWorkspace', currentWorkspace, 300);

  const addNewWorkspace = () => {
    setWorkspaces((prev) => {
      const updated = [...prev, { id: crypto.randomUUID(), nodes: [], edges: [], name: '', workflowName: '' }];
      setCurrentWorkspace(updated.length - 1);
      return updated;
    });
  };

  const addNewWorkspaceWithData = (data) => {
    setWorkspaces((prev) => {
      const newWs = {
        id: crypto.randomUUID(),
        nodes: data.nodes || [],
        edges: data.edges || [],
        name: data.name || '',
        workflowName: data.workflowName || ''
      };
      const updated = [...prev, newWs];
      setCurrentWorkspace(updated.length - 1);
      return updated;
    });
  };

  const clearCurrentWorkspace = () => {
    setWorkspaces((prevWorkspaces) => {
      const updatedWorkspaces = [...prevWorkspaces];
      // Preserve only the id; clear everything else including names
      const ws = updatedWorkspaces[currentWorkspace];
      updatedWorkspaces[currentWorkspace] = { id: ws?.id || crypto.randomUUID(), nodes: [], edges: [], name: '', workflowName: '' };
      return updatedWorkspaces;
    });
  };

  const updateCurrentWorkspaceItems = (newItems) => {
    // newItems is expected to be an object with shape: { nodes, edges }
    setWorkspaces((prevWorkspaces) => {
      const updatedWorkspaces = [...prevWorkspaces];
      // Preserve the id and name when updating nodes/edges
      const ws = updatedWorkspaces[currentWorkspace];
      updatedWorkspaces[currentWorkspace] = {
        ...newItems,
        id: ws?.id || crypto.randomUUID(),
        name: ws?.name || '',
        workflowName: ws?.workflowName || ''
      };
      return updatedWorkspaces;
    });
  };

  const removeCurrentWorkspace = () => {
    if (workspaces.length === 1) return;
    setWorkspaces((prevWorkspaces) =>
      prevWorkspaces.filter((_, index) => index !== currentWorkspace)
    );
    setCurrentWorkspace((prev) => (prev >= workspaces.length - 1 ? workspaces.length - 2 : prev));
  };

  const updateWorkspaceName = (newName) => {
    setWorkspaces((prevWorkspaces) => {
      const updatedWorkspaces = [...prevWorkspaces];
      updatedWorkspaces[currentWorkspace] = {
        ...updatedWorkspaces[currentWorkspace],
        name: newName
      };
      return updatedWorkspaces;
    });
  };

  const updateWorkflowName = (newName) => {
    setWorkspaces((prevWorkspaces) => {
      const updatedWorkspaces = [...prevWorkspaces];
      updatedWorkspaces[currentWorkspace] = {
        ...updatedWorkspaces[currentWorkspace],
        workflowName: newName
      };
      return updatedWorkspaces;
    });
  };

  const removeWorkflowNodesFromAll = (workflowId) => {
    setWorkspaces((prev) => {
      let anyChanged = false;
      const updated = prev.map(ws => {
        const removedIds = new Set();
        const filteredNodes = ws.nodes.filter(n => {
          if (n.data?.isCustomWorkflow && n.data?.customWorkflowId === workflowId) {
            removedIds.add(n.id);
            return false;
          }
          return true;
        });
        if (removedIds.size === 0) return ws;
        anyChanged = true;
        const filteredEdges = ws.edges.filter(
          e => !removedIds.has(e.source) && !removedIds.has(e.target)
        );
        return { ...ws, nodes: filteredNodes, edges: filteredEdges };
      });
      return anyChanged ? updated : prev;
    });
  };

  return {
    workspaces,
    currentWorkspace,
    setCurrentWorkspace,
    addNewWorkspace,
    addNewWorkspaceWithData,
    clearCurrentWorkspace,
    updateCurrentWorkspaceItems,
    removeCurrentWorkspace,
    updateWorkspaceName,
    updateWorkflowName,
    removeWorkflowNodesFromAll
  };
}
