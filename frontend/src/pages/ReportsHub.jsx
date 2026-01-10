import React, { useState } from 'react';
import { BarChart3, Calendar, Zap } from 'lucide-react';

// Import existing page components
import Reports from './Reports';
import FinancialCalendar from './FinancialCalendar';
import Insights from './Insights';

/**
 * ReportsHub - Tabbed container for Reports, Calendar, and Insights
 */
export default function ReportsHub() {
    const [activeTab, setActiveTab] = useState('reports');

    const tabs = [
        { id: 'reports', label: 'Overview', icon: BarChart3 },
        { id: 'calendar', label: 'Calendar', icon: Calendar },
        { id: 'insights', label: 'Insights', icon: Zap },
    ];

    return (
        <div className="max-w-7xl mx-auto p-8">
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
                {activeTab === 'reports' && <ReportsContent />}
                {activeTab === 'calendar' && <CalendarContent />}
                {activeTab === 'insights' && <InsightsContent />}
            </div>
        </div>
    );
}

// Content components - no wrapper needed since pages removed their container styling
function ReportsContent() {
    return <Reports />;
}

function CalendarContent() {
    return <FinancialCalendar />;
}

function InsightsContent() {
    return <Insights />;
}
