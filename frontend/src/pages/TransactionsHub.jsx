import React, { useState } from 'react';
import { List, CreditCard, Users } from 'lucide-react';

// Lazy import existing components
import Transactions from './Transactions';
import Subscriptions from './Subscriptions';
import Review from './Review';

/**
 * TransactionsHub - Tabbed container for Transactions, Subscriptions, and Review
 */
export default function TransactionsHub() {
    const [activeTab, setActiveTab] = useState('transactions');

    const tabs = [
        { id: 'transactions', label: 'All Transactions', icon: List },
        { id: 'subscriptions', label: 'Subscriptions', icon: CreditCard },
        { id: 'review', label: 'Needs Review', icon: Users },
    ];

    return (
        <div className="max-w-6xl mx-auto p-8">
            {/* Tab Navigation */}
            <div className="flex gap-1 border-b border-slate-200 dark:border-slate-700 mb-6">
                {tabs.map(tab => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${isActive
                                    ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                                    : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                                }`}
                        >
                            <Icon size={16} />
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            {/* Tab Content */}
            <div>
                {activeTab === 'transactions' && <TransactionsContent />}
                {activeTab === 'subscriptions' && <SubscriptionsContent />}
                {activeTab === 'review' && <ReviewContent />}
            </div>
        </div>
    );
}

// Wrapper to strip the page-level padding from existing components
function TransactionsContent() {
    return (
        <div className="-m-8">
            <Transactions />
        </div>
    );
}

function SubscriptionsContent() {
    return (
        <div className="-m-8">
            <Subscriptions />
        </div>
    );
}

function ReviewContent() {
    return (
        <div className="-m-8">
            <Review />
        </div>
    );
}
