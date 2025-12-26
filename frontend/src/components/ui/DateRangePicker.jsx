import React, { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react';

/**
 * DateRangePicker - Rich date picker with presets and calendar
 */
export default function DateRangePicker({
    startDate,
    endDate,
    onDateChange,
    className = ''
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [viewMonth, setViewMonth] = useState(new Date());
    const [selectingStart, setSelectingStart] = useState(true);
    const containerRef = useRef(null);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Presets
    const presets = [
        { label: 'Today', getDates: () => { const d = new Date(); return [d, d]; } },
        {
            label: 'This Week', getDates: () => {
                const now = new Date();
                const start = new Date(now); start.setDate(now.getDate() - now.getDay());
                const end = new Date(start); end.setDate(start.getDate() + 6);
                return [start, end];
            }
        },
        {
            label: 'This Month', getDates: () => {
                const now = new Date();
                return [new Date(now.getFullYear(), now.getMonth(), 1), new Date(now.getFullYear(), now.getMonth() + 1, 0)];
            }
        },
        {
            label: 'Last Month', getDates: () => {
                const now = new Date();
                return [new Date(now.getFullYear(), now.getMonth() - 1, 1), new Date(now.getFullYear(), now.getMonth(), 0)];
            }
        },
        {
            label: 'Last 30 Days', getDates: () => {
                const end = new Date();
                const start = new Date(); start.setDate(end.getDate() - 30);
                return [start, end];
            }
        },
        {
            label: 'Last 90 Days', getDates: () => {
                const end = new Date();
                const start = new Date(); start.setDate(end.getDate() - 90);
                return [start, end];
            }
        },
        {
            label: 'Year to Date', getDates: () => {
                const now = new Date();
                return [new Date(now.getFullYear(), 0, 1), now];
            }
        },
        {
            label: 'Last Year', getDates: () => {
                const now = new Date();
                return [new Date(now.getFullYear() - 1, 0, 1), new Date(now.getFullYear() - 1, 11, 31)];
            }
        },
    ];

    const formatDate = (date) => {
        if (!date) return '';
        return date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
    };

    const handlePresetClick = (preset) => {
        const [start, end] = preset.getDates();
        onDateChange(start.toISOString().split('T')[0], end.toISOString().split('T')[0]);
        setIsOpen(false);
    };

    const handleDayClick = (date) => {
        const dateStr = date.toISOString().split('T')[0];
        if (selectingStart) {
            onDateChange(dateStr, endDate || dateStr);
            setSelectingStart(false);
        } else {
            const newEnd = date >= new Date(startDate) ? dateStr : startDate;
            const newStart = date >= new Date(startDate) ? startDate : dateStr;
            onDateChange(newStart, newEnd);
            setSelectingStart(true);
            setIsOpen(false);
        }
    };

    // Generate calendar days
    const generateCalendar = () => {
        const year = viewMonth.getFullYear();
        const month = viewMonth.getMonth();
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        const days = [];
        // Empty slots for days before first of month
        for (let i = 0; i < firstDay; i++) {
            days.push(null);
        }
        // Actual days
        for (let i = 1; i <= daysInMonth; i++) {
            days.push(new Date(year, month, i));
        }
        return days;
    };

    const isInRange = (date) => {
        if (!date || !startDate || !endDate) return false;
        const d = date.getTime();
        return d >= new Date(startDate).getTime() && d <= new Date(endDate).getTime();
    };

    const isStart = (date) => date && startDate && date.toISOString().split('T')[0] === startDate;
    const isEnd = (date) => date && endDate && date.toISOString().split('T')[0] === endDate;

    return (
        <div ref={containerRef} className={`relative ${className}`}>
            {/* Trigger Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-700 dark:text-white hover:border-indigo-300 dark:hover:border-indigo-500 transition"
            >
                <Calendar size={16} className="text-slate-400" />
                <span>
                    {startDate && endDate
                        ? `${formatDate(new Date(startDate))} - ${formatDate(new Date(endDate))}`
                        : 'Select dates'
                    }
                </span>
            </button>

            {/* Dropdown */}
            {isOpen && (
                <div className="absolute top-full left-0 mt-2 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 z-50 flex overflow-hidden">
                    {/* Presets */}
                    <div className="w-40 border-r border-slate-200 dark:border-slate-700 p-2">
                        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-2 py-1">Quick Select</div>
                        {presets.map(preset => (
                            <button
                                key={preset.label}
                                onClick={() => handlePresetClick(preset)}
                                className="w-full text-left px-2 py-1.5 text-sm text-slate-600 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:text-indigo-600 dark:hover:text-indigo-400 rounded transition"
                            >
                                {preset.label}
                            </button>
                        ))}
                    </div>

                    {/* Calendar */}
                    <div className="p-4 w-72">
                        {/* Month Navigation */}
                        <div className="flex items-center justify-between mb-4">
                            <button
                                onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1))}
                                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"
                            >
                                <ChevronLeft size={18} />
                            </button>
                            <span className="font-semibold text-slate-800 dark:text-white">
                                {viewMonth.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })}
                            </span>
                            <button
                                onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1))}
                                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"
                            >
                                <ChevronRight size={18} />
                            </button>
                        </div>

                        {/* Day Headers */}
                        <div className="grid grid-cols-7 gap-1 mb-2">
                            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
                                <div key={d} className="text-center text-xs font-medium text-slate-400 py-1">{d}</div>
                            ))}
                        </div>

                        {/* Days Grid */}
                        <div className="grid grid-cols-7 gap-1">
                            {generateCalendar().map((date, i) => (
                                <button
                                    key={i}
                                    disabled={!date}
                                    onClick={() => date && handleDayClick(date)}
                                    className={`h-8 text-sm rounded transition
                                        ${!date ? '' : 'hover:bg-indigo-100 dark:hover:bg-indigo-900/50'}
                                        ${isStart(date) || isEnd(date) ? 'bg-indigo-500 text-white font-medium' : ''}
                                        ${isInRange(date) && !isStart(date) && !isEnd(date) ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300' : ''}
                                        ${!isInRange(date) && date ? 'text-slate-700 dark:text-slate-200' : ''}
                                    `}
                                >
                                    {date?.getDate()}
                                </button>
                            ))}
                        </div>

                        {/* Selection hint */}
                        <div className="mt-3 text-xs text-center text-slate-400">
                            {selectingStart ? 'Select start date' : 'Select end date'}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
