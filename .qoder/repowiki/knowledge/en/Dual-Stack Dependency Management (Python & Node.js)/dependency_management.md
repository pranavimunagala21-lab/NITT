The repository employs a dual-stack dependency management strategy, separating the Python-based FastAPI backend and the React-based frontend into distinct modules with their own package managers.

### Backend (Python)
- **Package Manager**: `pip` is used for dependency resolution and installation.
- **Manifest File**: `Backend/requirements.txt` lists direct dependencies without pinned versions (e.g., `fastapi`, `uvicorn`, `pymongo`). This implies that the environment relies on the latest compatible versions at install time, which may lead to non-deterministic builds unless a lockfile (like `requirements.lock` or `Pipfile.lock`) is generated externally or managed via a virtual environment snapshot.
- **Key Dependencies**:
  - **Web Framework**: `fastapi`, `uvicorn`
  - **Database**: `pymongo` (MongoDB driver)
  - **Auth**: `passlib`, `python-jose` (JWT handling)
  - **Utilities**: `python-dotenv` (environment variable management), `requests` (HTTP client for LLM API calls)

### Frontend (Node.js/React)
- **Package Manager**: `npm` is used, evidenced by `package.json` and `package-lock.json`.
- **Lockfile Strategy**: The presence of `package-lock.json` (lockfileVersion 3) ensures deterministic installs for the frontend, locking transitive dependencies to specific versions. This is critical for reproducible builds in the React ecosystem.
- **Build Tooling**: The project uses `react-scripts` (Create React App), which bundles dependencies like `webpack`, `babel`, and `eslint` internally. Direct dependencies are kept minimal:
  - **Core**: `react`, `react-dom`, `react-router-dom`
  - **Data Fetching**: `axios`
  - **Visualization**: `recharts`
  - **Testing**: `@testing-library/react`, `jest` (via react-scripts)

### Conventions & Rules
1. **Separation of Concerns**: Backend and frontend dependencies are strictly isolated in their respective directories (`Backend/` and `frontend/`). No shared monorepo tooling (like Lerna or Nx) is evident.
2. **Version Pinning**: 
   - **Frontend**: Strictly pinned via `package-lock.json`. Developers should commit this file to ensure consistency across environments.
   - **Backend**: Loose versioning in `requirements.txt`. It is recommended to pin versions (e.g., `fastapi==0.100.0`) or generate a freeze file (`pip freeze > requirements.txt`) after testing to prevent unexpected breakages from upstream updates.
3. **Environment Variables**: Both stacks rely on `.env` files (backend explicitly uses `python-dotenv`) for configuration, keeping secrets and environment-specific settings out of the dependency manifests.