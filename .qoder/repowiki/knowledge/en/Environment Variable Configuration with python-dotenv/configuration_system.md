## Configuration System Overview

This repository uses a **minimal, environment-variable-driven configuration approach** for the backend, with no dedicated configuration management framework or structured config files.

### Backend Configuration (FastAPI)

The backend relies exclusively on `python-dotenv` to load environment variables from a `.env` file at application startup. There is no centralized configuration module — config values are read inline wherever needed using `os.getenv()`.

#### Key Configuration Variables

| Variable | Source | Purpose | Default |
|---|---|---|---|
| `GROQ_API_KEY` | `.env` | LLM API authentication for AI content generation | None (falls back to deterministic payload) |
| `SMTP_USER` | `.env` | Gmail address for OTP email delivery | Empty string |
| `SMTP_PASS` | `.env` | Gmail App Password for SMTP auth | Empty string |
| `SMTP_HOST` | Hardcoded | SMTP server host | `smtp.gmail.com` |
| `SMTP_PORT` | Hardcoded | SMTP server port | `587` |
| `SECRET_KEY` | `.env` | JWT signing key for authentication tokens | `supersecretkey` |
| `MONGODB_URI` | `.env` | MongoDB connection string | `mongodb://127.0.0.1:27017` |
| `TEST_EMAIL` | `.env` | Recipient for test email endpoint | None |

#### Configuration Loading Pattern

```python
# In db.py and main.py
from dotenv import load_dotenv
load_dotenv()

# Inline retrieval with fallbacks
SECRET_KEY = os.getenv("SECRET_KEY", "supersecretkey")
MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://127.0.0.1:27017")
```

Note that `load_dotenv()` is called redundantly in both `db.py` and `main.py` (twice in `main.py`). This is harmless but indicates a lack of centralized initialization.

### Frontend Configuration (React)

The frontend has **no build-time or runtime configuration system**. All configuration is hardcoded:

- **API base URL**: `http://127.0.0.1:8000` is defined as a constant (`API_URL`) in both `App.js` and `adminApi.js`.
- **No `.env` files**: The React app does not use `process.env` or any environment variable injection.
- **No config files**: No `config.json`, `settings.js`, or similar pattern exists.

### Architecture Observations

1. **No configuration layering**: There is no distinction between development, staging, and production configurations. The same `.env` file and hardcoded defaults apply universally.

2. **Secrets in version control**: The `.env` file contains real API keys and credentials (GROQ_API_KEY, SMTP credentials), which should never be committed. The `.gitignore` does not explicitly exclude `.env`.

3. **Hardcoded fallbacks as safety nets**: Several config values have sensible defaults (`SECRET_KEY`, `MONGODB_URI`), and the LLM integration gracefully degrades to a deterministic fallback when `GROQ_API_KEY` is absent.

4. **Frontend-backend coupling via hardcoded URL**: The frontend's `API_URL` constant must be manually updated if the backend runs on a different host or port. There is no proxy configuration or environment-based override.

5. **No feature flag system**: Runtime behavior toggles (e.g., template availability, admin features) are controlled by code logic and user roles, not configurable flags.

### Developer Guidelines

- **Adding new config**: Place new environment variables in `Backend/.env` and read them via `os.getenv("VAR_NAME", "default")` at the point of use. For database-related vars, add to `db.py`.
- **Never commit `.env`**: Add `.env` to `.gitignore` immediately. Use `.env.example` for documenting required variables.
- **Frontend API URL**: If deploying to a non-local environment, update `API_URL` in both `frontend/src/App.js` and `frontend/src/services/adminApi.js` consistently.
- **Avoid redundant `load_dotenv()` calls**: Centralize the call in one module (e.g., `db.py`) and import that module elsewhere rather than calling `load_dotenv()` multiple times.
- **Consider a config module**: For maintainability, extract all `os.getenv()` calls into a single `config.py` module that exports typed, validated configuration objects.