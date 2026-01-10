import React from 'react';

export default function Footer() {
    return (
        <footer className="border-t border-slate-200 dark:border-slate-700 mt-auto py-8 px-4 text-center">
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-2xl mx-auto">
                DollarData is a personal finance tool provided for informational purposes only.
                It does not constitute financial, investment, legal, or tax advice.
                Please consult with a qualified professional for your specific needs.
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-4">
                &copy; {new Date().getFullYear()} David Glasser. All rights reserved.
            </p>
        </footer>
    );
}
