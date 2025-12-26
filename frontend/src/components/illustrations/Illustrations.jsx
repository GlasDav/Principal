import React from 'react';

/**
 * Collection of SVG illustrations for empty states
 */

// No Transactions
export function NoTransactionsIllustration({ className = 'w-48 h-48' }) {
    return (
        <svg viewBox="0 0 200 200" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Background Circle */}
            <circle cx="100" cy="100" r="80" className="fill-slate-100 dark:fill-slate-800" />

            {/* Receipt/Document */}
            <rect x="60" y="45" width="80" height="100" rx="8" className="fill-white dark:fill-slate-700 stroke-slate-200 dark:stroke-slate-600" strokeWidth="2" />

            {/* Lines on receipt */}
            <line x1="75" y1="70" x2="125" y2="70" className="stroke-slate-300 dark:stroke-slate-500" strokeWidth="3" strokeLinecap="round" />
            <line x1="75" y1="85" x2="115" y2="85" className="stroke-slate-200 dark:stroke-slate-600" strokeWidth="2" strokeLinecap="round" />
            <line x1="75" y1="100" x2="120" y2="100" className="stroke-slate-200 dark:stroke-slate-600" strokeWidth="2" strokeLinecap="round" />
            <line x1="75" y1="115" x2="100" y2="115" className="stroke-slate-200 dark:stroke-slate-600" strokeWidth="2" strokeLinecap="round" />

            {/* Plus sign */}
            <circle cx="145" cy="135" r="22" className="fill-indigo-500" />
            <line x1="135" y1="135" x2="155" y2="135" stroke="white" strokeWidth="3" strokeLinecap="round" />
            <line x1="145" y1="125" x2="145" y2="145" stroke="white" strokeWidth="3" strokeLinecap="round" />
        </svg>
    );
}

// No Goals
export function NoGoalsIllustration({ className = 'w-48 h-48' }) {
    return (
        <svg viewBox="0 0 200 200" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Background */}
            <circle cx="100" cy="100" r="80" className="fill-emerald-50 dark:fill-emerald-900/20" />

            {/* Target circles */}
            <circle cx="100" cy="95" r="50" className="stroke-emerald-200 dark:stroke-emerald-700" strokeWidth="4" fill="none" />
            <circle cx="100" cy="95" r="35" className="stroke-emerald-300 dark:stroke-emerald-600" strokeWidth="3" fill="none" />
            <circle cx="100" cy="95" r="20" className="stroke-emerald-400 dark:stroke-emerald-500" strokeWidth="3" fill="none" />
            <circle cx="100" cy="95" r="8" className="fill-emerald-500" />

            {/* Arrow */}
            <line x1="150" y1="50" x2="110" y2="90" className="stroke-amber-500" strokeWidth="3" strokeLinecap="round" />
            <polygon points="105,85 115,95 108,98" className="fill-amber-500" />

            {/* Star sparkles */}
            <circle cx="60" cy="60" r="3" className="fill-amber-400" />
            <circle cx="145" cy="140" r="4" className="fill-emerald-400" />
        </svg>
    );
}

// No Data/Empty Chart
export function NoDataIllustration({ className = 'w-48 h-48' }) {
    return (
        <svg viewBox="0 0 200 200" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Background */}
            <circle cx="100" cy="100" r="80" className="fill-blue-50 dark:fill-blue-900/20" />

            {/* Chart bars */}
            <rect x="50" y="100" width="20" height="40" rx="4" className="fill-slate-200 dark:fill-slate-600" />
            <rect x="80" y="80" width="20" height="60" rx="4" className="fill-slate-200 dark:fill-slate-600" />
            <rect x="110" y="110" width="20" height="30" rx="4" className="fill-slate-200 dark:fill-slate-600" />
            <rect x="140" y="90" width="20" height="50" rx="4" className="fill-slate-200 dark:fill-slate-600" />

            {/* Dotted line placeholder */}
            <line x1="50" y1="150" x2="165" y2="150" className="stroke-slate-300 dark:stroke-slate-500" strokeWidth="2" strokeDasharray="6,4" />

            {/* Question mark */}
            <circle cx="155" cy="55" r="20" className="fill-blue-500" />
            <text x="155" y="62" className="fill-white text-lg font-bold" textAnchor="middle">?</text>
        </svg>
    );
}

// No Subscriptions
export function NoSubscriptionsIllustration({ className = 'w-48 h-48' }) {
    return (
        <svg viewBox="0 0 200 200" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Background */}
            <circle cx="100" cy="100" r="80" className="fill-violet-50 dark:fill-violet-900/20" />

            {/* Calendar */}
            <rect x="55" y="55" width="90" height="80" rx="8" className="fill-white dark:fill-slate-700 stroke-slate-200 dark:stroke-slate-600" strokeWidth="2" />
            <rect x="55" y="55" width="90" height="25" rx="8" className="fill-violet-500" />

            {/* Calendar dots */}
            <circle cx="75" cy="97" r="6" className="fill-slate-200 dark:fill-slate-500" />
            <circle cx="100" cy="97" r="6" className="fill-slate-200 dark:fill-slate-500" />
            <circle cx="125" cy="97" r="6" className="fill-slate-200 dark:fill-slate-500" />
            <circle cx="75" cy="118" r="6" className="fill-slate-200 dark:fill-slate-500" />
            <circle cx="100" cy="118" r="6" className="fill-violet-300 dark:fill-violet-400" />
            <circle cx="125" cy="118" r="6" className="fill-slate-200 dark:fill-slate-500" />

            {/* Recurring arrows */}
            <path d="M145 150 A20 20 0 1 1 165 130" className="stroke-violet-500" strokeWidth="3" fill="none" strokeLinecap="round" />
            <polygon points="168,135 165,125 158,132" className="fill-violet-500" />
        </svg>
    );
}

// Empty Investments
export function NoInvestmentsIllustration({ className = 'w-48 h-48' }) {
    return (
        <svg viewBox="0 0 200 200" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Background */}
            <circle cx="100" cy="100" r="80" className="fill-amber-50 dark:fill-amber-900/20" />

            {/* Trend line going up */}
            <polyline points="40,130 70,110 100,90 130,70 160,50" className="stroke-emerald-400" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />

            {/* Data points */}
            <circle cx="40" cy="130" r="6" className="fill-emerald-500" />
            <circle cx="70" cy="110" r="6" className="fill-emerald-500" />
            <circle cx="100" cy="90" r="6" className="fill-emerald-500" />
            <circle cx="130" cy="70" r="6" className="fill-emerald-500" />
            <circle cx="160" cy="50" r="6" className="fill-emerald-500" />

            {/* Coin */}
            <circle cx="50" cy="160" r="18" className="fill-amber-400 stroke-amber-500" strokeWidth="2" />
            <text x="50" y="166" className="fill-amber-700 text-sm font-bold" textAnchor="middle">$</text>
        </svg>
    );
}

// Success/Complete state
export function SuccessIllustration({ className = 'w-48 h-48' }) {
    return (
        <svg viewBox="0 0 200 200" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Background */}
            <circle cx="100" cy="100" r="80" className="fill-emerald-50 dark:fill-emerald-900/20" />

            {/* Checkmark circle */}
            <circle cx="100" cy="100" r="50" className="fill-emerald-500" />
            <polyline points="75,100 92,117 125,84" stroke="white" strokeWidth="8" fill="none" strokeLinecap="round" strokeLinejoin="round" />

            {/* Sparkles */}
            <circle cx="45" cy="60" r="4" className="fill-amber-400" />
            <circle cx="155" cy="55" r="5" className="fill-emerald-300" />
            <circle cx="160" cy="145" r="3" className="fill-blue-400" />
            <circle cx="40" cy="140" r="4" className="fill-violet-400" />
        </svg>
    );
}

export default {
    NoTransactionsIllustration,
    NoGoalsIllustration,
    NoDataIllustration,
    NoSubscriptionsIllustration,
    NoInvestmentsIllustration,
    SuccessIllustration
};
