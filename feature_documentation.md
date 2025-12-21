# Principal Finance - Feature Documentation

This document provides a comprehensive overview of the features currently implemented in the Principal Finance application.

## 1. Dashboard & Analytics
The dashboard serves as the central hub for financial oversight.

-   **Cash Flow Sankey Diagram**: A dynamic visual representation of money flow.
    -   **3-Layer Hierarchy**: Income → Groups (Discretionary/Non-Discretionary/Savings/Investments) → Buckets.
    -   **Dynamic Sizing**: Automatically adjusts height based on the number of categories to prevent overflow.
    -   **Empty State Handling**: Gracefully handles periods with no data.
    -   **Transfer Exclusion**: Transfers between accounts are automatically excluded from spending analytics.
    -   **Investment Flow** *(New)*: Investments appear as a separate flow from Income, excluded from expense totals.
-   **Summary Cards**: High-level metrics for the selected period.
    -   Total Income
    -   Total Expenses (excludes transfers)
    -   Net Savings
    -   Net Worth (Real-time snapshot)
-   **Spending Trends**: Bar chart visualizing spending over time, with filters for specific budget categories.
-   **Global Filtering**: Date range (e.g., "This Month") and Spender (Combined, You, Partner) filters affect all dashboard data.

## 2. Core Banking
### Transactions
-   **Comprehensive List**: View all transactions with dates, descriptions, categories, and amounts.
-   **Split Transactions**: Ability to split a single transaction into multiple categories (accessible via hover/select).
-   **Filtering & Sorting**: Sort by date, amount, or filter by specific criteria.

### Data Import (Ingest)
-   **Connect Bank**: Integrated button to link financial institutions (via Basiq/ConnectBank component).
-   **File Import**: Support for manual file uploads.
    -   **PDF Statements**: Extract transactions from bank PDFs.
    -   **CSV Import**: Map and import CSV data from other sources.
-   **Review Before Save** *(New)*:
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
-   **Import Progress Indicator** *(Updated)*:
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

### Investment Tracking *(New)*
-   **Investment Buckets**: A default "Investments" bucket is automatically created for all users.
-   **Separate Sankey Flow**: Investment transactions flow from Income → Investments → Investment Contributions.
-   **Expense Exclusion**: Investment transactions are excluded from expense totals (they increase net worth, not reduce it).
-   **Protected Category**: Investment bucket cannot be deleted (system-protected).
-   **Visual Distinction**: Green background in Settings table.

## 3. Wealth Management
### Net Worth
-   **Dual Views**: Toggle between "Net Worth" (Assets - Liabilities) and "Investments" (Performance history) charts.
-   **Automated Market Values**: Stock and ETF holdings are automatically updated via Yahoo Finance every time the page is loaded.
-   **Accounts List**:
    -   **Assets**: Savings, Investments, Cash.
    -   **Liabilities**: Credit Cards, Loans, Mortgages.
-   **Manual Accounts**: Ability to manually add and update account balances (via Check-In).

### Tools & Calculators *(New)*
-   **Combined Hub**: Centralized "Tools" page for financial planning utilities.
-   **Debt Payoff Visualizer**:
    -   **Projections**: Visualizes debt payoff timelines based on current payments.
    -   **Simulations**: Estimates interest and time saved by increasing monthly repayments.
-   **Tax Planner**:
    -   **Estimations**: Calculates estimated tax obligations based on income settings.
    -   **Deductions**: Configurable tax deductions for accurate net income projections.
-   **Investment Search**: Ticker lookup functionality to add holdings (now integrated into Net Worth page).
-   **Optimized Navigation**: Tools are accessible via a tabbed interface to reduce sidebar clutter.

## 4. Planning & Budgeting
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

## 5. System & Settings
### Budget Configuration
-   **Compact Table Layout** *(New)*:
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
-   **Investment Flag** *(New)*: Mark buckets as "investment" to track separately in Sankey without counting as expenses.

### Smart Rules (Auto-Learning)
-   **Automatic Rule Creation**: When you manually categorize a transaction, a Smart Rule is auto-created.
-   **Keyword Matching**: Rules match transaction descriptions to categories.
-   **Priority-Based**: Higher priority rules take precedence.
-   **Categorization Order**:
    1. Smart Rules (user-created, highest priority)
    2. Global Keywords (common merchant patterns)
    3. AI Prediction (Google Gemini fallback)

### Applications Settings
-   **Couple Mode**: Toggle to enable features for shared finances (Partner A / Partner B distinction).
-   **User Profile**: Manage user details and preferences.
-   **Tax Settings**: Configure tax residency and deductions for accurate net income calculations.

## 6. Authentication & Security
-   **User Accounts**: Secure Login and Registration flows using Argon2 password hashing.
-   **Password Reset** *(New)*:
    -   Forgot password flow with secure token-based reset.
    -   Email verification flow for new accounts.
-   **Account Deletion** *(New)*: Users can permanently delete their account from Settings.
-   **Session Management**:
    -   **Short-lived Access Tokens**: Access tokens expire after 60 minutes for enhanced security.
    -   **Refresh Tokens**: Long-lived refresh tokens (7 days) allow seamless sessions while maintaining high rotate frequency for access keys.
    -   **Automatic Token Rotation**: The frontend automatically detects expired sessions and refreshes them in the background.
-   **Environment Configuration**: Sensitive data like `SECRET_KEY` and API credentials are managed via `.env` files and never hardcoded.

## 7. AI & Machine Learning *(Updated)*
-   **Gemini 3 Flash Integration**: Transaction categorization powered by Google's latest Gemini model.
-   **Async Background Processing**: Large imports processed in background with real-time progress updates.
-   **Parallel Batch Processing**: 5 concurrent API calls for faster categorization (~2 min for 500 transactions).
-   **Compact JSON Optimization**: Prompt engineered for minimal token usage, preventing response truncation.
-   **Automatic Retry Logic**: Failed JSON parses automatically retry once, improving success rate to ~80-90%.
-   **Confidence Scoring**: AI predictions capped at 0.85 confidence to encourage user review.
-   **Fallback Strategy**: AI only activated when rule-based methods fail, preserving deterministic behavior.

---

*Last Updated: December 2025*

