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
import ApiKeysSettings from '../components/settings/ApiKeysSettings';

/**
 * Settings Page with Sidebar Navigation
 * Uses sticky sidebar that stays fixed within the viewport
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
        { id: 'api-keys', label: 'API Keys', icon: Key, component: ApiKeysSettings },
        { id: 'data', label: 'Data', icon: Save, component: DataSettings },
    ];

    const ActiveComponent = tabs.find(t => t.id === activeTab)?.component || AccountInfoSettings;

    return (
        <div className="flex bg-slate-50 dark:bg-slate-900 min-h-full">
            {/* Sidebar - sticky to stay in view while content scrolls */}
            <aside className="w-64 flex-shrink-0 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 sticky top-0 h-[calc(100vh-72px)] flex flex-col">
                <div className="p-6">
                    <h1 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <SettingsIcon className="text-indigo-600" />
                        Settings
                    </h1>
                </div>

                <nav className="flex-1 overflow-y-auto px-4 space-y-1">
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

                {/* Footer Controls (Theme & Currency Placeholder) */}
                <div className="p-4 border-t border-slate-200 dark:border-slate-700 space-y-3">
                    <div className="flex items-center justify-between px-2">
                        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Appearance</span>
                        <button
                            onClick={toggleTheme}
                            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition"
                            title="Toggle Theme"
                        >
                            {theme === 'dark' ? <Moon size={16} /> : <Sun size={16} />}
                        </button>
                    </div>
                    <div className="flex items-center justify-between px-2">
                        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Currency</span>
                        <div className="flex items-center gap-1 text-xs text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded">
                            <DollarSign size={12} /> AUD
                        </div>
                    </div>
                </div>
            </aside>

            {/* Content Area */}
            <main className="flex-1 p-6 md:p-8">
                <div className="max-w-4xl mx-auto">
                    <ActiveComponent />
                </div>
            </main>
        </div>
    );
}
