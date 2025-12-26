import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Dialog } from '@headlessui/react';
import {
    Search, LayoutDashboard, LineChart, List, Calendar, CreditCard, Target,
    PiggyBank, BarChart3, Settings, Zap, Wrench, UploadCloud, Users,
    ArrowRight, Command, CornerDownLeft
} from 'lucide-react';

const COMMANDS = [
    // Navigation
    { id: 'nav-dashboard', label: 'Go to Dashboard', icon: LayoutDashboard, path: '/', category: 'Navigation' },
    { id: 'nav-networth', label: 'Go to Net Worth', icon: LineChart, path: '/net-worth', category: 'Navigation' },
    { id: 'nav-transactions', label: 'Go to Transactions', icon: List, path: '/transactions', category: 'Navigation' },
    { id: 'nav-calendar', label: 'Go to Calendar', icon: Calendar, path: '/calendar', category: 'Navigation' },
    { id: 'nav-subscriptions', label: 'Go to Subscriptions', icon: CreditCard, path: '/subscriptions', category: 'Navigation' },
    { id: 'nav-goals', label: 'Go to Goals', icon: Target, path: '/goals', category: 'Navigation' },
    { id: 'nav-budget', label: 'Go to Budget', icon: PiggyBank, path: '/budget', category: 'Navigation' },
    { id: 'nav-reports', label: 'Go to Reports', icon: BarChart3, path: '/reports', category: 'Navigation' },
    { id: 'nav-insights', label: 'Go to Insights', icon: Zap, path: '/insights', category: 'Navigation' },
    { id: 'nav-tools', label: 'Go to Tools', icon: Wrench, path: '/tools', category: 'Navigation' },
    { id: 'nav-settings', label: 'Go to Settings', icon: Settings, path: '/settings', category: 'Navigation' },
    { id: 'nav-review', label: 'Go to Review Queue', icon: Users, path: '/review', category: 'Navigation' },

    // Actions
    { id: 'act-import', label: 'Import Data', icon: UploadCloud, path: '/data-management', category: 'Actions' },
    { id: 'act-export', label: 'Export Transactions', icon: BarChart3, path: '/data-management', category: 'Actions' },
];

export default function CommandPalette() {
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const navigate = useNavigate();
    const location = useLocation();
    const inputRef = useRef(null);

    // Keyboard shortcut to open
    useEffect(() => {
        const handleKeyDown = (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setIsOpen(prev => !prev);
            }
            if (e.key === 'Escape') {
                setIsOpen(false);
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, []);

    // Reset state when opening
    useEffect(() => {
        if (isOpen) {
            setQuery('');
            setSelectedIndex(0);
            setTimeout(() => inputRef.current?.focus(), 0);
        }
    }, [isOpen]);

    // Filter commands based on query
    const filteredCommands = useMemo(() => {
        if (!query.trim()) return COMMANDS;

        const lower = query.toLowerCase();
        return COMMANDS.filter(cmd =>
            cmd.label.toLowerCase().includes(lower) ||
            cmd.category.toLowerCase().includes(lower)
        );
    }, [query]);

    // Group by category
    const groupedCommands = useMemo(() => {
        const groups = {};
        filteredCommands.forEach(cmd => {
            if (!groups[cmd.category]) groups[cmd.category] = [];
            groups[cmd.category].push(cmd);
        });
        return groups;
    }, [filteredCommands]);

    // Handle selection
    const handleSelect = useCallback((command) => {
        setIsOpen(false);
        if (command.path) {
            navigate(command.path);
        }
        if (command.action) {
            command.action();
        }
    }, [navigate]);

    // Keyboard navigation
    const handleKeyDown = (e) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex(prev => Math.min(prev + 1, filteredCommands.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex(prev => Math.max(prev - 1, 0));
        } else if (e.key === 'Enter' && filteredCommands[selectedIndex]) {
            handleSelect(filteredCommands[selectedIndex]);
        }
    };

    return (
        <Dialog open={isOpen} onClose={() => setIsOpen(false)} className="relative z-[200]">
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" aria-hidden="true" />

            <div className="fixed inset-0 flex items-start justify-center pt-[20vh] px-4">
                <Dialog.Panel className="w-full max-w-xl bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                    {/* Search Input */}
                    <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200 dark:border-slate-700">
                        <Search className="w-5 h-5 text-slate-400" />
                        <input
                            ref={inputRef}
                            type="text"
                            value={query}
                            onChange={(e) => { setQuery(e.target.value); setSelectedIndex(0); }}
                            onKeyDown={handleKeyDown}
                            placeholder="Search commands..."
                            className="flex-1 bg-transparent outline-none text-slate-900 dark:text-white placeholder-slate-400 text-lg"
                        />
                        <kbd className="hidden sm:flex items-center gap-1 px-2 py-1 text-xs font-medium text-slate-400 bg-slate-100 dark:bg-slate-700 rounded">
                            <Command size={12} /> K
                        </kbd>
                    </div>

                    {/* Results */}
                    <div className="max-h-80 overflow-y-auto py-2">
                        {filteredCommands.length === 0 ? (
                            <div className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">
                                No commands found for "{query}"
                            </div>
                        ) : (
                            Object.entries(groupedCommands).map(([category, commands]) => (
                                <div key={category}>
                                    <div className="px-4 py-2 text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                                        {category}
                                    </div>
                                    {commands.map((cmd, idx) => {
                                        const globalIndex = filteredCommands.indexOf(cmd);
                                        const isActive = globalIndex === selectedIndex;
                                        const Icon = cmd.icon;
                                        const isCurrentPage = location.pathname === cmd.path;

                                        return (
                                            <button
                                                key={cmd.id}
                                                onClick={() => handleSelect(cmd)}
                                                onMouseEnter={() => setSelectedIndex(globalIndex)}
                                                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${isActive
                                                    ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400'
                                                    : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                                                    }`}
                                            >
                                                <Icon size={18} className={isActive ? 'text-indigo-500' : 'text-slate-400'} />
                                                <span className="flex-1 font-medium">{cmd.label}</span>
                                                {isCurrentPage && (
                                                    <span className="text-xs text-slate-400 dark:text-slate-500">Current</span>
                                                )}
                                                {isActive && (
                                                    <CornerDownLeft size={14} className="text-indigo-400" />
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            ))
                        )}
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between px-4 py-2 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 text-xs text-slate-500 dark:text-slate-400">
                        <div className="flex items-center gap-3">
                            <span className="flex items-center gap-1">
                                <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-700 rounded shadow-sm">↑</kbd>
                                <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-700 rounded shadow-sm">↓</kbd>
                                to navigate
                            </span>
                            <span className="flex items-center gap-1">
                                <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-700 rounded shadow-sm">↵</kbd>
                                to select
                            </span>
                        </div>
                        <span className="flex items-center gap-1">
                            <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-700 rounded shadow-sm">Esc</kbd>
                            to close
                        </span>
                    </div>
                </Dialog.Panel>
            </div>
        </Dialog>
    );
}
