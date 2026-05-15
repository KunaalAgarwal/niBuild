# Workflow & Custom Node Deletion: Edge Cases

Analysis of how *workflows* and *custom nodes* are modeled, what runs when one is deleted, and every edge case that follows — with particular attention to scenarios where the same thing exists as both a workflow and a custom node.

This is engineering notes, not a fix proposal. File paths and line numbers refer to the state of the `redesign` branch at the time of writing.

---

## 1. The data model: one table, two kinds

Both workflows and custom nodes live in **one localStorage array**, keyed `customWorkflows`. They are distinguished by a single `kind` field on each record.

`src/hooks/useCustomWorkflows.js:4-11`
```js
// Saved entries carry a `kind` discriminator:
//   'workflow'    — a complete pipeline; dragging it onto a canvas EXPANDS into all nodes+edges.
//   'custom-node' — a reusable composite; dragging it onto a canvas inserts a SINGLE composite node.
// Entries persisted before this discriminator existed are migrated on load to 'custom-node'
// (that's how the single original Save button wrote them).
const DEFAULT_KIND = 'custom-node';
const kindOf = (entry) => entry?.kind || DEFAULT_KIND;
```

Per-kind views are derived for the sidebar (`useCustomWorkflows.js:169-170`):
```js
const workflows   = customWorkflows.filter((w) => kindOf(w) === 'workflow');
const customNodes = customWorkflows.filter((w) => kindOf(w) === 'custom-node');
```

### Record shape (both kinds)
Same fields. The only thing that differs is `kind` and how the **drag/drop** path treats the entry.

```text
{ id, name, kind, nodes, edges, boundaryNodes, notes,
  createdAt, updatedAt, lastOpenedAt, hasValidationWarnings }
```

### Drag/drop split (the only runtime distinction)
- `workflowMenu.jsx:104-109` — workflow drag: `node/savedWorkflowId` + `node/expand='true'` → drop **expands** into all internal nodes/edges (`workflowCanvas.jsx:768-856 expandSavedWorkflow`).
- `workflowMenu.jsx:114-118` — custom-node drag: `node/customWorkflowId` (no expand flag) → drop inserts a **single composite node** carrying `isCustomWorkflow: true`, `customWorkflowId`, and a snapshot of `internalNodes`/`internalEdges` (`workflowCanvas.jsx:709-738 buildNodeOverrides`).

### Save flow — and how same-name twins arise
`useCustomWorkflows.js:43-106 saveWorkflow` matches existing entries by the **tuple `(name, kind)`**, not by name alone:
```js
const sameEntry = (w) => w.name === workflowData.name && kindOf(w) === incomingKind;
```
Saving "Foo" as a workflow and then "Foo" as a custom node creates **two separate records**, each with its own UUID. They coexist in the sidebar (one in the Workflows section, one in the Custom Nodes section) and are not linked in any way. This is intentional and documented (`useCustomWorkflows.js:45-46`).

### Workspace binding
A workspace (tab) keeps a `savedWorkflowId` pointing at whichever record it is "editing" (`useWorkspaces.js:14`). The binding stores **the id**, not the kind. `main.jsx:211-219 resolveBinding` only treats the binding as live when `bound.kind === saveKind`:
```js
const resolveBinding = (saveKind) => {
    if (!savedWorkflowId) return false;
    const bound = customWorkflows.find((w) => w.id === savedWorkflowId);
    if (!bound) return false;
    return (bound.kind || 'custom-node') === saveKind;
};
```
On a cross-kind save (Save-as-Workflow while bound to a custom-node, or vice versa) the binding is ignored, a new entry is created via `saveWorkflow`, **and the workspace's binding is not updated** because the `updateSavedWorkflowId` call is gated on `!savedWorkflowId` (`main.jsx:233, 263`). The workspace stays bound to the original entry.

---

## 2. Deletion — what currently runs

Both deletion entry points (`WorkflowManagerPage.jsx:315-330` row "…" menu and `workflowMenu.jsx:342-358` sidebar X button) flow through the same handler:

`src/main.jsx:150-156`
```js
const handleDeleteWorkflow = useCallback(
    (wfId) => {
        deleteWorkflow(wfId);
        removeWorkflowNodesFromAll(wfId);
    },
    [deleteWorkflow, removeWorkflowNodesFromAll],
);
```

Two effects in order:

1. **`deleteWorkflow(wfId)`** — `useCustomWorkflows.js:112-114`: filters the id out of `customWorkflows` (debounced-persisted to localStorage).

2. **`removeWorkflowNodesFromAll(wfId)`** — `useWorkspaces.js:184-202` (`REMOVE_WORKFLOW_NODES`): walks every workspace's `nodes`, drops any with `data.isCustomWorkflow && data.customWorkflowId === wfId`, and prunes incident edges.

A third effect, the canvas's reactive sweep, acts as a secondary safety net in the *currently mounted* workspace (`workflowCanvas.jsx:201-255`): whenever `customWorkflows` changes, it rebuilds the node list, dropping any custom-workflow node whose `customWorkflowId` no longer resolves and syncing the rest to the latest saved snapshot.

The shared confirmation message is generic (`workflowMenu.jsx:441-442` and `WorkflowManagerPage.jsx:624-625`):
> Delete '⟨wfName⟩'? All canvas instances will be removed.

---

## 3. Edge cases for the requested scenarios

### Scenario A — A workflow that "gets used as a custom node"

There is **no in-place flip** of a record's `kind` in the normal UX. The user-facing path that produces "the same thing as both" is hitting *Save as Custom Node* on a workspace that was previously *Save as Workflow*'d (or vice-versa). `resolveBinding` declines to update across kinds, so a second, sibling record is created. The two records share the *name* but have **different ids** and **independent lifecycles**.

There is one programmatic path that *could* flip `kind` in place: `updateWorkflow(id, { kind })` (`useCustomWorkflows.js:108-110`) is generic enough to accept it. No caller exercises this today — it is a latent capability, not a feature.

#### Case A.1 — Delete the workflow record while the canvas of *another* workspace holds composite instances of the sibling custom-node
- The composite nodes reference the **custom-node** record by `customWorkflowId`. Their id ≠ the deleted workflow id, so `REMOVE_WORKFLOW_NODES` skips them and they survive — correct behaviour. The composite continues to render with its cached `internalNodes` snapshot.

#### Case A.2 — Delete the workflow record while a workspace is bound to it
- Storage: workflow record gone. Workspace's `savedWorkflowId` is **not** cleared.
- The tab keeps its `name` (came from the workspace itself, not the workflow), so visually nothing about the tab changes.
- `WorkflowManagerPage.jsx:446-467 openWs` lookup is keyed on `savedWorkflowId === wf.id` against currently-saved workflows; since the saved record vanished, the "Open"/"Editing" chip simply disappears. There is no notification to the user that their open workspace is now orphaned.
- Next *Save as Workflow* on that workspace: `resolveBinding('workflow')` returns false (`bound` is undefined). Falls through to `saveWorkflow`, which matches by `(name, kind)`. If a sibling workflow with the same name happened to exist (rare after the deletion of the only one), it updates that; otherwise it **creates a new record with a new id**. Either way, the workspace's `savedWorkflowId` is *not* refreshed because `if (!savedWorkflowId) updateSavedWorkflowId(id)` is false. The binding stays pointing at the dead id, while the actual persistence path goes through the name lookup. Subsequent saves continue to land on the right entry only because `saveWorkflow` re-matches by name each time.
- Net effect: silent orphaning of the workspace's binding; correctness is preserved by accident because `saveWorkflow` keys on name+kind.

#### Case A.3 — Delete the custom-node record while a workspace is bound to it
- Symmetric to A.2, with one extra consequence: any other workspace's canvas had composite instances of that custom-node, and those instances *are* swept (correctly) by `REMOVE_WORKFLOW_NODES`. The workspace that was *editing the custom-node itself* still has its full internal definition on the canvas (it isn't a composite — it's the underlying tools), so the canvas content is preserved; only the binding goes stale.

#### Case A.4 — Delete the workflow record while a workspace is bound to a custom-node that holds a *snapshot* of the workflow
- The composite node's `internalNodes`/`internalEdges` are a **structuredClone snapshot taken at drop time** (`workflowCanvas.jsx:734-737`). They are not live references. Deleting the workflow has no effect on the snapshot — the composite keeps rendering as it always did.
- The reactive sweep (`workflowCanvas.jsx:201-255`) refreshes the snapshot whenever the *custom-node* record changes, but it never reaches into the workflow record. So the snapshot is decoupled from the workflow's evolution from the moment the composite is placed: deleting, renaming, or editing the source workflow does nothing to the composite. (This is true at any time — not a deletion-specific issue, but it is the bedrock assumption that makes deletion safe at the canvas level.)

### Scenario B — Saved as both a workflow *and* a custom node (same name)

#### Case B.1 — Sidebar correctness
- `useCustomWorkflows.js:169-170` separates them by kind; the sidebar's Workflows section shows the workflow, Custom Nodes section shows the custom-node. Names look identical to the user — there is no visual cue that the two are independent records. Inviting confusion, but not a bug.

#### Case B.2 — Workflow Manager listing
- `WorkflowManagerPage.jsx` renders `sorted` over the workflow list passed in from `main.jsx`. Two same-named entries appear as two rows. The "Open"/"Editing" chip uses `workspaceByWfId.get(wf.id)`, so the chip lands on whichever entry the workspace is bound to. The *other* row of the same name shows no chip, which is correct but easy to misread as "this one isn't open" when it just isn't the bound one.

#### Case B.3 — Delete one of the two same-named entries
- The deletion runs per-id, so the other survives. Canvas instances keyed by `customWorkflowId` only match the deleted id — instances of the surviving twin are untouched. This is correct.
- The confirmation message ("Delete 'X'? All canvas instances will be removed") does **not** mention that a same-named sibling of the other kind still exists. A user who thought they had "one thing called X" may believe the other row is the same record and re-delete it.

#### Case B.4 — Sibling created mid-edit
- User opens workspace, binds it to workflow X (`savedWorkflowId = workflow-X-id`). Clicks *Save as Custom Node*: a sibling custom-node X is created. Workspace binding stays on workflow X. Now the user deletes the sibling custom-node X from the sidebar:
  - `removeWorkflowNodesFromAll(customnode-X-id)` runs — searches every canvas for nodes whose `customWorkflowId === customnode-X-id`. The workspace currently being edited *is the workflow itself*, so it contains the *constituent tools*, not a composite. No nodes are removed.
  - Other workspaces that had a composite instance of custom-node X on their canvas: those composites are removed (correct).
  - Workspace's binding to workflow X is untouched (correct — different id).

#### Case B.5 — Delete the workflow X while sibling custom-node X is in use elsewhere
- The currently-edited workspace (bound to workflow X) is orphaned exactly as in A.2.
- Canvas composites of sibling custom-node X on *other* workspaces are unaffected because they reference the custom-node id, not the workflow id. The user sees workflow X disappear from the Workflows sidebar but custom-node X still works — which is the desired isolation, but may surprise users who don't grasp the two-record model.

---

## 4. Edge cases that surfaced incidentally (still in scope of "deletion")

These are not specific to the scenario duality but matter for any deletion.

#### a. Aux tabs / parameter panels open against the deleted entity
- `CustomWorkflowParamPanel.jsx`, `CustomWorkflowParamModal.jsx`, and the new aux-tab variants hold a local copy of the composite's `internalNodes` and a callback back to a specific canvas node id. If the underlying canvas node is removed by `REMOVE_WORKFLOW_NODES`, the panel/tab keeps rendering its draft state. Saving from the panel calls back into a node id that no longer exists; the canvas's update path silently drops the change (no toast).
- The `AuxTabContext`/`useAuxTabs` system (newly added under `src/context/AuxTabContext.jsx`, `src/hooks/useAuxTabs.js`) likely needs a complementary "close orphan aux tabs" sweep when a workspace's node set shrinks. Worth a targeted read before any fix is designed.

#### b. Param panel against a deleted *workflow* (Workflow record, not custom-node)
- When the workspace is **editing the workflow itself**, there is no composite — params are edited via the regular `NodeComponent`/`ToolNodeComponent` panels keyed on canvas node id. `REMOVE_WORKFLOW_NODES` only touches custom-workflow nodes, so the workspace canvas is untouched; the workspace just becomes an orphaned-binding tab (A.2). Nothing to clean up at the panel level.

#### c. Confirmation copy doesn't reflect reality across the same-name twin case
- Generic message ("All canvas instances will be removed") is technically true but understates and overstates depending on the entry's kind:
  - Workflow record: there are *no* canvas instances (workflows don't get dropped as nodes, only expanded). The message is misleading.
  - Custom-node record: only instances of *this id* are removed; same-named workflow siblings, if any, are not.

#### d. Workspace-name uniqueness uses `workspaces[].name`, not workflow-record name
- `useWorkspaces.js:40-47 disambiguateName` enforces tab-name uniqueness *across workspaces*, independent of the workflow records. After a workflow is deleted, its workspace tab keeps its (possibly-disambiguated) name; opening the same name later from the manager will land you in an existing tab if one exists by `savedWorkflowId` (`main.jsx:437-474 handleEditWorkflow`), not by name. Mostly correct; surfaces a quirk where after Case A.2 you can have a tab named "X" that no longer corresponds to any saved workflow X, and reopening a freshly-resaved "X" by name from the manager will not focus the orphaned tab — it'll create a second tab also named "X" (disambiguated to "X (2)").

#### e. `serializeNodes` strips `isCustomWorkflow` / `customWorkflowId`
- `src/utils/workflowDiff.js:43-62` does **not** persist these fields. Composite-node instances on a workspace canvas survive in workspace state (because the *workspace* itself is serialized whole into `localStorage['workspaces']`, custom-workflow fields intact), but they do **not** survive into a saved workflow/custom-node record. A workflow saved from a canvas that contains a composite is recorded as if the composite's *facade* were a regular operational node (its label, parameters, position). There is no nested-custom-node persistence. This means deletion never has to recursively rewrite saved records — the duality only matters at the canvas-instance level. Worth knowing if you ever want to support nesting.

#### f. Drag from the sidebar after the entry was deleted (cross-tab race)
- The sidebar reactively reflects `customWorkflows`. If a second browser tab/window deletes an entry while the first tab is mid-drag, drop will not find the saved record:
  - Custom-node drop: `buildNodeOverrides` returns `null`, drop silently fails (`workflowCanvas.jsx:725-727`).
  - Workflow expand-drop: `expandSavedWorkflow` shows `'Workflow to expand was not found.'` toast (`workflowCanvas.jsx:771-774`).
- Asymmetric feedback — same root cause, different user-visible result.

---

## 5. Files and lines referenced

| Concern | File | Lines |
|---|---|---|
| `kind` discriminator, save/update/delete | `src/hooks/useCustomWorkflows.js` | 4-11, 43-114, 169-170 |
| Workspace shape, `savedWorkflowId`, REMOVE_WORKFLOW_NODES, RENAME disambiguation | `src/hooks/useWorkspaces.js` | 14, 40-47, 184-202 |
| Delete handler entry point | `src/main.jsx` | 150-156 |
| Binding resolution across kinds | `src/main.jsx` | 211-219 |
| Save-as-Workflow / Save-as-CustomNode | `src/main.jsx` | 221-279 |
| Workflow-vs-CustomNode drag | `src/components/workflowMenu.jsx` | 104-118 |
| Sidebar delete confirm | `src/components/workflowMenu.jsx` | 342-358, 430-462 |
| Manager delete confirm | `src/components/WorkflowManagerPage.jsx` | 315-330, 612-645 |
| Canvas composite-node insert | `src/components/workflowCanvas.jsx` | 709-738 |
| Canvas reactive sweep on `customWorkflows` change | `src/components/workflowCanvas.jsx` | 201-255 |
| `expandSavedWorkflow` (workflow-drop path) | `src/components/workflowCanvas.jsx` | 768-856 |
| `serializeNodes` strips custom-workflow fields | `src/utils/workflowDiff.js` | 43-62 |

---

## 6. How to reproduce each case manually

Repro steps only — no code changes, just sequences to verify what was claimed.

1. **Same-name twins (B.1)**: New workspace → add a tool → Save as Workflow named `X` → click *Save as Custom Node* on the same workspace. Open the sidebar: `X` appears under *Workflows* and under *Custom Nodes*. Confirm two separate ids in `localStorage.customWorkflows`.
2. **Orphaned workspace binding (A.2 / B.5)**: Continue from (1). With workspace bound to workflow X (`localStorage.workspaces[i].savedWorkflowId` = workflow X's id), delete workflow X from the sidebar. Tab persists with name `X`. Click *Save as Workflow* again → inspect `customWorkflows`: a new entry was created (or the deleted-and-resaved name was rematched), and `workspaces[i].savedWorkflowId` still equals the dead id.
3. **Composite instance survives sibling-workflow deletion (A.1)**: From a new workspace, drag the custom-node X onto the canvas (composite). Delete workflow X (the *sibling*, not the custom-node). The composite remains intact — confirms the id-keyed sweep.
4. **Composite instance is removed when its source custom-node is deleted**: From the same canvas in (3), now delete custom-node X. The composite vanishes and incident edges are pruned (`REMOVE_WORKFLOW_NODES`).
5. **Sidebar drag races with deletion (f)**: Open the app in two browser tabs sharing localStorage. Start dragging a custom-node in tab A; in tab B delete it; complete the drop in tab A — silent no-op. Repeat with the *workflow* drag protocol — toast `'Workflow to expand was not found.'`.
6. **Aux tab / param panel orphan (a)**: Place a composite on a canvas. Open its parameter panel/aux tab. From the sidebar, delete the source custom-node. The panel/aux tab stays open with stale state; saving from it does nothing visible.
