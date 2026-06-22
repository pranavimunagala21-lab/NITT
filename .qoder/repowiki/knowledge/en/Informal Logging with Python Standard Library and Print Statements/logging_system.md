## Overview

This repository uses an **informal, ad-hoc logging approach** combining Python's standard `logging` module for structured backend events and bare `print()` statements for debugging. There is no centralized logging configuration, no structured log format (JSON), no log rotation, and no dedicated logging middleware or sinks.

---

## Backend: Python `logging` Module + `print()`

### Framework Used
- **Python standard library `logging`** — initialized once in `Backend/main.py`
- **No third-party logging framework** (e.g., no Loguru, structlog, or Sentry integration)

### Initialization Pattern
```python
import logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
```

This is a single, module-level logger instance created at the top of `main.py`. No other backend files (`auth.py`, `db.py`, `auth_routes.py`, `project_routes.py`) define their own loggers.

### Log Levels Used
| Level | Usage |
|-------|-------|
| `logger.info()` | Signup requests, admin seeding, template selection |
| `logger.warning()` | Invalid template fallbacks, missing template files |
| `logger.error()` | Admin seeding failures, generic template missing |
| `logger.exception()` | Signup failures, LLM fallback errors (includes stack trace) |

### Key Logged Events
- **Admin user creation/sync** on startup (`seed_admin`)
- **Signup flow**: request received, failure with full traceback
- **Template resolution**: selected template, file path, fallback decisions
- **LLM content generation**: exception when falling back to deterministic content

### Heavy Use of `print()` for Debugging
The codebase relies extensively on `print()` statements as informal debug output, particularly in:
- **OTP email sending** (`send_otp` function): prints SMTP connection steps, credentials status, OTP values
- **Signup route**: prints "Signup route hit", generated OTP, MongoDB storage confirmation
- **Database diagnostics**: prints MongoDB database and collection names on startup

These `print()` calls are **not structured**, have **no timestamps**, and mix operational diagnostics with sensitive data (e.g., OTP values, credential presence flags).

---

## Frontend: Minimal `console.error` Only

The React frontend has **virtually no logging**:
- Two `console.error()` calls in `App.js` for localStorage sync failures
- One commented-out reference in `index.js` to `reportWebVitals(console.log)`

No `console.log`, `console.warn`, or structured telemetry exists in the frontend.

---

## Architecture Gaps

1. **No centralized logger**: Only `main.py` initializes a logger; all other modules lack their own logger instances.
2. **No structured logging**: Logs are plain text strings with `%`-style formatting. No JSON output, no correlation IDs, no request tracing.
3. **No log sinks or routing**: All output goes to stdout/stderr via `basicConfig`. No file handlers, no external aggregation (e.g., ELK, CloudWatch).
4. **No log level strategy per environment**: `INFO` is hardcoded. No distinction between development, staging, production.
5. **Sensitive data exposure**: `print()` statements expose OTP codes and credential metadata directly to stdout.
6. **Empty route files**: `auth_routes.py` and `project_routes.py` exist but are empty — any future logging in those modules would need new logger instances.

---

## Developer Conventions to Follow

Given the current state, developers should:

1. **Use the existing `logger` pattern** in `main.py` for new backend endpoints:
   ```python
   logger.info("Event description: %s", variable)
   logger.exception("Failure context: %s", variable)  # includes stack trace
   ```

2. **Avoid `print()` for operational logging**. Replace existing `print()` calls with `logger.debug()` or `logger.info()` as appropriate.

3. **Do not log sensitive data** (passwords, OTPs, tokens). The current `print(otp)` pattern is a security risk.

4. **Add module-level loggers** if logic moves out of `main.py`:
   ```python
   logger = logging.getLogger(__name__)
   ```

5. **Frontend logging**: Use `console.error()` only for exceptional conditions. Avoid `console.log()` in production code.

6. **Consider adding structured logging** (e.g., `python-json-logger` or `structlog`) if log aggregation or observability becomes a requirement.
