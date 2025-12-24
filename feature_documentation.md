# Principal Finance - Feature Documentation

This document provides a comprehensive overview of the features currently implemented in the Principal Finance application.

## 1. Dashboard & Analytics
The dashboard serves as the central hub for financial oversight.

-   **Cash Flow Sankey Diagram**: A dynamic visual representation of money flow.
    -   **3-Layer Hierarchy**: Income → Savings & Investments / Groups → Buckets.
    -   **Combined Wealth View** *(New)*: "Investments" and "Net Savings" are grouped under "Savings & Investments" to show total collection of unspent wealth.
    -   **Empty State Handling**: Gracefully handles periods with no data.
    -   **Transfer Exclusion**: Transfers between accounts are automatically excluded from spending analytics.
-   **Dynamic Insights** *(New)*:
    -   **Anomaly Detection**: Identifies spending irregularities using statistical analysis (Mean + 2 Standard Deviations) rather than hardcoded thresholds.
    -   **Large Transactions**: Flags expenses significantly larger than the 90-day average.
    -   **Category Spikes**: Alerts when category spending exceeds historical volatility norms (3-6 month window).
-   **Summary Cards**: High-level metrics for the selected period.
    -   Total Income
    -   Total Expenses (excludes transfers)
    -   Net Savings
    -   Net Worth (Real-time snapshot)
-   **Spending Trends**: Bar chart visualizing spending over time, with filters for specific budget categories.
-   **Global Filtering**: Date range (e.g., "This Month") and Spender (Combined, You, Partner) filters affect all dashboard data.

## 2. Reports & Reports Tab *(New)*
Dedicated reporting section for deeper financial analysis.
-   **Expense Distribution**: Donut chart showing breakdown of spending by Group or Category (excludes Income/Transfers).
-   **Spending History**: Line chart tracking spending trends over time, filterable by Spender (User A/B/Combined).
-   **Cash Flow Projection** *(New)*:
    -   Forecasts future account balance based on current cash and recurring active subscriptions.
    -   Helps warn of potential shortfalls.
-   **Net Worth Projection** *(New)*:
    -   Projects future net worth growth based on historical trends (linear regression).
    -   Visualizes "Projected" path as a dashed line extending 12 months forward.
-   **Data Export**: Download all transaction data as CSV for external analysis.

## 3. Core Banking
### Transactions
-   **Comprehensive List**: View all transactions with dates, descriptions, categories, and amounts.
-   **Split Transactions**: Ability to split a single transaction into multiple categories (accessible via hover/select).
-   **Filtering & Sorting**: Sort by date, amount, or filter by specific criteria.

### Data Import (Ingest)
-   **Connect Bank**: Integrated button to link financial institutions (via Basiq/ConnectBank component - *In Progress*).
-   **File Import**: Support for manual file uploads.
    -   **PDF Statements**: Extract transactions from bank PDFs.
    -   **CSV Import**: Map and import CSV data from other sources.
-   **Review Before Save**:
    -   Transactions are categorized and shown for review but NOT saved to database.
    -   Users can edit categories, descriptions, and spender before confirming.
    -   Only "Confirm & Save" button persists transactions to database.
    -   Prevents accidental imports of incomplete or miscategorized data.
-   **AI-Powered Categorization**:
    -   Uses Google Gemini 3 Flash to intelligently categorize transactions.
    -   Works as a fallback when rule-based matching fails.
    -   Only suggests from user-defined bucket categories.
    -   Visual badges distinguish categorization sources:
        -   ✓ **Matched** (green): Rule/keyword match, high confidence
        -   ✨ **AI** (purple): AI predicted category, needs review
        -   ⚠ **Review** (yellow): No match found, user should categorize
-   **Duplicate Detection**:
    -   Hash-based fingerprinting detects previously imported transactions.
    -   Automatically skips duplicates when re-importing overlapping statements.
    -   "Skip duplicate transactions" checkbox (enabled by default).
-   **Import Progress Indicator**:
    -   Async background processing for large imports.
    -   Real-time progress bar showing batch completion.
    -   Shows duplicate count and categorization status.
    -   Cancel button to abort in-progress imports.

### Transfer Handling
-   **Transfer Buckets**: A default "Transfers" bucket is automatically created for all users.
-   **Analytics Exclusion**: Transfer buckets are automatically excluded from:
    -   Dashboard spending totals
    -   Spending history charts
    -   Sankey diagram flows
-   **Common Keywords**: AI and rule-based categorization recognize transfer patterns ("internal transfer", "credit card payment", "payment to", etc.)
-   **Protected Category**: Transfer bucket cannot be deleted (system-protected).
-   **Visual Distinction**: Orange background in Settings table.

### Investment Tracking
-   **Investment Buckets**: A default "Investments" bucket is automatically created for all users.
-   **Separate Sankey Flow**: Investment transactions flow from Income → Savings & Investments → Investments.
-   **Expense Exclusion**: Investment transactions are excluded from expense totals (they increase net worth, not reduce it).
-   **Protected Category**: Investment bucket cannot be deleted (system-protected).
-   **Visual Distinction**: Green background in Settings table.

## 4. Wealth Management
### Net Worth
-   **Dual Views**: Toggle between "Net Worth" (Assets - Liabilities) and "Investments" (Performance history) charts.
-   **Real Estate Support** *(New)*:
    -   Dedicated support for "Property", "Mortgage", and "Real Estate" accounts.
    -   Visual distinction with Home icons 🏠 vs Wallet/Graph icons.
-   **Automated Market Values**: Stock and ETF holdings are automatically updated via Yahoo Finance every time the page is loaded.
-   **Accounts List**:
    -   **Assets**: Savings, Investments, Cash, Property.
    -   **Liabilities**: Credit Cards, Loans, Mortgages.
-   **Manual Accounts**: Ability to manually add and update account balances (via Check-In).

### Tools & Calculators
-   **Combined Hub**: Centralized "Tools" page for financial planning utilities.
-   **Debt Payoff Visualizer**:
    -   **Projections**: Visualizes debt payoff timelines based on current payments.
    -   **Simulations**: Estimates interest and time saved by increasing monthly repayments.
-   **Tax Planner**:
    -   **Estimations**: Calculates estimated tax obligations based on income settings.
    -   **Deductions**: Configurable tax deductions for accurate net income projections.
-   **Investment Search**: Ticker lookup functionality to add holdings (now integrated into Net Worth page).
-   **Optimized Navigation**: Tools are accessible via a tabbed interface to reduce sidebar clutter.

## 5. Planning & Budgeting
### Financial Calendar
-   **Monthly View**: specialized calendar view for financial planning.
-   **Projected Bills**: Automatically maps recurring subscriptions and bills to specific days.
-   **Cash Flow Forecasting**: Helps visualize upcoming heavy spending days.

### Subscriptions
-   **Active Management**: List of known recurring subscriptions.
-   **Discovery**: Automatically detects potential subscriptions from transaction history.
-   **Editing**: Modify subscription details (Name, Amount, Frequency, Next Due Date).

### Goals
-   **Goal Creation**: Set specific financial targets with deadlines.
-   **Tracking Modes**:
    -   **Manual**: Track progress by assigning transactions.
    -   **Linked Account**: Automatically tracks the balance of a specific asset account (e.g., "Holiday Savings Account").
-   **Progress Visualization**: Progress bars indicating completion percentage and remaining amount.

## 6. System & Settings
### Budget Configuration
-   **Compact Table Layout**:
    -   Categories displayed in grouped tables instead of large cards.
    -   Three sections: Income, Non-Discretionary, Discretionary.
    -   Inline editing for all fields (click to edit).
-   **Categories & Groups**: Manage high-level groups (Income, Discretionary, Non-Discretionary).
-   **Buckets**: Create and edit specific spending buckets (e.g., Groceries, Rent) within groups.
-   **Couple Mode Features**:
    -   Separate limit columns for each partner.
    -   Shared toggle to combine limits for joint expenses.
-   **Rollover Toggle**: Enable/disable budget rollover per category.
-   **Transfer Flag**: Mark buckets as "transfer" to exclude from spending analytics.
-   **Investment Flag**: Mark buckets as "investment" to track separately in Sankey without counting as expenses.

### Smart Rules (Auto-Learning)
-   **Automatic Rule Creation**: When you manually categorize a transaction, a Smart Rule is auto-created.
-   **Keyword Matching**: Rules match transaction descriptions to categories.
-   **Priority-Based**: Higher priority rules take precedence.
-   **Amount Conditions**: Rules can filter by min/max amount thresholds.
-   **Create from Transaction**: Quickly create a rule by clicking the 📘 icon on any transaction row.
-   **Rule Preview API**: Backend endpoint to preview which transactions would match a rule before saving.
-   **Categorization Order**:
    1. Smart Rules (user-created, highest priority)
    2. Global Keywords (common merchant patterns)
    3. AI Prediction (Google Gemini fallback)

### Partner Review Queue
-   **Assign for Review**: In Couple Mode, assign transactions to your partner for review.
    -   Click the 👤✓ icon on any transaction row (Transactions or Import page).
    -   Select partner from dropdown.
    -   Assigned transactions show a persistent red icon.
-   **Review Page**: Dedicated `/review` page showing transactions pending partner review.
    -   Organized by partner (Partner A's queue, Partner B's queue).
    -   **Category Editing**: Reviewers can change the category before approving.
    -   **Approve Button**: Marks transaction as verified and removes from queue.
-   **Import Integration**: Assign transactions during CSV/PDF import preview before confirming.

### Applications Settings
-   **Couple Mode**: Toggle to enable features for shared finances (Partner A / Partner B distinction).
-   **User Profile**: Manage user details and preferences.
-   **Tax Settings**: Configure tax residency and deductions for accurate net income calculations.
-   **Legal**: Standard financial disclaimers added to footer.

## 7. Authentication & Security
-   **User Accounts**: Secure Login and Registration flows using Argon2 password hashing.
-   **Password Reset**:
    -   Forgot password flow with secure token-based reset.
    -   Email verification flow for new accounts.
-   **Self-Service Credential Updates** *(New)*:
    -   **Change Password**: Users can update their password (requires current password verification).
    -   **Change Email**: Users can update their email address (resets email verification status).
-   **Multi-Factor Authentication (MFA)** *(New)*:
    -   **TOTP Support**: Time-based One-Time Passwords compatible with Google Authenticator, Authy, etc.
    -   **QR Code Setup**: Scan QR code to add account to authenticator app.
    -   **Backup Codes**: 8 one-time backup codes generated on setup for account recovery.
    -   **MFA Validation**: Required at login when enabled; supports both TOTP and backup codes.
    -   **Disable with Verification**: MFA can only be disabled with password verification.
-   **Account Deletion**: Users can permanently delete their account from Settings.
-   **Session Management**:
    -   **Short-lived Access Tokens**: Access tokens expire after 60 minutes for enhanced security.
    -   **Refresh Tokens**: Long-lived refresh tokens (7 days) allow seamless sessions while maintaining high rotate frequency for access keys.
    -   **Automatic Token Rotation**: The frontend automatically detects expired sessions and refreshes them in the background.
    -   **Log Out Everywhere** *(New)*: Token version system allows users to invalidate all active sessions across all devices with a single action.
-   **Input Sanitization** *(New)*:
    -   XSS protection on all user input fields via Pydantic validators.
    -   HTML entity escaping for transaction descriptions, bucket names, and rule keywords.
    -   Security utilities module (`backend/security.py`) with sanitization helpers.
-   **Environment Configuration**: Sensitive data like `SECRET_KEY` and API credentials are managed via `.env` files and never hardcoded.

## 8. AI & Machine Learning
-   **Gemini 3 Flash Integration**: Transaction categorization powered by Google's latest Gemini model.
-   **AI Financial Assistant** *(New)*:
    -   Natural language queries about spending, budgets, and finances.
    -   Context-aware responses using transaction history and account data.
    -   Floating chat widget available on all authenticated pages.
    -   Suggested follow-up questions based on user's financial situation.
-   **Savings Opportunity Detection** *(New)*:
    -   Analyzes spending patterns to suggest savings opportunities.
    -   Detects over-budget categories, unused subscriptions, and spending spikes.
    -   Calculates potential yearly savings for each opportunity.
-   **Interactive Feature Tour** *(New)*:
    -   Page-specific contextual tips for feature discovery.
    -   AI-generated personalized recommendations.
    -   Progress tracking for completed tours.
-   **Async Background Processing**: Large imports processed in background with real-time progress updates.
-   **Parallel Batch Processing**: 5 concurrent API calls for faster categorization (~2 min for 500 transactions).
-   **Compact JSON Optimization**: Prompt engineered for minimal token usage, preventing response truncation.
-   **Automatic Retry Logic**: Failed JSON parses automatically retry once, improving success rate to ~80-90%.
-   **Confidence Scoring**: AI predictions capped at 0.85 confidence to encourage user review.
-   **Fallback Strategy**: AI only activated when rule-based methods fail, preserving deterministic behavior.

## 9. Testing & DevOps *(New)*
-   **Automated Test Suite**: Comprehensive pytest framework with 80+ tests.
    -   Authentication tests (registration, login, password reset, account deletion)
    -   Transaction tests (CRUD, filtering, batch operations, splitting)
    -   Analytics tests (dashboard, Sankey, projections, category history)
    -   Settings tests (buckets, rules, user settings)
    -   Security tests (XSS protection, input sanitization)
-   **CI/CD Pipeline**: GitHub Actions workflow for automated testing.
    -   Runs pytest with coverage on every push/PR
    -   Python linting with ruff
    -   Frontend linting with ESLint
-   **Test Fixtures**: Reusable fixtures for in-memory database, authentication, and sample data.
-   **Rate Limiting Bypass**: Tests run with rate limiting disabled for comprehensive coverage.

## 10. UX Components *(New)*
-   **Skeleton Loading States** *(New)*:
    -   Reusable skeleton components for consistent loading UX.
    -   Variants: `SkeletonCard`, `SkeletonTable`, `SkeletonChart`, `SkeletonTransactionList`.
    -   Full page skeleton for initial load states.
-   **Network Status Handling** *(New)*:
    -   Automatic offline/online detection.
    -   Banner notifications when connection is lost/restored.
    -   `useNetworkStatus()` hook for component-level handling.
-   **In-App Feedback** *(New)*:
    -   Feedback modal for bug reports, feature requests, and general feedback.
    -   Categorized submission types with visual distinction.
    -   Floating feedback button for easy access.
-   **Category History** *(New)*:
    -   API endpoint showing last 6 months of spending per category.
    -   Statistics (average, min, max) for budget planning.
    -   Helps users set realistic budget limits based on history.
-   **Group Spending** *(New)*:
    -   API endpoint for spending aggregated by budget group.
    -   Supports "budget by group" view (Discretionary, Non-Discretionary, etc.).

---

*Last Updated: December 2025*

