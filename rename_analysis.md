# App Rename Analysis: Principal -> DollarData

This document outlines the changes required to rename the application from **"Principal"** to **"DollarData"**. The changes are categorized by impact and component.

## 1. Frontend Branding (High Visibility)
These changes directly affect what the user sees.

| File Path | Line(s) | Change Description |
|-----------|---------|--------------------|
| `frontend/index.html` | 10 | Change `<title>Principal Finance</title>` to `<title>DollarData</title>`. |
| `frontend/src/App.jsx` | 107 | `const title = ... || 'Principal';` -> `'DollarData'` |
| `frontend/src/App.jsx` | 130 | `<img alt="Principal Finance" ...>` -> `alt="DollarData"` |
| `frontend/src/App.jsx` | 131 | `<h1>Principal</h1>` -> `<h1>DollarData</h1>` |
| `frontend/src/pages/Login.jsx` | 104 | `<h1>Principal</h1>` -> `<h1>DollarData</h1>` |
| `frontend/src/components/Footer.jsx` | 7 | "Principal is a personal finance tool..." -> "DollarData is..." |
| `frontend/src/components/FeedbackModal.jsx" | 123 | "...improve Principal!" -> "...improve DollarData!" |
| `frontend/src/pages/TermsOfService.jsx` | 33, 41, 101 | Replace "Principal Finance" with "DollarData". |
| `frontend/src/pages/PrivacyPolicy.jsx` | 33 | Replace "Principal Finance" with "DollarData". |
| `frontend/BRAND GUIDELINES.md` | 1 | Title update. |

## 2. Backend & System Logic
These changes affect API responses, logs, and self-identification.

| File Path | Line(s) | Change Description |
|-----------|---------|--------------------|
| `backend/main.py` | 20 | Log message: "Starting Principal Finance API..." |
| `backend/main.py` | 75 | `FastAPI(title="Principal Finance API", ...)` |
| `backend/main.py` | 111 | `contact={"name": "Principal Finance"}` |
| `backend/main.py` | 236 | `return {"message": "Welcome to Principal API"}` |
| `backend/services/ai_assistant.py` | 165 | AI Prompt: "You are a helpful... assistant for ... Principal Finance." |
| `backend/config.py` | 2 | Docstring update. |
| `backend/security.py` | 2 | Docstring update. |
| `backend/requirements.txt` | 1 | Header update. |
| `gunicorn.conf.py` | 45 | `proc_name = "principal-api"` -> `"dollardata-api"` |

## 3. Infrastructure & DevOps (High Effort / Risk)
Renaming these ensures consistency but requires careful execution, especially for databases and live environments.

### Docker & Networking
*   **`docker-compose.yml`**:
    *   Service names (optional but recommended): `principal-postgres`, `principal-redis`.
    *   Network names: `principal-network` -> `dollardata-network`.
    *   Environment variables: `POSTGRES_USER=principal`, `POSTGRES_DB=principal` (Requires database migration/re-creation if changed).
*   **`Dockerfile`**: Comment updates.

### Domains & Security
*   **`HTTPS_ENFORCEMENT.md`**: References to `principal.yourdomain.com`.
*   **`tests/test_security.py`**: Allowed hosts list `["principal.app"]`.

### Database Files (SQLite)
*   The project uses SQLite files named `principal_v5.db`, `principal.db`.
*   **Recommendation**: You can rename the file to `dollardata_v5.db`, but you **MUST** update all script references.
*   **Impacted Scripts**:
    *   `scripts/debug_verify.py`
    *   `scripts/manage_users.py`
    *   `scripts/migrate_*.py` (Multiple files)
    *   `scripts/reset_password.py`
    *   `scripts/update_schema.py`
    *   `scripts/add_subscription_parent_id.py` (and many others in `scripts/`)
    *   `backend/main.py` (if it hardcodes the DB path, usually it uses env vars but `sqlite:///./principal_v5.db` looks common in scripts).

## 4. Documentation
Updates to ensure project documentation is accurate.

*   `ROADMAP.md`: Title and content.
*   `README.md` (if exists).
*   `CONTEXT_MAP.md`: "Principal Finance is a comprehensive..."
*   `feature_documentation.md`: Title and content.
*   `BACKUP_STRATEGY.md`, `MOBILE_RESPONSIVENESS.md`, `HTTPS_ENFORCEMENT.md`.
*   `docs/POSTGRESQL_SETUP.md`.

## 5. Tests
Test files often contain the app name in descriptions or specific assertions.

*   `tests/test_*.py`: Docstrings and "Principal Finance" strings.
*   `tests/test_auth.py`: Asserts `provisioning_uri` contains "Principal".
*   `frontend/src/test/basic.test.js`: Checks for 'Principal Finance' string.

---

## Execution Plan & Recommendations

1.  **Phase 1: Surface Level (Safe)**
    *   Update all **Frontend Branding** items.
    *   Update **Backend** titles and messages (API title, Welcome message).
    *   Update **Documentation**.
    *   *Risk: Low. No functional changes.*

2.  **Phase 2: Code Internal (Moderate)**
    *   Update AI prompts in `ai_assistant.py`.
    *   Update Test files to match new names.
    *   *Risk: Low. Ensure tests pass.*

3.  **Phase 3: Infrastructure & Data (High Risk)**
    *   **Database**: If you rename `principal_v5.db` to `dollardata.db`, you must grep and replace strings in the entire `scripts/` folder.
    *   **Docker**: changing `POSTGRES_DB` or network names requires tearing down and rebuilding containers.
    *   **Recommendation**: For now, you might want to keep the internal database filename (`principal_v5.db`) to avoid breaking all utility scripts, or treat it as a dedicated "Migration" task.

4.  **Phase 4: Directory Name**
    *   Renaming the parent folder `.../Projects/Principal` to `.../Projects/DollarData` will break your local workspace paths if not handled carefully in your IDE.
