import { createContext } from 'react';

// Context for wired input state - lets NodeComponent show which File/Directory
// inputs are wired from upstream nodes via edge mappings.
// Value: Map<nodeId, Map<inputName, { sourceNodeId, sourceNodeLabel, sourceOutput }>>
export const WiredInputsContext = createContext(new Map());
