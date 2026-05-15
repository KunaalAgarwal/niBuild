import { useState, useCallback, useMemo } from 'react';
import { useDebouncedStorage } from './useDebouncedStorage.js';

// Saved entries carry a `kind` discriminator:
//   'workflow'    — a complete pipeline; dragging it onto a canvas EXPANDS into all nodes+edges.
//   'custom-node' — a reusable composite; dragging it onto a canvas inserts a SINGLE composite node.
// Entries persisted before this discriminator existed are migrated on load to 'custom-node'
// (that's how the single original Save button wrote them).
const DEFAULT_KIND = 'custom-node';

const kindOf = (entry) => entry?.kind || DEFAULT_KIND;

export function useCustomWorkflows() {
    const [customWorkflows, setCustomWorkflows] = useState(() => {
        try {
            const saved = JSON.parse(localStorage.getItem('customWorkflows'));
            if (!Array.isArray(saved)) return [];
            // One-time backfill: any pre-kind entry becomes a custom-node.
            return saved.map((w) => (w && !w.kind ? { ...w, kind: DEFAULT_KIND } : w));
        } catch {
            return [];
        }
    });

    useDebouncedStorage('customWorkflows', customWorkflows, 300);

    const getNextDefaultName = useCallback(
        (kind = DEFAULT_KIND) => {
            // Per-kind counter so the workflow series and custom-node series don't collide.
            const pattern = kind === 'workflow' ? /^Workflow (\d+)$/ : /^Custom Workflow (\d+)$/;
            const prefix = kind === 'workflow' ? 'Workflow' : 'Custom Workflow';
            const usedNumbers = customWorkflows
                .filter((w) => kindOf(w) === kind)
                .map((w) => w.name.match(pattern))
                .filter(Boolean)
                .map((m) => parseInt(m[1], 10));
            const next = usedNumbers.length === 0 ? 1 : Math.max(...usedNumbers) + 1;
            return `${prefix} ${next}`;
        },
        [customWorkflows],
    );

    const saveWorkflow = useCallback(
        (workflowData) => {
            // Match by (name + kind) so a workflow named "Foo" and a custom node named "Foo"
            // can coexist without one silently overwriting the other.
            const incomingKind = workflowData.kind || DEFAULT_KIND;
            const sameEntry = (w) => w.name === workflowData.name && kindOf(w) === incomingKind;

            // Snapshot for return value (best-effort at call time)
            const existingIndex = customWorkflows.findIndex(sameEntry);
            if (existingIndex >= 0) {
                const existingId = customWorkflows[existingIndex].id;
                setCustomWorkflows((prev) => {
                    // Re-find inside updater to avoid stale index from outer closure
                    const idx = prev.findIndex(sameEntry);
                    if (idx < 0)
                        return [
                            ...prev,
                            {
                                ...workflowData,
                                id: crypto.randomUUID(),
                                kind: incomingKind,
                                notes: workflowData.notes ?? '',
                                lastOpenedAt: workflowData.lastOpenedAt ?? null,
                                createdAt: Date.now(),
                                updatedAt: Date.now(),
                            },
                        ];
                    const updated = [...prev];
                    // Preserve metadata fields (notes, lastOpenedAt) that are NOT
                    // owned by the editor save flow — these belong to the manager.
                    // Kind is preserved from the existing entry; the (name+kind)
                    // match above guarantees it equals incomingKind.
                    updated[idx] = {
                        ...workflowData,
                        id: prev[idx].id,
                        kind: prev[idx].kind || incomingKind,
                        createdAt: prev[idx].createdAt,
                        updatedAt: Date.now(),
                        notes: workflowData.notes ?? prev[idx].notes ?? '',
                        lastOpenedAt: workflowData.lastOpenedAt ?? prev[idx].lastOpenedAt ?? null,
                    };
                    return updated;
                });
                return { result: 'updated', id: existingId };
            }

            // New workflow
            const newId = crypto.randomUUID();
            setCustomWorkflows((prev) => [
                ...prev,
                {
                    ...workflowData,
                    id: newId,
                    kind: incomingKind,
                    notes: workflowData.notes ?? '',
                    lastOpenedAt: workflowData.lastOpenedAt ?? null,
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                },
            ]);
            return { result: 'created', id: newId };
        },
        [customWorkflows],
    );

    const updateWorkflow = useCallback((id, updates) => {
        setCustomWorkflows((prev) => prev.map((w) => (w.id === id ? { ...w, ...updates, updatedAt: Date.now() } : w)));
    }, []);

    const deleteWorkflow = useCallback((id) => {
        setCustomWorkflows((prev) => prev.filter((w) => w.id !== id));
    }, []);

    /**
     * Clone a saved workflow with a fresh id. Generates a unique "(copy)" name
     * by appending " 2", " 3", … until no name collision remains.
     * Returns the new id, or null if the source workflow wasn't found.
     */
    const duplicateWorkflow = useCallback(
        (id) => {
            const src = customWorkflows.find((w) => w.id === id);
            if (!src) return null;

            const baseName = `${src.name} (copy)`;
            let candidate = baseName;
            let n = 2;
            while (customWorkflows.some((w) => w.name === candidate)) {
                candidate = `${baseName} ${n++}`;
            }

            const newId = crypto.randomUUID();
            const copy = {
                ...src,
                id: newId,
                name: candidate,
                createdAt: Date.now(),
                updatedAt: Date.now(),
                lastOpenedAt: null,
            };
            setCustomWorkflows((prev) => [...prev, copy]);
            return newId;
        },
        [customWorkflows],
    );

    /**
     * Update just the user-authored notes on a workflow. Does NOT bump
     * `updatedAt` — notes are metadata about the workflow, not part of its
     * executable content. With autosave-on-blur in the manager, bumping would
     * push every typed note to the top of the newest-first sort and rewrite
     * the "Updated …" subline, which is misleading.
     */
    const updateWorkflowNotes = useCallback((id, notes) => {
        setCustomWorkflows((prev) => prev.map((w) => (w.id === id ? { ...w, notes: notes || '' } : w)));
    }, []);

    /**
     * Stamp `lastOpenedAt` on a workflow. Does NOT bump `updatedAt` — opening a
     * workflow doesn't change its content, only its access metadata.
     */
    const markWorkflowOpened = useCallback((id) => {
        setCustomWorkflows((prev) => prev.map((w) => (w.id === id ? { ...w, lastOpenedAt: Date.now() } : w)));
    }, []);

    // Per-kind views, computed once so the sidebar and other call sites don't
    // re-filter on every render.
    const workflows = useMemo(() => customWorkflows.filter((w) => kindOf(w) === 'workflow'), [customWorkflows]);
    const customNodes = useMemo(() => customWorkflows.filter((w) => kindOf(w) === 'custom-node'), [customWorkflows]);

    return useMemo(
        () => ({
            customWorkflows,
            workflows,
            customNodes,
            saveWorkflow,
            updateWorkflow,
            deleteWorkflow,
            duplicateWorkflow,
            updateWorkflowNotes,
            markWorkflowOpened,
            getNextDefaultName,
        }),
        [
            customWorkflows,
            workflows,
            customNodes,
            saveWorkflow,
            updateWorkflow,
            deleteWorkflow,
            duplicateWorkflow,
            updateWorkflowNotes,
            markWorkflowOpened,
            getNextDefaultName,
        ],
    );
}
