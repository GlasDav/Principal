import React, { Fragment } from 'react';
import { Dialog, Transition, Switch } from '@headlessui/react';
import { X as XIcon, LayoutDashboard as LayoutIcon } from 'lucide-react';

const WIDGET_LABELS = {
    'summary-cards': 'Financial Overview Cards',
    'recent-activity': 'Recent Activity & Bills',
    'budget-progress': 'Budget Progress',
    'insights-cards': 'Spending Insights',
    'achievements': 'Achievements',
    'financial-overview': 'Net Worth & Goals',
    'period-comparison': 'Period Comparison',
    'cash-flow': 'Cash Flow (Sankey)',
    'spending-trends': 'Spending Trends'
};

export default function CustomizeDashboardModal({ isOpen, onClose, widgetOrder, visibleWidgets, onToggleWidget }) {
    return (
        <Transition show={isOpen} as={Fragment}>
            <Dialog onClose={onClose} className="relative z-50">
                {/* Backdrop */}
                <Transition.Child
                    as={Fragment}
                    enter="ease-out duration-300"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in duration-200"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" aria-hidden="true" />
                </Transition.Child>

                {/* Modal Container */}
                <div className="fixed inset-0 flex items-center justify-center p-4">
                    <Transition.Child
                        as={Fragment}
                        enter="ease-out duration-300"
                        enterFrom="opacity-0 scale-95"
                        enterTo="opacity-100 scale-100"
                        leave="ease-in duration-200"
                        leaveFrom="opacity-100 scale-100"
                        leaveTo="opacity-0 scale-95"
                    >
                        <Dialog.Panel className="w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col max-h-[80vh]">
                            {/* Header */}
                            <div className="p-5 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
                                <Dialog.Title className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                    <LayoutIcon size={20} className="text-indigo-500" />
                                    Customize Dashboard
                                </Dialog.Title>
                                <button
                                    onClick={onClose}
                                    className="text-slate-400 hover:text-slate-500 dark:hover:text-slate-300 transition-colors"
                                >
                                    <XIcon size={20} />
                                </button>
                            </div>

                            {/* Content */}
                            <div className="p-0 overflow-y-auto">
                                <div className="p-5 space-y-4">
                                    <p className="text-sm text-slate-500 dark:text-slate-400">
                                        Toggle widgets to show or hide them on your dashboard.
                                        Drag widgets on the dashboard to reorder them.
                                    </p>

                                    <div className="space-y-3">
                                        {widgetOrder.map((widgetId) => (
                                            <div
                                                key={widgetId}
                                                className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-700/30 border border-slate-100 dark:border-slate-700/50"
                                            >
                                                <span className="font-medium text-slate-700 dark:text-slate-200">
                                                    {WIDGET_LABELS[widgetId] || widgetId}
                                                </span>
                                                <Switch
                                                    checked={visibleWidgets[widgetId] !== false} // Default to true if undefined
                                                    onChange={() => onToggleWidget(widgetId)}
                                                    className={`${visibleWidgets[widgetId] !== false ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-slate-600'
                                                        } relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-slate-800`}
                                                >
                                                    <span className="sr-only">Enable widget</span>
                                                    <span
                                                        className={`${visibleWidgets[widgetId] !== false ? 'translate-x-6' : 'translate-x-1'
                                                            } inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
                                                    />
                                                </Switch>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="p-5 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex justify-end">
                                <button
                                    onClick={onClose}
                                    className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
                                >
                                    Done
                                </button>
                            </div>
                        </Dialog.Panel>
                    </Transition.Child>
                </div>
            </Dialog>
        </Transition>
    );
}
