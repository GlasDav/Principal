# Handover Note - Upcoming Recurring in Budget
*December 27, 2025*

## Summary of Changes
We implemented the "Upcoming Recurring in Budget" feature, which allows users to see not just what they have spent, but what is *committed* to be spent based on recurring subscriptions.

## Key Features Implemented
1.  **Backend Data Model**:
    -   Updated `Subscription` model to include `bucket_id`.
    -   Migration `add_bucket_to_subscriptions_migration.py` created and schema updated.

2.  **Analytics Logic**:
    -   Updated `/analytics/dashboard` endpoint.
    -   New Logic: Calculates `upcoming_recurring` sum for each bucket by summing active subscriptions due in the current view range.
    -   New Metric: `effective_remaining = limit - spent - upcoming_recurring`.

3.  **Frontend Updates**:
    -   **Subscriptions Page**: Users can now assign a "Budget Category" to any subscription.
    -   **Budget Summary Widget**: Progress bar now shows three states:
        -   **Spent**: Solid color.
        -   **Upcoming**: Hashed/patterned segment.
        -   **Remaining**: Empty space.
    -   **Budget Progress Widget**: Individual category cards show "Effective Remaining" text and the hashed progress bar segment.

## Next Steps
-   **Validation**: Verify that the "Next Due Date" logic is robust (e.g., does it accurately update after a transaction matches?). Currently, it relies on the `next_due_date` field in the subscription table.
-   **User Feedback**: See if users find the "hashed" bar intuitive or if it adds too much visual noise.
-   **Smart Mapping**: Ideally, when a subscription is auto-detected from a transaction, it should inherit that transaction's category as its `bucket_id`. This is not yet implemented.

## Files Modified
-   `backend/models.py`
-   `backend/schemas.py`
-   `backend/routers/analytics.py`
-   `frontend/src/pages/Subscriptions.jsx`
-   `frontend/src/components/widgets/BudgetSummaryWidget.jsx`
-   `frontend/src/components/widgets/BudgetProgressWidget.jsx`
-   `feature_documentation.md`
