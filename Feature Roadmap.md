# Principal Finance - Feature Roadmap

## Phase 1: 🔴 Critical - Security & Production Readiness ✅

**All Phase 1 items completed!**

- [x] **Password Reset Flow** - Users can reset forgotten passwords via email
- [x] **Email Verification** - Verify email ownership during registration
- [x] **Account Deletion / Data Export** - GDPR/Privacy compliance
- [x] **Production Database Backups** - Automated PostgreSQL backup strategy (documented)
- [x] **Error Logging & Monitoring** - Sentry/LogRocket integration (documented)
- [x] **Automated Test Suite** - pytest configuration, CI pipeline (68 tests)
- [x] **Input Sanitization Audit** - XSS/injection protection (security.py)
- [x] **HTTPS Enforcement** - SSL verification, redirects (documented)

---

## Phase 2: ✅ Core Experience Improvements

**COMPLETE! All items implemented.**

### Security & Sessions
- [x] **Multi-Factor Authentication** - TOTP/SMS second factor (pyotp, QR codes, backup codes)
- [x] **Session Management** - Token revocation ("Log out everywhere")
- [x] **Change Email/Password** - Self-service credential updates

### UX Polish
- [x] **Loading States & Skeleton Screens** - Consistent loading UX (Skeleton.jsx)
- [x] **Offline Handling** - Network status, graceful degradation (NetworkStatus.jsx)
- [x] **Mobile Responsiveness Audit** - All pages tested (responsive.css, MOBILE_RESPONSIVENESS.md)
- [x] **Onboarding Flow** - Setup wizard for new users (OnboardingWizard.jsx)
- [x] **Feedback/Bug Report Mechanism** - In-app reporting (FeedbackModal.jsx)

### Budget Enhancements
- [x] **Budget by Group Option** - Group spending endpoint (/analytics/group-spending)
- [x] **Category History Preview** - Show history when editing budget (/analytics/category-history/{id})
- [x] **Hierarchical Categories** - Parent/Child structure with expandable tree view and styling

### Rules Improvements
- [x] **Rule Preview** - Preview which transactions would be affected before saving a rule

---

## Phase 3: ✅ Bank Integration & Automation (Completed)

**Automate data import and reduce manual entry.**

- [x] **Basiq.io Integration**
    - [x] Backend service for token handling & job polling
    - [x] "Connect Bank" UI flow
    - [x] Data ingestion (Accounts & Transactions)
- [x] **Link Accounts UI**
    - [x] View connected institutions
    - [x] Manual sync trigger (backend logic ready)
- [x] **Recurring Transaction Detection** - Identify and flag recurring patterns

---

## Phase 4: 🔵 Advanced Settings & Household ✅

**Substantially complete! Multi-user features and advanced configuration.**

### Household/Members
- [x] **Household Members** - Replace Couples Mode with flexible household member management
- [ ] **Professional Access** - Give read access to accountant/advisor *(deferred to Phase 6)*
- [ ] **Member Permissions** - Role-based access *(deferred to Phase 6)*

### Notifications
- [x] **Notification Infrastructure** - Bell UI, dropdown, context, API endpoints, database table
- [x] **Budget Exceeded Alerts** - In-app alerts at 80%/100%/120% thresholds
- [x] **Recurring Transaction Reminders** - Upcoming bills widget and notifications
- [x] **Goal Milestone Celebrations** - Alerts at 25%/50%/75%/100% milestones
- [x] **Notification Settings** - User preferences for enabling/disabling each alert type

### Categories & Organization
- [x] **Custom Groups & Categories** - User-defined category hierarchy
- [x] **Hide Category from Budget** - Exclude categories from budget view
- [x] **Category Ordering** - Reorder categories with up/down buttons

### Advanced Rules
- [x] **Complex Rule Conditions** - Amount ranges (min/max filters)
- [x] **Rule Actions** - Add tags, mark for review
- [x] **Split Transaction Rules** - Manual splitting works; auto-split deferred to Phase 6
- [x] **Sub-Category Rules** - Rules can now target any nested category

### Net Worth Enhancements *(New)*
- [x] **Inline Account Editing** - Click account cards to edit name and balance directly
- [x] **Liability Management** - Liability accounts now clickable and editable
- [x] **Automatic Snapshots** - Balance updates auto-create snapshots if none exist
- [x] **Account Balance Display** - Cards show current balance on the list
- [x] **Investment Holdings Integration** - Investment accounts display computed holdings value in charts and cards

---

## Phase 5: 🟣 Intelligence & Forecasting ✅

**AI-powered insights and predictive features.**

- [x] **Cash Flow Forecasting** - Predict future balance based on 90-day income/expense patterns
- [x] **AI Chatbot** - Natural language queries about finances
- [x] **Interactive Tutorial** - AI-guided onboarding and feature discovery
- [x] **Spending Anomaly Alerts** - Proactive unusual spending notifications
- [x] **Savings Opportunity Detection** - AI suggests where to cut spending
- [x] **One-Off Category** - Exclude non-recurring items from forecasts and insights



---

## Phase 6: 🟢 Customization & Extensions

**Power user features and third-party integrations.**

### Dashboard
- [x] **Customizable Modular Dashboard** - Widget-based layout with reusable components
- [x] **Recent Transactions Widget** - Show 5 most recent transactions with categories
- [x] **Investments Summary Widget** - Total value, daily change, top movers
- [x] **Custom Date Range Comparisons** - Compare spending vs Last Month, Last Year, or Previous Period
- [x] **Dashboard Themes** - Light/dark mode toggle (already implemented in ThemeContext)
- [x] **Drag-and-Drop Widgets** - Rearrange widget order functionality

### Data & Export
- [x] **Download Transactions** - Export all data as CSV/JSON
- [x] **Download Account Balances** - Export net worth history
- [ ] **API Access** - Personal API keys for power users

### Integrations
- [ ] **Amazon Extension** - Track Amazon purchases with detailed item breakdown
- [ ] **Receipt Scanning** - OCR for paper receipts
- [ ] **Investment Platform Sync** - Connect to brokers for auto-import

---

## Phase 7: 🌟 Monetization & Scale

**Prepare for commercial launch.**

- [ ] **Tiered Subscription System** - Free/Pro/Premium tiers
- [ ] **Usage Analytics** - Privacy-respecting app analytics
- [ ] **Performance Optimization** - Query optimization, bundle size reduction
- [ ] **Accessibility (a11y)** - ARIA labels, keyboard navigation, screen reader support
- [ ] **User Documentation** - Help docs, FAQs, video tutorials
- [ ] **API Rate Limiting Tuning** - Per-endpoint limits for different tiers

---

## Phase 8: 🎨 UX Polish & Engagement

**Elevate the user experience with polish and engagement features.**

### Quick Wins
- [x] **Toast Notifications** - Replace alert() dialogs with elegant toast feedback
- [x] **Keyboard Shortcuts** - Cmd/Ctrl+K command palette, navigation shortcuts

### Core UX Enhancements
- [x] **Command Palette** - Global search/action modal (Cmd/Ctrl+K)
- [x] **Dashboard Widget Persistence** - Save layout to backend/localStorage
- [~] **Inline Transaction Editing** - (Cancelled to rely on source of truth)
- [x] **Visual Budget Progress Bars** - Color-coded spent vs limit indicators
- [x] **Drag-and-Drop Categories** - Reorder categories visually with @dnd-kit
- [x] **Budget Progress Tab** - Detailed performance view with history charts, trends, and member breakdown

### Polish & Delight
- [x] **Micro-Animations** - Framer Motion for smooth transitions
- [x] **Empty State Illustrations** - Custom SVG illustrations
- [x] **Enhanced Date Picker** - Rich calendar with presets
- [x] **Accessibility Audit** - ARIA labels, keyboard nav, screen reader support

### Engagement & Retention
- [x] **Achievement System** - Badges for financial milestones
- [x] **Comparative Insights Cards** - "You spent 20% less this month" style feedback

---

## Phase 9: 🎯 Smart Rules Enhancement

**Improve the rule creation experience with preview and testing capabilities.**

### Core Features
- [x] **Rule Preview** - Show matching transactions before creating a rule
- [x] **Rule Testing** - Dry-run rules against historical data (uses Rule Preview)
- [x] **Rule Suggestions** - AI-suggested rules based on transaction patterns

---

## Phase 9.5: 🔑 API Access

**Personal API keys for programmatic access.**

### Core Features
- [x] **API Key Model** - Hashed keys with scopes and expiry
- [x] **Key Management UI** - Create, view, revoke keys in Settings
- [x] **Rate Limiting** - Per-key request limits

---

## Phase 10: 📱 Mobile App

**Native iOS and Android apps using Capacitor wrapper.**

### Core Features
- [ ] **Capacitor Integration** - Wrap React app in native shells
- [ ] **Push Notifications** - Bill reminders, budget alerts
- [ ] **Biometric Auth** - Face ID / Fingerprint unlock
- [ ] **App Store Deployment** - iOS App Store + Google Play

---

## Phase 11: 👨‍👩‍👧‍👦 Family Sharing ✅

**Multi-user household accounts with shared budgets.**

### Core Features
- [x] **Invite Family Member** - Email invite to join household
- [x] **Separate Logins** - Each member has their own credentials
- [x] **Shared Data** - All members see same transactions, budgets, accounts
- [x] **Per-Member Spending Tracking** - Filter by who spent what
- [x] **Role Permissions** - Owner/Admin/Member access levels

---

*Last Updated: December 2025*
