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

## Phase 2: 🟠 Core Experience Improvements ✅

**Nearly complete! Only MFA remaining.**

### Security & Sessions
- [ ] **Multi-Factor Authentication** - TOTP/SMS second factor
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

### Rules Improvements
- [x] **Rule Preview** - Preview which transactions would be affected before saving a rule

---

## Phase 3: 🟡 Bank Integration & Automation

**Automate data import and reduce manual entry.**

- [ ] **Basiq Integration** - Automatic bank data import for Australian banks
- [ ] **Connected Accounts Management** - Add/delete/hide accounts in Settings
- [ ] **Recurring Transaction Detection** - Identify and flag recurring patterns

---

## Phase 4: 🔵 Advanced Settings & Household

**Multi-user features and advanced configuration.**

### Household/Members
- [ ] **Household Members** - Replace Couples Mode with flexible household member management
- [ ] **Professional Access** - Give read access to accountant/advisor
- [ ] **Member Permissions** - Role-based access (view only, edit, admin)

### Notifications
- [ ] **Budget Exceeded Alerts** - Email/in-app when budget limit hit
- [ ] **Recurring Transaction Reminders** - Upcoming bill notifications
- [ ] **Goal Milestone Celebrations** - Notify when reaching savings goals

### Categories & Organization
- [ ] **Custom Groups & Categories** - User-defined category hierarchy
- [ ] **Hide Category from Budget** - Exclude categories from budget view
- [ ] **Category Ordering** - Drag-and-drop reordering

### Advanced Rules
- [ ] **Complex Rule Conditions** - Merchant contains/not contains, amount ranges
- [ ] **Rule Actions** - Add tags, hide transaction, add to review, link to goal
- [ ] **Split Transaction Rules** - Auto-split based on patterns

---

## Phase 5: 🟣 Intelligence & Forecasting

**AI-powered insights and predictive features.**

- [ ] **Cash Flow Forecasting** - Predict future balance based on patterns
- [ ] **AI Chatbot** - Natural language queries about finances
- [ ] **Interactive Tutorial** - AI-guided onboarding and feature discovery
- [ ] **Spending Anomaly Alerts** - Proactive unusual spending notifications
- [ ] **Savings Opportunity Detection** - AI suggests where to cut spending

---

## Phase 6: 🟢 Customization & Extensions

**Power user features and third-party integrations.**

### Dashboard
- [ ] **Customizable Modular Dashboard** - Drag-and-drop widget layout
- [ ] **Custom Date Range Comparisons** - Compare spending across custom periods
- [ ] **Dashboard Themes** - Light/dark mode, color schemes

### Data & Export
- [ ] **Download Transactions** - Export all data as CSV/JSON
- [ ] **Download Account Balances** - Export net worth history
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

*Last Updated: December 2025*
