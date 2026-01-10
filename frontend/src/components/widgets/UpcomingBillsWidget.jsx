import React from 'react';
import { Calendar } from 'lucide-react';

/**
 * UpcomingBillsWidget - Displays upcoming bills in the next 7 days
 */
export default function UpcomingBillsWidget({ bills: billsProp = [], formatCurrency }) {
    // Defensive: ensure bills is always an array to prevent .map() crashes
    const bills = Array.isArray(billsProp) ? billsProp : [];

    return (
        <div className="bg-card dark:bg-card-dark p-6 rounded-2xl shadow-sm border border-border dark:border-border-dark">
            <h2 className="text-lg font-bold text-text-primary dark:text-text-primary-dark mb-4 flex items-center gap-2">
                <Calendar size={20} className="text-amber-500" />
                Upcoming Bills
            </h2>
            {bills.length === 0 ? (
                <div className="text-center py-4">
                    <p className="text-text-muted dark:text-text-muted-dark text-sm">No bills due in the next 7 days</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {bills.map((bill) => (
                        <div key={bill.id} className="flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                            <div>
                                <p className="font-medium text-text-primary dark:text-text-primary-dark">{bill.name}</p>
                                <p className="text-sm text-text-muted dark:text-text-muted-dark">
                                    {bill.days_until === 0 ? 'Due today' :
                                        bill.days_until === 1 ? 'Due tomorrow' :
                                            `Due in ${bill.days_until} days`}
                                </p>
                            </div>
                            <div className="text-right">
                                <p className="font-bold text-text-primary dark:text-text-primary-dark">{formatCurrency(Math.abs(bill.amount))}</p>
                                <p className="text-xs text-text-muted dark:text-text-muted-dark">{bill.frequency}</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
