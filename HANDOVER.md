# Principal Finance - Agent Handover Note

**Date:** December 27, 2025
**Session Summary:** Bug fixes for UI issues - calendar, split modal, and slow typing

---

## What Was Accomplished This Session

### ✅ Completed Fixes (Dec 27, 2025)

1. **Calendar Not Showing Transactions**
   - Root cause: Date key calculation used timezone offset which caused mismatches
   - Fix: Changed to simple YYYY-MM-DD string formatting
   - File: `frontend/src/pages/FinancialCalendar.jsx`

2. **Split Transaction Modal UI Issues**
   - Added $ prefix to amount fields for clarity
   - Right-aligned amounts for better readability
   - Fixed NaN on empty input with `|| 0` fallback
   - File: `frontend/src/components/SplitTransactionModal.jsx`

3. **Slow Typing When Adding Family Member**
   - Root cause: API call triggered on every keystroke
   - Fix: Use local state for name, save only on blur/Enter
   - File: `frontend/src/components/settings/MembersSettings.jsx`

### ✅ Previous Fixes (Dec 26, 2025)

4. **Rule Preview in Settings → Rules Page** - Added preview button
5. **Rule Preview in Create Rule Modal** - Fixed 422 schema error
6. **FAB Blocking Table Row Clicks** - Added pointer-events-none
7. **Onboarding Wizard Simplified** - Removed currency step
8. **Default Currency** - Changed to AUD
9. **Data Management Route** - Fixed to use correct component

---

## Current State

- **All changes pushed to GitHub** (main branch)
- **Frontend:** Vite dev server on port 5173
- **Backend:** uvicorn with `--reload` on port 8000
- **Database:** SQLite at `principal_v5.db`

---

## Known Issues to Fix (from user's Notes)

- Stocks don't add to net asset allocation graph
- Import stocks from CSV
- Stock cost base tracking
- Adding family member - typing slow
- AI insights - can't ask for non-standard timeframes
- Can't see any transactions in the calendar
- Splitting transactions - can't enter negatives, UI needs polish
- Insights error

---

## Next Steps / Roadmap

### Phase 9: Smart Rules Enhancement (Partially Complete)
- [x] Rule Preview
- [ ] Rule Testing - Dry-run rules against historical data
- [ ] Rule Suggestions - AI-suggested rules based on patterns

### Phase 10: Mobile App
- [ ] Capacitor Integration
- [ ] Push Notifications
- [ ] Biometric Auth
- [ ] App Store Deployment

### Phase 11: Family Sharing
- [ ] Invite Family Member
- [ ] Separate Logins
- [ ] Shared Data
- [ ] Per-Member Spending Tracking
- [ ] Role Permissions

---

## Key Files Reference

| Component | File Path |
|-----------|-----------|
| Rule Preview (Settings) | `frontend/src/components/RulesSection.jsx` |
| Rule Preview (Modal) | `frontend/src/components/CreateRuleModal.jsx` |
| Preview API Endpoint | `backend/routers/rules.py` |
| QuickAddFAB | `frontend/src/components/QuickAddFAB.jsx` |
| Onboarding Wizard | `frontend/src/components/OnboardingWizard.jsx` |
| App Routes | `frontend/src/App.jsx` |
| Feature Roadmap | `Feature Roadmap.md` |
| Feature Documentation | `feature_documentation.md` |
