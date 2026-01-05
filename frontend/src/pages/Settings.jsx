import React, { useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import {
    Bell, Shield, Landmark, Tag, BookPlus, Save,
    Settings as SettingsIcon, Moon, Sun, DollarSign, Key, UserCircle
} from 'lucide-react';

// Sub-components
import AccountInfoSettings from '../components/settings/AccountInfoSettings';
import NotificationsSettings from '../components/settings/NotificationsSettings';
import SecuritySettings from '../components/settings/SecuritySettings';
import AccountsSettings from '../components/settings/AccountsSettings';
import CategoriesSettings from '../components/settings/CategoriesSettings';
import RulesSettings from '../components/settings/RulesSettings';
import DataSettings from '../components/settings/DataSettings';

/**
 * Settings Page with Fixed Sidebar Navigation
 * Sidebar uses fixed positioning to align footer border with main sidebar
 */
export default function Settings() {
    const { theme, toggleTheme } = useTheme();
    const [activeTab, setActiveTab] = useState('account');

    const tabs = [
        { id: 'account', label: 'Account', icon: UserCircle, component: AccountInfoSettings },
        { id: 'notifications', label: 'Notifications', icon: Bell, component: NotificationsSettings },
        { id: 'security', label: 'Security', icon: Shield, component: SecuritySettings },
        { id: 'accounts', label: 'Accounts', icon: Landmark, component: AccountsSettings },
        { id: 'categories', label: 'Categories', icon: Tag, component: CategoriesSettings },
        { id: 'rules', label: 'Rules', icon: BookPlus, component: RulesSettings },
        { id: 'data', label: 'Data', icon: Save, component: DataSettings },
    ];

    const ActiveComponent = tabs.find(t => t.id === activeTab)?.component || AccountInfoSettings;

    return (
        <>
            {/* Sidebar - fixed position starting at main sidebar width, top at header height */}
            <aside className="fixed left-64 top-[72px] bottom-0 w-64 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 flex flex-col z-10">
                {/* Header */}
                <div className="p-4 border-b border-slate-100 dark:border-slate-700">
                    <h1 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <SettingsIcon className="text-indigo-600" />
                        Settings
                    </h1>
                </div>

                <nav className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeTab === tab.id
                                ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-300'
                                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50'
                                }`}
                        >
                            <tab.icon size={18} />
                            {tab.label}
                        </button>
                    ))}
                </nav>

                {/* Footer Controls - structure matches main sidebar footer exactly */}
                <div className="mt-auto p-3 border-t border-slate-100 dark:border-slate-700">
                    <button
                        onClick={toggleTheme}
                        className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 w-full transition-all duration-200 mb-1"
                    >
                        {theme === 'dark' ? <Moon size={18} /> : <Sun size={18} />}
                        Appearance
                    </button>
                    <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-slate-500 w-full">
                        <DollarSign size={18} />
                        <span className="flex-1">Currency</span>
                        <span className="text-xs text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded">AUD</span>
                    </div>
                </div>
            </aside>

            {/* Content Area - add left margin to account for fixed sidebar */}
            <main className="ml-64 flex-1 p-6 md:p-8 bg-slate-50 dark:bg-slate-900 min-h-[calc(100vh-72px)]">
                <div className="max-w-4xl mx-auto">
                    <ActiveComponent />
                </div>
            </main>
        </>
    );
}
