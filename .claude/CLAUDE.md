# fMRIbuild - Neuroimaging Workflow Generator

## Project Overview

A web-based GUI for building neuroimaging (fMRI) analysis workflows. Users visually design workflows by dragging/dropping analysis operations (FSL, AFNI, FreeSurfer, ANTs) onto a canvas, configure parameters, connect nodes, and export to Common Workflow Language (CWL) format.

**Live Demo**: https://kunaalagarwal.github.io/fMRIbuild/

## Tech Stack

- **Framework**: React 18.3.1 + Vite 5.4.9
- **Workflow Canvas**: ReactFlow 11.11.4
- **UI**: React Bootstrap 2.10.9, Bootstrap 5.3.3
- **Export**: js-yaml (YAML generation), JSZip (bundle creation), file-saver (download)
- **Deployment**: GitHub Pages via GitHub Actions

## Project Structure

```
src/
├── main.jsx                # App entry point
├── components/             # React components (8 files)
│   ├── actionsBar.jsx      # Generate workflow + workspace buttons
│   ├── footer.jsx          # Footer component
│   ├── headerBar.jsx       # Header with help modal
│   ├── NodeComponent.jsx   # Custom node with parameter editing modal
│   ├── toggleWorkflowBar.jsx  # Workspace tab navigation
│   ├── workflowCanvas.jsx  # ReactFlow canvas for node/edge editing
│   ├── workflowMenu.jsx    # Left sidebar with draggable tools
│   └── workflowMenuItem.jsx   # Individual tool item with hover info
├── data/
│   └── toolData.js         # Tool metadata by library (100+ tools)
├── hooks/
│   ├── useWorkspaces.js    # Multi-workspace state + localStorage persistence
│   ├── generateWorkflow.js # Orchestrates CWL zip generation
│   └── buildWorkflow.js    # Converts ReactFlow graph to CWL YAML
└── styles/                 # CSS files (9 files, paired with components)

public/cwl/
├── toolMap.js              # CWL tool registry (execution layer)
├── fsl/                    # FSL CWL tool definitions
│   ├── bet.cwl
│   └── fast.cwl
└── README.md               # Template for exported bundles
```

## Essential Commands

```bash
npm run dev       # Start dev server (localhost:5173)
npm run build     # Production build to dist/
npm run preview   # Preview production build
npm run deploy    # Deploy to GitHub Pages
```

## Key Files Reference

| Purpose | File |
|---------|------|
| App entry point | src/main.jsx |
| ReactFlow canvas config | src/components/workflowCanvas.jsx |
| Node parameter editing | src/components/NodeComponent.jsx |
| Workspace persistence | src/hooks/useWorkspaces.js |
| CWL workflow generation | src/hooks/buildWorkflow.js |
| CWL tool definitions | public/cwl/toolMap.js |
| Tool UI metadata | src/data/toolData.js |

## Data Flow

1. User drags tools from `workflowMenu` onto `workflowCanvas`
2. Double-click node opens parameter modal (`NodeComponent`)
3. Connect nodes via edges to define dependencies
4. "Generate Workflow" triggers:
   - `buildWorkflow.js` converts graph to CWL (includes cycle detection via Kahn's algorithm)
   - `generateWorkflow.js` fetches CWL files, creates ZIP bundle
   - Downloads `workflow_bundle.zip`

## Tool Architecture (Two Layers)

### Execution Layer: `public/cwl/toolMap.js`
CWL tool definitions with full input/output specifications:
- `id`: Unique identifier
- `cwlPath`: Path to CWL file
- `requiredInputs`/`optionalInputs`: Array of `{name, type, description, flag}`
- `primaryOutputs`: Outputs that can connect to next node's input
- `outputs`: All tool outputs with glob patterns

Type system: `File`, `string`, `int`, `double`, `boolean`, `record`

### Display Layer: `src/data/toolData.js`
UI metadata for 100+ tools organized by library:
- FSL, AFNI, FreeSurfer, ANTs libraries
- Each tool: `{name, fullName, function, typicalUse, docUrl}`
- Used for menu display, hover info, and documentation links

## Current Tools

**CWL Implemented** (2 tools with full workflow support):
- `bet` - Brain Extraction Tool (FSL)
- `fast` - FMRIB's Automated Segmentation Tool (FSL)

**UI Available** (~100 tools for future implementation):
- FSL: Preprocessing, Statistical, ICA/Denoising, Diffusion/Structural, Utilities
- AFNI: Preprocessing, Statistical, Connectivity, ROI/Parcellation, Utilities
- FreeSurfer: Surface Reconstruction, Parcellation, Functional, Morphometry
- ANTs: Registration, Segmentation, Utilities

## Environment Configuration

- `vite.config.js`: Base URL set to `/fMRIbuild/` for GitHub Pages
- CWL files fetched using `import.meta.env.BASE_URL` for path resolution

---

## Additional Documentation

When working on specific areas, check these files:

| Topic | File |
|-------|------|
| State management, hooks, component patterns | [docs/architectural_patterns.md](docs/architectural_patterns.md) |
| Complete fMRI tools catalog (FSL, AFNI, SPM, FreeSurfer, ANTs) | [fmri_tools_reference.md](../fmri_tools_reference.md) |

### Tool Reference Summary

The `fmri_tools_reference.md` contains ~150 neuroimaging tools with CWL compatibility status:
- **Ready**: ~120 tools (FSL, AFNI, ANTs, FreeSurfer CLI tools)
- **Possible**: ~25 tools (SPM/MATLAB-based, complex pipelines)
- **Not Feasible**: ~5 tools (GUI-only)

**Implementation priority**: Brain extraction -> Motion correction -> Registration -> Smoothing -> Segmentation -> Statistical analysis

---

## Quick Tips

- All state updates use functional form `setState(prev => {...})` for immutability
- Components import paired CSS files (e.g., `actionsBar.jsx` imports `actionsBar.css`)
- Error handling uses `alert()` for user-facing errors, `console.error()` for debug
- Workspace state persists to localStorage automatically
- Double-click a tool in the menu to access its documentation
