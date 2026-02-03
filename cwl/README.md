# CWL Workflow Bundle

This bundle contains a packed CWL (Common Workflow Language) workflow that is ready to run.

## Contents

- `<name>.cwl` - The complete workflow with all tool definitions inlined (where `<name>` is your workflow name)

## Prerequisites

You'll need a CWL runner installed. We recommend one of the following:

### Option 1: cwltool (reference implementation)

```bash
pip install cwltool
```

### Option 2: Toil (for HPC/cloud execution)

```bash
pip install toil[cwl]
```

## Running the Workflow

### Basic execution

```bash
cwltool <name>.cwl --input <your_input_file.nii.gz>
```

### With Docker (recommended)

```bash
cwltool --docker <name>.cwl --input <your_input_file.nii.gz>
```

### With Singularity (for HPC environments)

```bash
cwltool --singularity <name>.cwl --input <your_input_file.nii.gz>
```

## Viewing Workflow Inputs

To see all available inputs and their types:

```bash
cwltool --make-template <name>.cwl
```

This will generate a YAML template showing all inputs you can provide.

## Validating the Workflow

To validate the workflow without running it:

```bash
cwltool --validate <name>.cwl
```

## Troubleshooting

- **Docker not found**: Ensure Docker is installed and running, or use `--singularity` for Singularity containers
- **Permission denied**: You may need to run with `sudo` or add your user to the `docker` group
- **Out of memory**: Use `--max-memory` flag to limit memory usage

## Learn More

- [CWL User Guide](https://www.commonwl.org/user_guide/)
- [cwltool Documentation](https://github.com/common-workflow-language/cwltool)
- [CWL Specification](https://www.commonwl.org/v1.2/)