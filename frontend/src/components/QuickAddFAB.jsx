import React, { useState, useRef, useEffect } from 'react';
import { Plus, X, List, LineChart, PiggyBank, UploadCloud } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function QuickAddFAB() {
    const [isOpen, setIsOpen] = useState(false);
    const navigate = useNavigate();
    const menuRef = useRef(null);

    // Close on click outside
    useEffect(() => {
        function handleClickOutside(event) {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    const handleClick = (path) => {
        setIsOpen(false);
        navigate(path);
    };

    return (
        <div className="fixed bottom-24 right-6 z-50 flex flex-col items-end pointer-events-none" ref={menuRef}>
            {/* Menu Options */}
            <div className={`transition-all duration-200 origin-bottom-right flex flex-col gap-3 mb-4 ${isOpen ? 'opacity-100 scale-100 translate-y-0 pointer-events-auto' : 'opacity-0 scale-95 translate-y-4 pointer-events-none'}`}>

                <button
                    onClick={() => handleClick('/data-management')}
                    className="flex items-center justify-end gap-3 bg-white dark:bg-slate-800 pr-3 pl-4 py-2.5 rounded-xl shadow-lg border border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors group min-w-[160px]"
                >
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Import Data</span>
                    <div className="w-9 h-9 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform shrink-0">
                        <UploadCloud size={18} />
                    </div>
                </button>

                <button
                    onClick={() => handleClick('/net-worth')}
                    className="flex items-center justify-end gap-3 bg-white dark:bg-slate-800 pr-3 pl-4 py-2.5 rounded-xl shadow-lg border border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors group min-w-[160px]"
                >
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Add Asset</span>
                    <div className="w-9 h-9 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform shrink-0">
                        <LineChart size={18} />
                    </div>
                </button>

                <button
                    onClick={() => handleClick('/budget')}
                    className="flex items-center justify-end gap-3 bg-white dark:bg-slate-800 pr-3 pl-4 py-2.5 rounded-xl shadow-lg border border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors group min-w-[160px]"
                >
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-200">New Budget</span>
                    <div className="w-9 h-9 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center text-violet-600 dark:text-violet-400 group-hover:scale-110 transition-transform shrink-0">
                        <PiggyBank size={18} />
                    </div>
                </button>

            </div>

            {/* Main FAB */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`w-14 h-14 rounded-full shadow-xl flex items-center justify-center transition-all duration-300 pointer-events-auto ${isOpen ? 'bg-slate-800 dark:bg-white text-white dark:text-slate-900 rotate-45' : 'bg-gradient-to-r from-indigo-500 to-indigo-600 text-white rotate-0 hover:scale-110'}`}
            >
                <Plus size={28} strokeWidth={2.5} />
            </button>
        </div>
    );
}
