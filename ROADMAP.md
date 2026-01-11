# DollarData - Feature Roadmap

This document outlines the planned features, improvements, and future direction for the DollarData application.

> **Note:** This is a living document derived from project notes and user feedback.

---

## 💸 Transactions & Integrations

- [x] **Split Transactions:** Improved UI (auto-balance, positive inputs) and fixed duplicating parent transaction logic.
- [ ] **Transaction Notes:** Add ability to annotate transactions with custom notes (pending Basiq integration).
- [ ] **Basiq Integration:** Full bank feed integration for automatic transaction import.
- [ ] **Amazon Extension:** Browser extension or integration to categorize Amazon purchases automatically.
- [x] **Bug:** Recent transactions widget on dashboard isn't showing any transactions.

## 📊 Reports & Analytics

- [ ] **Income by Type:** Detailed breakdown of income sources.
- [ ] **Filtered Reports:** Advanced filtering (tags, dates, categories, accounts) for custom reports.
- [ ] **Monthly Expense Breakdown:** Clickable monthly totals to drill down into expense specifics.
- [ ] **Professional Exports:** High-quality PDF/Excel reports suitable for sharing with accountants/banks.

## 💰 Budget & Goals

- [x] **Performance Tab:** Spreadsheet-like view showing category spend by month.
    - Each month as its own column
    - Each row as a budget category with spend for that month
    - Expandable/collapsible subcategories
    - Analytics columns (average spend, variance from budget, etc.)
    - Click on a column to show performance vs budget for that period
- [x] **New Default Categories:** Add 'Reimbursable' and 'Mobile Phone' to default category list.
- [x] **Budget Score:** Revised methodology to be more intuitive (Velocity + Weighted Adherence).
- [x] **Category Goals:** specific expenditure goals (e.g., "Under budget on clothing for 3 months").
- [x] **Goal Tracking:** Visual progress for specific saving/spending goals.

## 🏦 Net Worth & Assets

- [x] **Superannuation:** Add default Superannuation account type/support.
- [x] **Investments Tab:** Move Investments to a dedicated tab within Net Worth page (currently separate page).
- [ ] **Asset Split (Overview):** Distinguish between ETFs and stocks in Asset Allocation chart.
- [x] **Chart UI:** Fixed Asset Allocation chart UI and unified colors.
- [ ] **Asset Split (Investments):** Distinguish between stocks and ETFs in Investments tab.
- [ ] **HECS Debt:** Add HECS debt account type/calculator.
- [ ] **Trade Logic:** Rename 'Add Investment' to 'Add Trade', add trade date, and implement Buy/Sell logic.
- [ ] **Terminology:** Change 'Monthly check in' to 'Record Values'.

## ⚙️ Account & Settings

- [x] **Supabase Auth Migration:** Migrated to Supabase authentication with ES256 JWT verification and JIT user provisioning.
- [x] **Complete Name Migration (Principal → DollarData):**
  - [x] Frontend branding (index.html, App.jsx, Login.jsx, Footer, FeedbackModal)
  - [x] Legal pages (TermsOfService, PrivacyPolicy)
  - [x] Backend API (main.py title, contact, welcome message)
  - [x] AI assistant prompt (ai_assistant.py)
  - [x] Documentation (ROADMAP.md, CONTEXT_MAP.md)
  - [x] Rename local folder: `Projects/Principal` → `Projects/DollarData`
  - [x] Rename GitHub repo: Settings → General → Repository name
  - [x] Update local remote: `git remote set-url origin https://github.com/GlasDav/DollarData.git`
  - [ ] Rename VPS folder: `mv /opt/principal /opt/dollardata`
  - [x] Update deploy workflow (`.agent/workflows/deploy.md`)
- [x] **Update Logo:** Replace placeholder logo with new DollarData branding assets.
- [ ] **Configure dollardata.au Domain:**
  - [ ] Complete GoDaddy ID verification
  - [ ] Add A records pointing to VPS (43.224.182.196)
  - [ ] Install Caddy on VPS for auto-SSL
  - [ ] Update CORS_ORIGINS in .env
- [ ] **Family Invites:** Email invitation flow for new household members (create own login for same account).
- [ ] **Security (MFA):** Multi-Factor Authentication setup.
- [ ] **Email Verification:** Verify user email addresses for security.
- [ ] **Notifications:** Robust notification customization.
- [x] **Scrap API Settings:** Simplify or remove exposed API configuration where possible.

## 🎨 UI/UX Improvements

- [x] **Design Token Migration:** Migrate all components from hardcoded Tailwind colors to new design tokens.
- [x] **Dashboard Customization:** Ability to hide/unhide specific dashboard widgets.
  - [x] Create `CustomizeDashboardModal` component
  - [x] Add `visibleWidgets` state and persistence to `Dashboard.jsx`
  - [x] Add "Customize" button to Dashboard header
  - [x] Integrate visibility filter into widget rendering loop
  - [x] Verify persistence and interaction with drag-and-drop
- [x] **Quick Add Button:** Align emojis and improve visual layout.
- [ ] **Tutorial System:**
    - Skip/Exit option.
    - Pre-import guidance (Categories & Rules setup first).
    - Comprehensive guide covering all features.
    - Help/FAQ section.

## 🚀 Commercialization

- [ ] **Tiered Subscriptions:** Implement Free/Pro/Family tiers.
- [ ] **Free Trial:** Implement free trial logic.
- [ ] **Referral System:** User referral links and tracking.

## 📱 Mobile App


- [ ] **Plan iOS and Android App:** Research and plan capabilities for native apps.

## 📊 Data Enhancements

- [ ] **Link Transactions to Accounts:** Capture `account_id` during CSV/bank imports to enable account-based filtering in Reports.
- [ ] **Tag Management:** Build UI for creating and managing transaction tags.

## 🐛 Known Issues

- [x] **Goals Page:** 'Something went wrong' error on first load. Fine after refresh.
- [x] **Dashboard Sankey:** Income mismatch between sum of streams and 'Income' node.
- [x] **Spending Trends:** Category dropdown needs sorting and grouping.
- [x] **Budget History:** 6 month history should include current month.
- [x] **Budget Chart:** History chart numbers incorrect when switching months.
- [x] **Net Worth Zero Balance:** Fixed issue where historical snapshots dropped to $0. Implemented "Gap Filling" logic.
- [x] **Goal Modal:** Content spills out of modal container (fix attempted but failed).
