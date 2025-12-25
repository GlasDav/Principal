import React from 'react';
import { Calendar } from 'lucide-react';

/**
 * UpcomingBillsWidget - Displays upcoming bills in the next 7 days
 */
export default function UpcomingBillsWidget({ bills = [], formatCurrency }) {
    return (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
            <h2 className="text-lg font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                <Calendar size={20} className="text-amber-500" />
                Upcoming Bills
            </h2>
            {bills.length === 0 ? (
                <div className="text-center py-4">
                    <p className="text-slate-400 dark:text-slate-500 text-sm">No bills due in the next 7 days</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {bills.map((bill) => (
                        <div key={bill.id} className="flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                            <div>
                                <p className="font-medium text-slate-800 dark:text-white">{bill.name}</p>
                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                    {bill.days_until === 0 ? 'Due today' :
                                        bill.days_until === 1 ? 'Due tomorrow' :
                                            `Due in ${bill.days_until} days`}
                                </p>
                            </div>
                            <div className="text-right">
                                <p className="font-bold text-slate-900 dark:text-white">{formatCurrency(Math.abs(bill.amount))}</p>
                                <p className="text-xs text-slate-400">{bill.frequency}</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
