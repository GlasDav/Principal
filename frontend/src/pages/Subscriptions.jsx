import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CreditCard, Calendar as CalendarIcon, TrendingUp, AlertCircle, CheckCircle, ChevronLeft, ChevronRight, Plus, Trash2, Save, Edit2, X } from 'lucide-react';
import * as api from '../services/api';
import { getBucketsTree } from '../services/api';

const CalendarView = ({ subscriptions }) => {
    const [currentDate, setCurrentDate] = useState(new Date());

    const getDaysInMonth = (date) => {
        return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    };

    const getFirstDayOfMonth = (date) => {
        return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
    };

    const nextMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    };

    const prevMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    };

    const monthNames = ["January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];

    // Project due dates for this month
    const thisMonthEvents = [];
    if (subscriptions) {
        subscriptions.forEach(sub => {
            const nextDue = new Date(sub.next_due);
            // Simple projection: if next_due is in this month, show it.
            // For monthly, we can assume it lands on the same day approx.
            // Improved projection:
            // If sub is Monthly, due day ~ next_due.day
            // Check if matches current view month

            let projectedDate = new Date(nextDue);

            // Adjust logic to find occurrence in CURRENT VIEW MONTH
            // This is a naive projection just for visual demo. 
            // Correct way: iterate from last_payment by frequency until we hit window.
            // For now, let's just show next_due if it falls in window, or if monthly, project day.

            const viewYear = currentDate.getFullYear();
            const viewMonth = currentDate.getMonth();

            if (sub.frequency === "Monthly") {
                // It happens every month on the 'day' of next_due
                const day = nextDue.getDate();
                // Handle short months (e.g. 31st in Feb)
                const monthDays = getDaysInMonth(currentDate);
                const actualDay = Math.min(day, monthDays);
                const eventDate = new Date(viewYear, viewMonth, actualDay);

                thisMonthEvents.push({
                    date: eventDate.getDate(),
                    name: sub.name,
                    amount: sub.amount,
                    color: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300"
                });
            } else if (sub.next_due) {
                // For one-offs or yearly, only show if exact match
                if (nextDue.getMonth() === viewMonth && nextDue.getFullYear() === viewYear) {
                    thisMonthEvents.push({
                        date: nextDue.getDate(),
                        name: sub.name,
                        amount: sub.amount,
                        color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                    });
                }
            }
        });
    }

    const daysInMonth = getDaysInMonth(currentDate);
    const firstDay = getFirstDayOfMonth(currentDate);

    // Create grid
    const blanks = Array(firstDay).fill(null);
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    const totalSlots = [...blanks, ...days];

    return (
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
            <div className="flex justify-between items-center mb-6">
                <button onClick={prevMonth} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full">
                    <ChevronLeft size={20} className="text-slate-600 dark:text-slate-300" />
                </button>
                <h2 className="text-xl font-bold text-slate-800 dark:text-white">
                    {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
                </h2>
                <button onClick={nextMonth} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full">
                    <ChevronRight size={20} className="text-slate-600 dark:text-slate-300" />
                </button>
            </div>

            <div className="grid grid-cols-7 gap-px bg-slate-200 dark:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => (
                    <div key={d} className="bg-slate-50 dark:bg-slate-800 p-2 text-center text-xs font-semibold text-slate-500 uppercase">
                        {d}
                    </div>
                ))}

                {totalSlots.map((day, idx) => (
                    <div key={idx} className={`bg-white dark:bg-slate-800 min-h-[100px] p-2 relative ${!day ? 'bg-slate-50/50 dark:bg-slate-800/50' : ''}`}>
                        {day && (
                            <>
                                <span className={`text-sm font-medium ${day === new Date().getDate() && currentDate.getMonth() === new Date().getMonth()
                                    ? 'bg-indigo-600 text-white w-6 h-6 rounded-full flex items-center justify-center -ml-1.5'
                                    : 'text-slate-700 dark:text-slate-300'
                                    }`}>
                                    {day}
                                </span>
                                <div className="mt-1 space-y-1">
                                    {thisMonthEvents.filter(e => e.date === day).map((ev, i) => (
                                        <div key={i} className={`text-xs p-1 rounded ${ev.color} truncate`} title={`${ev.name} - $${ev.amount.toFixed(0)}`}>
                                            <span className="font-semibold">${ev.amount.toFixed(0)}</span> {ev.name}
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default function Subscriptions() {
    const [view, setView] = useState("list"); // 'list' | 'calendar'
    const queryClient = useQueryClient();
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingId, setEditingId] = useState(null);

    // Form State
    const [newName, setNewName] = useState("");
    const [newAmount, setNewAmount] = useState("");
    const [newFreq, setNewFreq] = useState("Monthly");
    const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0]);
    const [newBucketId, setNewBucketId] = useState("");
    const [newType, setNewType] = useState("Expense"); // 'Expense' | 'Income'
    const [newParentId, setNewParentId] = useState(""); // For linking shared subs

    // Data
    const { data: buckets = [] } = useQuery({ queryKey: ['bucketsTree'], queryFn: getBucketsTree });
    const { data: active = [], isLoading: loadingActive } = useQuery({
        queryKey: ['subscriptions'],
        queryFn: api.getSubscriptions
    });

    const { data: suggested = [], isLoading: loadingSuggested } = useQuery({
        queryKey: ['suggestedSubscriptions'],
        queryFn: api.getSuggestedSubscriptions
    });

    // Grouping Logic for Shared Subscriptions
    const groupedActive = React.useMemo(() => {
        if (!active.length) return [];

        const groups = {};
        const orphans = [];
        const children = [];

        // 1. Identify Parents and Children
        active.forEach(sub => {
            if (sub.parent_id) {
                children.push(sub);
            } else {
                groups[sub.id] = { ...sub, children: [], netAmount: sub.amount };
            }
        });

        // 2. Attach Children
        children.forEach(sub => {
            if (groups[sub.parent_id]) {
                groups[sub.parent_id].children.push(sub);
                // Calculate Net Amount: Expense (+) - Income (+) = Net
                // If child is Income (reimbursement), subtract it.
                if (sub.type === 'Income') {
                    groups[sub.parent_id].netAmount -= sub.amount;
                } else {
                    // If child is expense (add-on), add it
                    groups[sub.parent_id].netAmount += sub.amount;
                }
            } else {
                orphans.push(sub);
            }
        });

        return [...Object.values(groups), ...orphans];
    }, [active]);

    // Mutations
    const createMutation = useMutation({
        mutationFn: api.createSubscription,
        onSuccess: () => {
            queryClient.invalidateQueries(['subscriptions']);
            queryClient.invalidateQueries(['suggestedSubscriptions']);
            resetForm();
        }
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }) => api.updateSubscription(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries(['subscriptions']);
            resetForm();
        }
    });

    const deleteMutation = useMutation({
        mutationFn: api.deleteSubscription,
        onSuccess: () => {
            queryClient.invalidateQueries(['subscriptions']);
        }
    });

    const resetForm = () => {
        setIsFormOpen(false);
        setEditingId(null);
        setNewName("");
        setNewAmount("");
        setNewFreq("Monthly");
        setNewDate(new Date().toISOString().split('T')[0]);
        setNewBucketId("");
        setNewType("Expense");
        setNewParentId("");
    };

    const handleEdit = (sub) => {
        setEditingId(sub.id);
        setNewName(sub.name);
        setNewAmount(parseFloat(sub.amount).toFixed(2));
        setNewFreq(sub.frequency);
        setNewDate(new Date(sub.next_due_date).toISOString().split('T')[0]);
        setNewBucketId(sub.bucket_id || "");
        setNewType(sub.type || "Expense");
        setNewParentId(sub.parent_id || "");
        setIsFormOpen(true);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        const payload = {
            name: newName,
            amount: parseFloat(newAmount),
            frequency: newFreq,
            next_due_date: newDate,
            is_active: true,
            bucket_id: newBucketId ? parseInt(newBucketId) : null,
            type: newType,
            parent_id: newParentId ? parseInt(newParentId) : null
        };

        if (editingId) {
            updateMutation.mutate({ id: editingId, data: payload });
        } else {
            createMutation.mutate(payload);
        }
    };

    const confirmSuggestion = (sub) => {
        createMutation.mutate({
            name: sub.name,
            amount: sub.amount,
            frequency: sub.frequency,
            next_due_date: new Date(sub.next_due).toISOString().split('T')[0],
            description_keyword: sub.description_keyword,
            is_active: true,
            type: sub.type || "Expense",
            bucket_id: sub.bucket_id || null  // Inherit category from transaction
        });
    };

    // Helper to render hierarchical category options (matches Transactions page)
    const renderCategoryOptions = (treeBuckets) => {
        if (!treeBuckets || treeBuckets.length === 0) return null;

        return treeBuckets.map(parent => {
            // Skip the Income parent category itself but show its children
            if (parent.name === 'Income' && parent.group === 'Income') {
                if (parent.children && parent.children.length > 0) {
                    return (
                        <optgroup key={parent.id} label="Income" className="dark:bg-slate-800 dark:text-white text-slate-900">
                            {parent.children.sort((a, b) => a.name.localeCompare(b.name)).map(child => (
                                <option key={child.id} value={child.id} className="dark:bg-slate-800 dark:text-white text-slate-900">{child.name}</option>
                            ))}
                        </optgroup>
                    );
                }
                return null;
            }

            // For parents with children, render as optgroup
            if (parent.children && parent.children.length > 0) {
                return (
                    <optgroup key={parent.id} label={parent.name} className="dark:bg-slate-800 dark:text-white text-slate-900">
                        {parent.children.sort((a, b) => a.name.localeCompare(b.name)).map(child => (
                            <option key={child.id} value={child.id} className="dark:bg-slate-800 dark:text-white text-slate-900">{child.name}</option>
                        ))}
                    </optgroup>
                );
            }

            // For leaf categories (no children), render as plain option
            return <option key={parent.id} value={parent.id} className="dark:bg-slate-800 dark:text-white text-slate-900">{parent.name}</option>;
        });
    };

    // Helper to find bucket name in hierarchical tree structure
    const findBucketName = (bucketId) => {
        if (!bucketId || !buckets) return null;

        for (const parent of buckets) {
            if (parent.id === bucketId) return parent.name;
            if (parent.children) {
                const child = parent.children.find(c => c.id === bucketId);
                if (child) return child.name;
            }
        }
        return null;
    };

    // Helper for formatting currency with thousands separators
    const formatCurrency = (amount, decimals = 2) => {
        return amount.toLocaleString('en-AU', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    };

    const totalMonthly = active.reduce((sum, sub) => {
        const amount = sub.type === 'Income' ? -sub.amount : sub.amount;
        return sum + amount;
    }, 0);

    const totalAnnual = active.reduce((sum, sub) => {
        const mult = sub.frequency === "Monthly" ? 12 : sub.frequency === "Weekly" ? 52 : 1;
        const amount = sub.type === 'Income' ? -sub.amount : sub.amount;
        return sum + (amount * mult);
    }, 0);

    if (loadingActive || loadingSuggested) return <div className="p-8 text-center text-slate-500">Scanning transaction history for patterns...</div>;

    return (
        <div className="max-w-7xl mx-auto p-8 space-y-8">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                        <CreditCard className="text-indigo-600" />
                        Recurring Bills
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-2">
                        {active.length} active subscriptions • {suggested.length} suggestions found
                    </p>
                </div>

                <div className="flex gap-4">
                    <button
                        onClick={() => {
                            if (isFormOpen && !editingId) {
                                resetForm();
                            } else {
                                resetForm(); // Clear any edit state
                                setIsFormOpen(true);
                            }
                        }}
                        className={`px-4 py-2 rounded-lg font-medium shadow-sm flex items-center gap-2 transition ${isFormOpen && !editingId ? 'bg-slate-200 text-slate-700' : 'bg-indigo-600 hover:bg-indigo-700 text-white'}`}
                    >
                        {isFormOpen && !editingId ? <X size={20} /> : <Plus size={20} />}
                        {isFormOpen && !editingId ? 'Cancel' : 'Add Manual'}
                    </button>

                    <div className="bg-slate-100 dark:bg-slate-800 p-1 rounded-lg flex">
                        <button
                            onClick={() => setView("list")}
                            className={`px-4 py-2 text-sm font-medium rounded-md transition ${view === "list" ? "bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm" : "text-slate-500 hover:text-slate-700 dark:text-slate-400"}`}
                        >
                            List
                        </button>
                        <button
                            onClick={() => setView("calendar")}
                            className={`px-4 py-2 text-sm font-medium rounded-md transition ${view === "calendar" ? "bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm" : "text-slate-500 hover:text-slate-700 dark:text-slate-400"}`}
                        >
                            Calendar
                        </button>
                    </div>
                </div>
            </header>

            {/* Add Form (only when adding new, not editing) */}
            {isFormOpen && !editingId && (
                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-indigo-100 dark:border-indigo-900 ring-4 ring-indigo-50 dark:ring-indigo-900/20">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                            {editingId ? 'Edit Subscription' : 'Add Subscription'}
                        </h3>
                        <div className="flex gap-2">
                            <div className="flex p-0.5 bg-slate-100 dark:bg-slate-700 rounded-lg">
                                <button
                                    type="button"
                                    onClick={() => setNewType('Expense')}
                                    className={`px-3 py-1 text-xs font-medium rounded-md transition ${newType === 'Expense'
                                        ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm'
                                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'}`}
                                >
                                    Expense
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setNewType('Income')}
                                    className={`px-3 py-1 text-xs font-medium rounded-md transition ${newType === 'Income'
                                        ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm'
                                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'}`}
                                >
                                    Income
                                </button>
                            </div>
                            <button onClick={resetForm} className="text-slate-400 hover:text-slate-600">
                                <X size={20} />
                            </button>
                        </div>
                    </div>
                    <form onSubmit={handleSubmit} className="flex flex-col md:flex-row gap-4 items-end">
                        <div className="flex-1 w-full">
                            <label className="block text-xs font-medium text-slate-500 mb-1">Name</label>
                            <input
                                type="text"
                                placeholder={newType === 'Income' ? "Salary" : "Netflix"}
                                className="w-full rounded-lg border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white px-3 py-2"
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                required
                            />
                        </div>
                        <div className="w-full md:w-32">
                            <label className="block text-xs font-medium text-slate-500 mb-1">Amount</label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                                <input
                                    type="number"
                                    step="0.01"
                                    className="w-full rounded-lg border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white pl-8 pr-3 py-2"
                                    value={newAmount}
                                    onChange={(e) => setNewAmount(e.target.value)}
                                    required
                                />
                            </div>
                        </div>
                        <div className="w-full md:w-40">
                            <label className="block text-xs font-medium text-slate-500 mb-1">Frequency</label>
                            <select
                                className="w-full rounded-lg border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white px-3 py-2"
                                value={newFreq}
                                onChange={(e) => setNewFreq(e.target.value)}
                            >
                                <option value="Monthly">Monthly</option>
                                <option value="Weekly">Weekly</option>
                                <option value="Yearly">Yearly</option>
                            </select>
                        </div>
                        <div className="w-full md:w-40">
                            <label className="block text-xs font-medium text-slate-500 mb-1">Next Due</label>
                            <input
                                type="date"
                                className="w-full rounded-lg border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white px-3 py-2"
                                value={newDate}
                                onChange={(e) => setNewDate(e.target.value)}
                                required
                            />
                        </div>
                        <div className="w-full md:w-48">
                            <label className="block text-xs font-medium text-slate-500 mb-1">Budget Category</label>
                            <select
                                className="w-full rounded-lg border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white px-3 py-2"
                                value={newBucketId}
                                onChange={(e) => setNewBucketId(e.target.value)}
                            >
                                <option value="">Select Category...</option>
                                {renderCategoryOptions(buckets)}
                            </select>
                        </div>
                        <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white p-2.5 rounded-lg">
                            <Save size={20} />
                        </button>
                    </form>
                    {newType === 'Income' && (
                        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700">
                            <label className="block text-xs font-medium text-slate-500 mb-1">
                                Link to Expense (Optional) - <span className="text-xs font-normal text-slate-400">Is this a reimbursement for another bill?</span>
                            </label>
                            <select
                                className="w-full rounded-lg border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white px-3 py-2"
                                value={newParentId}
                                onChange={(e) => setNewParentId(e.target.value)}
                            >
                                <option value="">No Parent (Standalone Income)</option>
                                {active.filter(s => s.type === 'Expense' && s.id !== editingId).map(s => (
                                    <option key={s.id} value={s.id}>
                                        {s.name} (${s.amount.toFixed(2)})
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>
            )}

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-full text-indigo-600 dark:text-indigo-400">
                            <TrendingUp size={24} />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Net Monthly Cost</p>
                            <h3 className="text-2xl font-bold text-slate-900 dark:text-white">${formatCurrency(totalMonthly)}</h3>
                        </div>
                    </div>
                </div>
                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-full text-emerald-600 dark:text-emerald-400">
                            <CalendarIcon size={24} />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Net Annual Projection</p>
                            <h3 className="text-2xl font-bold text-slate-900 dark:text-white">${formatCurrency(totalAnnual)}</h3>
                        </div>
                    </div>
                </div>
                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-full text-amber-600 dark:text-amber-400">
                            <AlertCircle size={24} />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Active Items</p>
                            <h3 className="text-2xl font-bold text-slate-900 dark:text-white">{active.length}</h3>
                        </div>
                    </div>
                </div>
            </div>

            {/* Content View */}
            {
                view === "list" ? (
                    <div className="space-y-8">
                        {/* Active Subscriptions */}
                        <div>
                            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Active Subscriptions</h2>
                            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                                <div className="divide-y divide-slate-100 dark:divide-slate-700">
                                    {groupedActive.length === 0 ? (
                                        <div className="p-8 text-center text-slate-500">
                                            No active subscriptions. Add one manually or approve a suggestion below.
                                        </div>
                                    ) : groupedActive.map((sub) => (
                                        <div key={sub.id} className="group border-b border-slate-100 dark:border-slate-700 last:border-0">
                                            {/* Main Row */}
                                            <div className="p-6 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/50 transition">
                                                <div className="flex items-center gap-4">
                                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg ${sub.type === 'Income' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30' : 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30'}`}>
                                                        {sub.name.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                                            {sub.name}
                                                            {sub.children && sub.children.length > 0 && (
                                                                <span className="text-xs font-normal px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-500 rounded-full">
                                                                    Shared Group
                                                                </span>
                                                            )}
                                                        </h3>
                                                        <div className="flex items-center gap-3 text-sm text-slate-500 mt-1">
                                                            <span className="flex items-center gap-1">
                                                                <CheckCircle size={14} className={sub.type === 'Income' ? "text-emerald-500" : "text-indigo-500"} />
                                                                {sub.frequency}
                                                            </span>
                                                            <span>•</span>
                                                            <span>Next: {new Date(sub.next_due_date).toLocaleDateString('en-AU')}</span>
                                                        </div>
                                                        {sub.bucket_id && (
                                                            <div className="mt-1 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                                                                {findBucketName(sub.bucket_id) || "Unknown Category"}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-6">
                                                    <div className="text-right">
                                                        {sub.children && sub.children.length > 0 ? (
                                                            <>
                                                                <div className="text-sm text-slate-400 line-through decoration-slate-400">
                                                                    ${formatCurrency(sub.amount)}
                                                                </div>
                                                                <div className="text-lg font-bold text-slate-900 dark:text-white">
                                                                    ${formatCurrency(sub.netAmount)} <span className="text-xs font-normal text-slate-500">net</span>
                                                                </div>
                                                            </>
                                                        ) : (
                                                            <div className={`text-lg font-bold ${sub.type === 'Income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-white'}`}>
                                                                {sub.type === 'Income' ? '+' : ''}${formatCurrency(sub.amount)}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button
                                                            onClick={() => handleEdit(sub)}
                                                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition"
                                                            title="Edit"
                                                        >
                                                            <Edit2 size={18} />
                                                        </button>
                                                        <button
                                                            onClick={() => deleteMutation.mutate(sub.id)}
                                                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
                                                            disabled={deleteMutation.isPending}
                                                            title="Delete"
                                                        >
                                                            <Trash2 size={18} />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Inline Edit Form (appears below this row when editing) */}
                                            {editingId === sub.id && (
                                                <div className="bg-indigo-50/50 dark:bg-indigo-900/10 border-t border-indigo-100 dark:border-indigo-900/30 p-4">
                                                    <form onSubmit={handleSubmit} className="space-y-4">
                                                        <div className="flex justify-between items-center">
                                                            <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Edit Subscription</h4>
                                                            <div className="flex gap-2">
                                                                <div className="flex p-0.5 bg-slate-100 dark:bg-slate-700 rounded-lg">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setNewType('Expense')}
                                                                        className={`px-2 py-0.5 text-xs font-medium rounded transition ${newType === 'Expense'
                                                                            ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm'
                                                                            : 'text-slate-500 dark:text-slate-400'}`}
                                                                    >
                                                                        Expense
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setNewType('Income')}
                                                                        className={`px-2 py-0.5 text-xs font-medium rounded transition ${newType === 'Income'
                                                                            ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm'
                                                                            : 'text-slate-500 dark:text-slate-400'}`}
                                                                    >
                                                                        Income
                                                                    </button>
                                                                </div>
                                                                <button type="button" onClick={resetForm} className="text-slate-400 hover:text-slate-600">
                                                                    <X size={18} />
                                                                </button>
                                                            </div>
                                                        </div>
                                                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                                                            <div>
                                                                <label className="block text-xs font-medium text-slate-500 mb-1">Name</label>
                                                                <input
                                                                    type="text"
                                                                    className="w-full rounded-lg border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white px-2 py-1.5 text-sm"
                                                                    value={newName}
                                                                    onChange={(e) => setNewName(e.target.value)}
                                                                    required
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="block text-xs font-medium text-slate-500 mb-1">Amount</label>
                                                                <div className="relative">
                                                                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                                                                    <input
                                                                        type="number"
                                                                        step="0.01"
                                                                        className="w-full rounded-lg border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white pl-6 pr-2 py-1.5 text-sm"
                                                                        value={newAmount}
                                                                        onChange={(e) => setNewAmount(e.target.value)}
                                                                        required
                                                                    />
                                                                </div>
                                                            </div>
                                                            <div>
                                                                <label className="block text-xs font-medium text-slate-500 mb-1">Frequency</label>
                                                                <select
                                                                    className="w-full rounded-lg border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white px-2 py-1.5 text-sm"
                                                                    value={newFreq}
                                                                    onChange={(e) => setNewFreq(e.target.value)}
                                                                >
                                                                    <option value="Monthly">Monthly</option>
                                                                    <option value="Weekly">Weekly</option>
                                                                    <option value="Yearly">Yearly</option>
                                                                </select>
                                                            </div>
                                                            <div>
                                                                <label className="block text-xs font-medium text-slate-500 mb-1">Next Due</label>
                                                                <input
                                                                    type="date"
                                                                    className="w-full rounded-lg border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white px-2 py-1.5 text-sm"
                                                                    value={newDate}
                                                                    onChange={(e) => setNewDate(e.target.value)}
                                                                    required
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="block text-xs font-medium text-slate-500 mb-1">Category</label>
                                                                <select
                                                                    className="w-full rounded-lg border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white px-2 py-1.5 text-sm"
                                                                    value={newBucketId}
                                                                    onChange={(e) => setNewBucketId(e.target.value)}
                                                                >
                                                                    <option value="">Select...</option>
                                                                    {renderCategoryOptions(buckets)}
                                                                </select>
                                                            </div>
                                                        </div>
                                                        {newType === 'Income' && (
                                                            <div>
                                                                <label className="block text-xs font-medium text-slate-500 mb-1">Link to Expense (Optional)</label>
                                                                <select
                                                                    className="w-full rounded-lg border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white px-2 py-1.5 text-sm"
                                                                    value={newParentId}
                                                                    onChange={(e) => setNewParentId(e.target.value)}
                                                                >
                                                                    <option value="">No Parent (Standalone Income)</option>
                                                                    {active.filter(s => s.type === 'Expense' && s.id !== editingId).map(s => (
                                                                        <option key={s.id} value={s.id}>{s.name} (${s.amount.toFixed(2)})</option>
                                                                    ))}
                                                                </select>
                                                            </div>
                                                        )}
                                                        <div className="flex justify-end">
                                                            <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2">
                                                                <Save size={16} />
                                                                Save Changes
                                                            </button>
                                                        </div>
                                                    </form>
                                                </div>
                                            )}

                                            {/* Children Rows */}
                                            {sub.children && sub.children.length > 0 && (
                                                <div className="bg-slate-50/50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-700 pl-20 pr-6 py-3">
                                                    {sub.children.map(child => (
                                                        <div key={child.id} className="flex items-center justify-between py-2 group/child">
                                                            <div className="flex items-center gap-3">
                                                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${child.type === 'Income' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50' : 'bg-slate-200 text-slate-600'}`}>
                                                                    {child.name.charAt(0)}
                                                                </div>
                                                                <div>
                                                                    <div className="font-medium text-sm text-slate-700 dark:text-slate-300">
                                                                        {child.name}
                                                                        <span className="ml-2 text-xs text-slate-400 font-normal">
                                                                            ({child.type === 'Income' ? 'Reimbursement' : 'Shared Cost'})
                                                                        </span>
                                                                    </div>
                                                                    <div className="text-xs text-slate-400">
                                                                        {child.frequency} • {new Date(child.next_due_date).toLocaleDateString()}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-4">
                                                                <div className={`text-sm font-bold ${child.type === 'Income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-600'}`}>
                                                                    {child.type === 'Income' ? '+' : ''}${formatCurrency(child.amount)}
                                                                </div>
                                                                <div className="flex gap-1 opacity-0 group-hover/child:opacity-100 transition-opacity">
                                                                    <button
                                                                        onClick={() => handleEdit(child)}
                                                                        className="p-1.5 text-slate-400 hover:text-indigo-600 rounded transition"
                                                                    >
                                                                        <Edit2 size={14} />
                                                                    </button>
                                                                    <button
                                                                        onClick={() => deleteMutation.mutate(child.id)}
                                                                        className="p-1.5 text-slate-400 hover:text-red-500 rounded transition"
                                                                    >
                                                                        <Trash2 size={14} />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Suggested Subscriptions */}
                        {suggested.length > 0 && (
                            <div>
                                <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                                    <span>Detected Suggestions</span>
                                    <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full text-xs font-medium">Auto-detected</span>
                                </h2>
                                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                                    <div className="divide-y divide-slate-100 dark:divide-slate-700">
                                        {suggested.map((sub, idx) => (
                                            <div key={idx} className="p-6 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/50 transition">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center font-bold text-amber-600 dark:text-amber-400 text-lg">
                                                        {sub.name.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <h3 className="font-bold text-slate-900 dark:text-white">{sub.name}</h3>
                                                        <div className="flex items-center gap-3 text-sm text-slate-500 mt-1">
                                                            <span className="flex items-center gap-1">
                                                                Est. {sub.frequency}
                                                            </span>
                                                            <span>•</span>
                                                            <span>Last paid: {new Date(sub.last_payment_date).toLocaleDateString('en-AU')}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-4">
                                                    <div className="text-right">
                                                        <div className="text-lg font-bold text-slate-900 dark:text-white">${formatCurrency(sub.amount)}</div>
                                                        <div className="text-xs text-slate-400">{sub.confidence} confidence</div>
                                                    </div>
                                                    <button
                                                        onClick={() => confirmSuggestion(sub)}
                                                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2"
                                                    >
                                                        <Plus size={16} />
                                                        Add
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <CalendarView subscriptions={active} />
                )
            }
        </div >
    );
}
