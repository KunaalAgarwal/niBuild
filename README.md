# niBuild

To streamline the process of creating fMRI and other neuro-imaging analysis workflows,
we developed niBuild. Through the no-installation required web-based graphical user interface (GUI) users can design workflows
leveraging analysis operations from FSL, AFNI, ANTs, FreeSurfer, etc. After designing the workflow
users can export a self-contained [Research Object Crate](https://www.researchobject.org/ro-crate/) containing code allowing for 
execution of the workflow through a [Common Workflow Language (CWL)](https://www.commonwl.org/user_guide/introduction/index.html) workflow
or a dockerfile. This project aims to alleviate aspects of the reproducibility crisis in
image analysis by facilitating creation of shareable and reusable workflows.

### [Deployment](https://kunaalagarwal.github.io/niBuild/)

### Running Locally

Clone the repository, install the dependencies, and start the development server:

```bash
git clone https://github.com/KunaalAgarwal/niBuild.git
cd niBuild
npm install
npm run dev
```

### Contributions

When contributing, please follow these best practices:

- **Use Development Branches:**  
  Create a new local branch for each feature or bug fix. Make all changes in that branch and test thoroughly,
  see utils directory for testing harness. Creating a local branch allows for development of novel changes without
  triggering an automatic deployment.

  ```bash
  git checkout -b <branch_name>
  ```

- **Merging to Main:**  
  Once your changes have been tested and are stable in the development environment, create a pull request
  to merge them into the `main` branch. The PR will then be reviewed and upon approval by one of the repository managers the
  changes will be merged into `main` and subsequently released into production.
  **Important:** The repository is configured with GitHub Actions to automatically deploy to GitHub Pages on every push to the `main` branch.
  ```bash
  git checkout main
  git merge <branch_name> -m "Merge <branch_name>: commit message"
  git push origin main
  ```

### Deployment Workflow

Our deployment process uses GitHub Actions to automatically build and deploy the
project whenever changes are pushed to the `main` branch. This ensures that the live site on GitHub
Pages is always up-to-date with the latest stable code.

### Authorship

This project was created by Kunaal Agarwal, Adam Dawood and advised by Javier Rasero, PhD, under the funding of the University of Virginia Harrison Research Award.