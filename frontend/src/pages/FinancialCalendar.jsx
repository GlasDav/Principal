import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, X, Calendar as CalendarIcon, Clock } from 'lucide-react';
import * as api from '../services/api';
import { Dialog } from '@headlessui/react';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function FinancialCalendar() {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(null); // For modal

    // Calculate dates
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const startOfMonth = new Date(year, month, 1);
    const endOfMonth = new Date(year, month + 1, 0);

    // API uses ISO strings
    const startStr = startOfMonth.toISOString().split('T')[0];
    const endStr = endOfMonth.toISOString().split('T')[0];

    // Data Fetching
    const { data: transactions = [], isLoading: loadingTxns } = useQuery({
        queryKey: ['calendar', startStr, endStr],
        queryFn: () => api.getCalendarData(startStr, endStr)
    });

    const { data: subscriptions = [], isLoading: loadingSubs } = useQuery({
        queryKey: ['subscriptions'],
        queryFn: api.getSubscriptions
    });

    // --- Derived State ---

    // 1. Project Subscriptions into "Events"
    const projectedEvents = useMemo(() => {
        const events = [];
        if (!subscriptions) return events;

        subscriptions.forEach(sub => {
            if (!sub.is_active) return;

            // Simple logic: If it's this month, show it.
            // Ideally we check if "Next Due" is in this month range.
            // Or if Frequency == Monthly, simply project it onto the day.

            // Let's rely on "Next Due" to anchor, then project.
            // But a simpler visual is: "If Monthly, show on Day X of this view".
            // If Weekly, show on Day X, X+7, etc.

            const due = new Date(sub.next_due_date);
            const freq = sub.frequency;
            const amount = sub.amount;

            // Helper to add event
            const addEvent = (date) => {
                // Only add if in current view month
                if (date.getMonth() === month && date.getFullYear() === year) {
                    // Check if this projection is in the PAST relative to "today"?
                    // Or check if a real transaction already likely happened?
                    // For simplicity: Show "Projected" if date > today.
                    // Or show "Expected" for past dates if no match found (gap analysis).
                    // Let's keep it simple: Show all as "Scheduled" markers.

                    events.push({
                        id: `proj-${sub.id}-${date.getDate()}`,
                        date: date.toISOString().split('T')[0],
                        amount: -amount, // Bills are expenses
                        description: sub.name,
                        isProjected: true,
                        bucket: { name: 'Recurring', color: '#a5b4fc' } // Light Indigo
                    });
                }
            };

            if (freq === 'Monthly') {
                // Project onto this month's day
                // Handle short months
                const day = due.getDate();
                const maxDays = endOfMonth.getDate();
                const actualDay = Math.min(day, maxDays);
                addEvent(new Date(year, month, actualDay));
            } else if (freq === 'Weekly') {
                // Find first occurrence in this month
                // align with due date day of week
                let cursor = new Date(due);
                // Backtrack or fast-forward cursor to start of this month
                while (cursor < startOfMonth) {
                    cursor.setDate(cursor.getDate() + 7);
                }
                while (cursor > startOfMonth && cursor.getDate() > 7) {
                    // if due date is way in future? handle later.
                    // assuming due date is "next due".
                    break;
                }

                // If next_due is in this month, start there.
                // If next_due is in future > this month, don't show (unless we want to backtrack? No, "Next Due" implies future).
                // Actually "Next Due" updates. So it should be accurate.
                // But what if we view NEXT month?

                // Robust way: Start from "Next Due". 
                // If Next Due is > End Of Month, show nothing.
                // If Next Due is <= End Of Month, show it and subsequent weeks until EOM.
                // If Next Due is < Start Of Month (stale?), fast forward.

                cursor = new Date(due);
                while (cursor <= endOfMonth) {
                    if (cursor >= startOfMonth) {
                        addEvent(new Date(cursor));
                    }
                    cursor.setDate(cursor.getDate() + 7);
                }
            } else if (freq === 'Yearly') {
                if (due.getMonth() === month) {
                    // If due year is this year (or we want to show recurring regardless of year? No, Yearly is specific)
                    // Show if due date is in this month of this year?
                    // Or just generic "Every September". 
                    // Let's use strict date match.
                    if (due.getFullYear() === year) {
                        addEvent(due);
                    }
                }
            }
        });
        return events;
    }, [subscriptions, year, month, endOfMonth, startOfMonth]);

    // 2. Merge Actual + Projected
    const combinedData = useMemo(() => {
        const map = {};

        // Add Actuals
        transactions.forEach(txn => {
            const dateKey = txn.date.split('T')[0];
            if (!map[dateKey]) map[dateKey] = { txns: [], total: 0, hasProjected: false };
            map[dateKey].txns.push(txn);
            if (txn.amount < 0) map[dateKey].total += Math.abs(txn.amount);
        });

        // Add Projected
        projectedEvents.forEach(p => {
            const dateKey = p.date;
            if (!map[dateKey]) map[dateKey] = { txns: [], total: 0, hasProjected: true };

            // Check if we duplicate? 
            // If a real transaction matches a projected one (same name, close amount, close date), we should hide projection?
            // That's advanced "Reconciliation".
            // For now: Just append projected. 
            // User can see "Paid" (Actual) vs "Due" (Projected).

            // Visual clutter: If I paid Netflix yesterday, I don't want to see "Netflix Due" yesterday.
            // Heuristic: If date is in past, hide projected?
            // Or only show projected if date >= today.

            const todayStr = new Date().toISOString().split('T')[0];
            if (dateKey >= todayStr) {
                map[dateKey].txns.push(p);
                map[dateKey].hasProjected = true;
                // Don't add to "Total Spent" yet? Or do we want "Projected Spend"?
                // Let's keep Total for ACTUAL spend (posted).
                // Maybe add a separate "Projected Total"?
            }
        });

        return map;
    }, [transactions, projectedEvents]);


    // Calendar Grid Logic
    const startDay = startOfMonth.getDay(); // 0-6
    const daysInMonth = endOfMonth.getDate();

    const renderCells = () => {
        const cells = [];
        // Padding
        for (let i = 0; i < startDay; i++) {
            cells.push(<div key={`pad-${i}`} className="h-24 md:h-32 bg-slate-50/50 dark:bg-slate-900/20 border border-slate-100 dark:border-slate-800" />);
        }

        // Days
        for (let d = 1; d <= daysInMonth; d++) {
            const dateObj = new Date(year, month, d);
            const dateKey = new Date(dateObj.getTime() - (dateObj.getTimezoneOffset() * 60000)).toISOString().split('T')[0];

            const data = combinedData[dateKey]; // { txns: [], total: 0, hasProjected: bool }
            const isToday = new Date().toDateString() === dateObj.toDateString();

            // Separate actual vs projected for dots
            const actuals = data?.txns.filter(t => !t.isProjected) || [];
            const projected = data?.txns.filter(t => t.isProjected) || [];

            cells.push(
                <div
                    key={d}
                    onClick={() => (actuals.length || projected.length) && setSelectedDate({ date: dateObj, txns: [...actuals, ...projected], total: data?.total || 0 })}
                    className={`
                        h-24 md:h-32 border border-slate-100 dark:border-slate-800 p-2 relative group transition-all
                        ${isToday ? 'bg-indigo-50/50 dark:bg-indigo-900/10' : 'bg-white dark:bg-slate-900'}
                        ${(actuals.length || projected.length) ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800' : ''}
                    `}
                >
                    <span className={`
                        text-sm font-medium block w-6 h-6 text-center rounded-full mb-1
                        ${isToday ? 'bg-indigo-600 text-white' : 'text-slate-500 dark:text-slate-400'}
                    `}>{d}</span>

                    {data && (
                        <div className="space-y-1">
                            {/* Total (Actual) */}
                            {data.total > 0 && (
                                <div className="text-xs font-bold text-slate-800 dark:text-white">
                                    ${data.total.toFixed(0)}
                                </div>
                            )}

                            {/* Dots */}
                            <div className="flex flex-wrap gap-1 content-start">
                                {/* Actuals: Solid */}
                                {actuals.slice(0, 5).map(t => (
                                    <div
                                        key={t.id}
                                        className="w-1.5 h-1.5 rounded-full bg-slate-400 dark:bg-slate-500"
                                        style={{ backgroundColor: t.bucket?.color }}
                                        title={t.description}
                                    />
                                ))}

                                {/* Projected: Ring/Hollow or lighter? */}
                                {projected.slice(0, 5 - Math.min(5, actuals.length)).map(t => (
                                    <div
                                        key={t.id}
                                        className="w-1.5 h-1.5 rounded-full border border-indigo-400 bg-white dark:bg-slate-800"
                                        title={`Due: ${t.description}`}
                                    />
                                ))}
                            </div>

                            {/* Projected Text Label if space? (Maybe just '3 Due') */}
                            {projected.length > 0 && (
                                <div className="text-[10px] text-indigo-500 font-medium flex items-center gap-0.5">
                                    <Clock size={10} />
                                    {projected.length} Due
                                </div>
                            )}
                        </div>
                    )}
                </div>
            );
        }
        return cells;
    };

    const changeMonth = (delta) => {
        setCurrentDate(new Date(year, month + delta, 1));
    };

    return (
        <div className="max-w-7xl mx-auto p-4 md:p-8">
            <header className="flex items-center justify-between mb-8">
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                    <CalendarIcon className="text-indigo-600" />
                    Financial Calendar
                </h1>
                <div className="flex items-center gap-4 bg-white dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
                    <button onClick={() => changeMonth(-1)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md transition">
                        <ChevronLeft size={20} className="text-slate-600 dark:text-slate-300" />
                    </button>
                    <span className="font-bold text-slate-800 dark:text-white min-w-[140px] text-center">
                        {currentDate.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })}
                    </span>
                    <button onClick={() => changeMonth(1)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md transition">
                        <ChevronRight size={20} className="text-slate-600 dark:text-slate-300" />
                    </button>
                </div>
            </header>

            {/* Grid Header */}
            <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-700">
                {DAYS.map(d => (
                    <div key={d} className="py-2 text-center text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                        {d}
                    </div>
                ))}
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 bg-white dark:bg-slate-900 shadow-sm rounded-b-xl overflow-hidden border-l border-b border-r border-slate-200 dark:border-slate-700">
                {loadingTxns || loadingSubs ? (
                    <div className="col-span-7 h-96 flex items-center justify-center text-slate-500">Loading Calendar...</div>
                ) : renderCells()}
            </div>

            {/* Day Detail Modal */}
            <Dialog
                open={!!selectedDate}
                onClose={() => setSelectedDate(null)}
                className="relative z-50"
            >
                <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" aria-hidden="true" />
                <div className="fixed inset-0 flex items-center justify-center p-4">
                    <Dialog.Panel className="w-full max-w-lg bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 max-h-[80vh] flex flex-col">
                        <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
                            <Dialog.Title className="text-xl font-bold text-slate-900 dark:text-white">
                                {selectedDate?.date.toLocaleDateString('en-AU', { weekday: 'long', month: 'long', day: 'numeric' })}
                            </Dialog.Title>
                            <button onClick={() => setSelectedDate(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                                <X size={24} />
                            </button>
                        </div>

                        <div className="p-0 overflow-y-auto">
                            {selectedDate?.txns.map(t => (
                                <div key={t.id} className={`flex justify-between items-center p-4 border-b border-slate-50 dark:border-slate-700 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-700/50 ${t.isProjected ? 'bg-indigo-50/30' : ''}`}>
                                    <div className="flex items-center gap-3">
                                        {t.isProjected ? (
                                            <div className="w-2 h-2 rounded-full border border-indigo-500" />
                                        ) : (
                                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: t.bucket?.color || '#cbd5e1' }} />
                                        )}

                                        <div>
                                            <div className="font-medium text-slate-800 dark:text-white text-sm flex items-center gap-2">
                                                {t.description}
                                                {t.isProjected && <span className="text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full">Due</span>}
                                            </div>
                                            <div className="text-xs text-slate-500">{t.bucket?.name || 'Uncategorized'}</div>
                                        </div>
                                    </div>
                                    <span className={`text-sm font-bold ${t.amount < 0 ? 'text-slate-900 dark:text-white' : 'text-green-600'} ${t.isProjected ? 'opacity-70' : ''}`}>
                                        {t.amount < 0 ? `$${Math.abs(t.amount).toFixed(2)}` : `+$${t.amount.toFixed(2)}`}
                                    </span>
                                </div>
                            ))}
                        </div>

                        <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-b-2xl border-t border-slate-100 dark:border-slate-700 flex justify-between font-bold">
                            <span className="text-slate-600 dark:text-slate-400">Total Spent</span>
                            <span className="text-slate-900 dark:text-white">${selectedDate?.total.toFixed(2)}</span>
                        </div>
                    </Dialog.Panel>
                </div>
            </Dialog>
        </div>
    );
}
