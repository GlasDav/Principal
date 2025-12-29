import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api, { getBuckets, getSettings, getGoals, deleteAllTransactions, getMembers } from '../services/api';
import { Trash2, Search, Filter, Pencil, Split, UploadCloud, FileText, Loader2, ChevronDown, ArrowUp, ArrowDown, X, BookPlus, UserCheck, StickyNote } from 'lucide-react';
import { useSearchParams, Link } from 'react-router-dom';
import TransactionNoteModal from '../components/TransactionNoteModal';
import SplitTransactionModal from '../components/SplitTransactionModal';
import CreateRuleModal from '../components/CreateRuleModal';
import EmptyState from '../components/EmptyState';
import Button from '../components/ui/Button';
import { sortBucketsByGroup } from '../utils/bucketUtils';

// Debounce hook
function useDebounce(value, delay) {
    const [debouncedValue, setDebouncedValue] = useState(value);
    useEffect(() => {
        const handler = setTimeout(() => setDebouncedValue(value), delay);
        return () => clearTimeout(handler);
    }, [value, delay]);
    return debouncedValue;
}

export default function Transactions() {
    const queryClient = useQueryClient();
    const [searchParams, setSearchParams] = useSearchParams();

    // URL Params
    const bucketIdParam = searchParams.get("bucket_id");
    const monthParam = searchParams.get("month");
    const yearParam = searchParams.get("year");

    // Local state
    const [search, setSearch] = useState("");
    const [editingCell, setEditingCell] = useState({ id: null, field: null });
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [splitModalOpen, setSplitModalOpen] = useState(false);
    const [transactionToSplit, setTransactionToSplit] = useState(null);
    const [noteModalOpen, setNoteModalOpen] = useState(false);
    const [transactionForNote, setTransactionForNote] = useState(null);
    const [ruleModalOpen, setRuleModalOpen] = useState(false);
    const [transactionForRule, setTransactionForRule] = useState(null);
    const [assignDropdownId, setAssignDropdownId] = useState(null);  // ID of txn showing assign dropdown

    // Filters
    const [categoryFilter, setCategoryFilter] = useState(bucketIdParam ? parseInt(bucketIdParam) : null);
    const [spenderFilter, setSpenderFilter] = useState(null);
    const [sortBy, setSortBy] = useState("date");
    const [sortDir, setSortDir] = useState("desc");

    // Dropdown visibility
    const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
    const [showSpenderDropdown, setShowSpenderDropdown] = useState(false);

    // Debounced search for API calls
    const debouncedSearch = useDebounce(search, 300);

    // Fetch Transactions with filters
    const { data: transactionData, isLoading } = useQuery({
        queryKey: ['transactions', debouncedSearch, categoryFilter, spenderFilter, monthParam, yearParam, sortBy, sortDir],
        queryFn: async () => {
            const params = { limit: 500 }; // Increase limit for better search coverage
            if (debouncedSearch) params.search = debouncedSearch;
            if (categoryFilter) params.bucket_id = categoryFilter;
            if (spenderFilter) params.spender = spenderFilter;
            if (monthParam) params.month = monthParam;
            if (yearParam) params.year = yearParam;
            if (sortBy) params.sort_by = sortBy;
            if (sortDir) params.sort_dir = sortDir;

            const res = await api.get('/transactions/', { params });
            return res.data;
        }
    });

    const transactions = transactionData?.items || [];
    const totalCount = transactionData?.total || 0;

    // Fetch Buckets
    const { data: buckets = [] } = useQuery({
        queryKey: ['buckets'],
        queryFn: getBuckets
    });

    // Fetch User Settings
    const { data: userSettings } = useQuery({
        queryKey: ['userSettings'],
        queryFn: getSettings
    });


    // Fetch Goals
    const { data: goals = [] } = useQuery({
        queryKey: ['goals'],
        queryFn: getGoals
    });

    // Fetch Household Members
    const { data: members = [] } = useQuery({
        queryKey: ['members'],
        queryFn: getMembers
    });

    // Update Transaction
    const updateMutation = useMutation({
        mutationFn: async ({ id, bucket_id, description, date, amount, spender, goal_id, assigned_to }) => {
            const payload = {};
            if (bucket_id !== undefined) payload.bucket_id = bucket_id;
            if (description !== undefined) payload.description = description;
            if (date !== undefined) payload.date = date;
            if (amount !== undefined) payload.amount = amount;
            if (spender !== undefined) payload.spender = spender;
            if (goal_id !== undefined) payload.goal_id = goal_id;
            if (assigned_to !== undefined) payload.assigned_to = assigned_to;

            await api.put(`/transactions/${id}`, payload);
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['transactions']);
        }
    });

    // Batch Delete
    const deleteBatchMutation = useMutation({
        mutationFn: async (ids) => {
            // Backend expects a raw array in the body: [1, 2, 3]
            await api.post('/transactions/batch-delete', ids);
        },
        onSuccess: () => {
            setSelectedIds(new Set());
            queryClient.invalidateQueries(['transactions']);
        },
        onError: (err) => {
            console.error('Delete failed:', err);
            alert(`Failed to delete: ${err.response?.data?.detail || err.message}`);
        }
    });

    // Delete ALL Transactions
    const deleteAllMutation = useMutation({
        mutationFn: deleteAllTransactions,
        onSuccess: (data) => {
            queryClient.invalidateQueries(['transactions']);
            alert(`Successfully deleted ${data.count} transactions.`);
        },
        onError: (err) => {
            console.error('Delete all failed:', err);
            alert(`Failed to delete all: ${err.response?.data?.detail || err.message}`);
        }
    });

    // Batch Update Transactions
    const batchUpdateMutation = useMutation({
        mutationFn: async (data) => {
            const res = await api.post('/transactions/batch-update', data);
            return res.data;
        },
        onSuccess: (data) => {
            setSelectedIds(new Set());
            queryClient.invalidateQueries(['transactions']);
        },
        onError: (err) => {
            console.error('Batch update failed:', err);
            alert(`Failed to update: ${err.response?.data?.detail || err.message}`);
        }
    });

    // Selection Handlers
    const toggleSelectAll = () => {
        if (selectedIds.size === transactions.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(transactions.map(t => t.id)));
        }
    };

    const toggleSelect = (id) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setSelectedIds(newSet);
    };

    // Sort handler
    const handleSort = (column) => {
        if (sortBy === column) {
            setSortDir(sortDir === "asc" ? "desc" : "asc");
        } else {
            setSortBy(column);
            setSortDir("desc");
        }
    };

    // Active filters count
    const activeFiltersCount = [categoryFilter, spenderFilter, debouncedSearch].filter(Boolean).length;

    // Clear all filters
    const clearAllFilters = () => {
        setSearch("");
        setCategoryFilter(null);
        setSpenderFilter(null);
        setSearchParams({});
    };

    // Sort Header Component
    const SortHeader = ({ column, children, className = "" }) => (
        <th
            className={`px-3 py-3 font-semibold text-sm text-slate-600 dark:text-slate-400 cursor-pointer hover:text-indigo-600 transition select-none ${className}`}
            onClick={() => handleSort(column)}
        >
            <div className="flex items-center gap-1">
                {children}
                {sortBy === column && (
                    sortDir === "asc" ? <ArrowUp size={14} className="text-indigo-500" /> : <ArrowDown size={14} className="text-indigo-500" />
                )}
            </div>
        </th>
    );

    return (
        <div className="max-w-6xl mx-auto p-8 space-y-8" >
            <header className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Transactions</h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-2">
                        {totalCount > 0 ? `${totalCount.toLocaleString()} transactions` : 'Manage your complete transaction history.'}
                    </p>
                </div>
                <div className="flex items-center gap-4">
                    {/* Delete All Button - only show when transactions exist */}
                    {transactions.length > 0 && selectedIds.size === 0 && (
                        <button
                            onClick={() => {
                                if (window.confirm(`⚠️ DELETE ALL TRANSACTIONS?\n\nThis will permanently delete ALL transactions in your database.\n\nThis action cannot be undone!`)) {
                                    deleteAllMutation.mutate();
                                }
                            }}
                            disabled={deleteAllMutation.isPending}
                            className="bg-red-50 text-red-600 px-4 py-2 rounded-lg font-medium hover:bg-red-100 transition flex items-center gap-2 disabled:opacity-50"
                        >
                            <Trash2 size={16} />
                            {deleteAllMutation.isPending ? 'Deleting...' : 'Delete All'}
                        </button>
                    )}
                    {/* Bulk Actions for Selected */}

                    {bucketIdParam && (
                        <div className="flex items-center gap-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-3 py-1 rounded-full text-sm font-medium">
                            <Filter size={14} />
                            <span>Filtered View</span>
                            <button
                                onClick={() => setSearchParams({})}
                                className="hover:text-red-500 ml-1"
                            >
                                ×
                            </button>
                        </div>
                    )}
                    {/* Active Filters Badge */}
                    {activeFiltersCount > 0 && (
                        <button
                            onClick={clearAllFilters}
                            className="flex items-center gap-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-3 py-1 rounded-full text-sm font-medium hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition"
                        >
                            <Filter size={14} />
                            <span>{activeFiltersCount} filter{activeFiltersCount > 1 ? 's' : ''} active</span>
                            <X size={14} className="hover:text-red-500" />
                        </button>
                    )}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                            type="text"
                            placeholder="Search all transactions..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-10 pr-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 w-64"
                        />
                    </div>
                </div>
            </header>

            {/* Split Modal */}
            <SplitTransactionModal
                isOpen={splitModalOpen}
                onClose={() => setSplitModalOpen(false)}
                transaction={transactionToSplit}
                onSplitSuccess={() => {
                    queryClient.invalidateQueries(['transactions']);
                }}
            />

            {/* Note Modal */}
            <TransactionNoteModal
                isOpen={noteModalOpen}
                onClose={() => setNoteModalOpen(false)}
                transaction={transactionForNote}
            />

            {/* Create Rule Modal */}
            <CreateRuleModal
                isOpen={ruleModalOpen}
                onClose={() => setRuleModalOpen(false)}
                transaction={transactionForRule}
                buckets={buckets}
            />

            {/* Show empty state if no transactions at all */}
            {!isLoading && transactions.length === 0 ? (
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 py-8">
                    <EmptyState
                        icon={FileText}
                        title="No transactions yet"
                        description="Import your bank statements to start tracking your spending. We support CSV files and PDF statements from most major banks."
                        actionText="Import Data"
                        actionLink="/data-management"
                        secondaryAction={
                            <Button variant="outline" onClick={() => alert("Tip: Use the + button in the bottom right to add transactions manually.")}>
                                Manually Add
                            </Button>
                        }
                    />
                </div>
            ) : (
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-x-auto" >
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
                            <tr>
                                <th className="px-3 py-3 w-12">
                                    <input
                                        type="checkbox"
                                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                        checked={transactions.length > 0 && selectedIds.size === transactions.length}
                                        onChange={toggleSelectAll}
                                    />
                                </th>
                                <SortHeader column="date">Date</SortHeader>
                                <SortHeader column="description">Description</SortHeader>
                                <th className="px-3 py-3 font-semibold text-sm text-slate-600 dark:text-slate-400 relative">
                                    <button
                                        onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
                                        className={`flex items-center gap-1 hover:text-indigo-600 transition ${categoryFilter ? 'text-indigo-600' : ''}`}
                                    >
                                        Category
                                        <ChevronDown size={14} />
                                        {categoryFilter && <span className="w-2 h-2 bg-indigo-500 rounded-full" />}
                                    </button>
                                    {showCategoryDropdown && (
                                        <div className="absolute top-full left-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg py-1 z-20 min-w-[200px] max-h-[300px] overflow-y-auto">
                                            <button
                                                onClick={() => { setCategoryFilter(null); setShowCategoryDropdown(false); }}
                                                className={`w-full px-4 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700 ${!categoryFilter ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600' : ''}`}
                                            >
                                                All Categories
                                            </button>
                                            {sortBucketsByGroup(buckets).map(b => (
                                                <button
                                                    key={b.id}
                                                    onClick={() => { setCategoryFilter(b.id); setShowCategoryDropdown(false); }}
                                                    className={`w-full px-4 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700 ${categoryFilter === b.id ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600' : ''}`}
                                                >
                                                    {b.name}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </th>
                                <th className="px-3 py-3 font-semibold text-sm text-slate-600 dark:text-slate-400 relative">
                                    <button
                                        onClick={() => setShowSpenderDropdown(!showSpenderDropdown)}
                                        className={`flex items-center gap-1 hover:text-indigo-600 transition ${spenderFilter ? 'text-indigo-600' : ''}`}
                                    >
                                        Who?
                                        <ChevronDown size={14} />
                                        {spenderFilter && <span className="w-2 h-2 bg-indigo-500 rounded-full" />}
                                    </button>
                                    {showSpenderDropdown && (
                                        <div className="absolute top-full left-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg py-1 z-20 min-w-[150px]">
                                            <button
                                                onClick={() => { setSpenderFilter(null); setShowSpenderDropdown(false); }}
                                                className={`w-full px-4 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700 ${!spenderFilter ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600' : ''}`}
                                            >
                                                All
                                            </button>
                                            <button
                                                key="Joint"
                                                onClick={() => { setSpenderFilter('Joint'); setShowSpenderDropdown(false); }}
                                                className={`w-full px-4 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700 ${spenderFilter === 'Joint' ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600' : ''}`}
                                            >
                                                Joint
                                            </button>
                                            {members.map(member => (
                                                <button
                                                    key={member.id}
                                                    onClick={() => { setSpenderFilter(member.name); setShowSpenderDropdown(false); }}
                                                    className={`w-full px-4 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2 ${spenderFilter === member.name ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600' : ''}`}
                                                >
                                                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: member.color }}></span>
                                                    {member.name}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </th>
                                <th className="px-3 py-3 font-semibold text-sm text-slate-600 dark:text-slate-400 w-24">Actions</th>
                                <SortHeader column="amount" className="text-right">Amount</SortHeader>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                            {isLoading ? (
                                <tr>
                                    <td colSpan="8" className="p-12 text-center">
                                        <div className="flex flex-col items-center gap-3">
                                            <Loader2 className="animate-spin text-indigo-500" size={32} />
                                            <span className="text-slate-500">Loading transactions...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : transactions.length === 0 ? (
                                <tr>
                                    <td colSpan="8" className="p-8 text-center">
                                        <div className="flex flex-col items-center gap-2">
                                            <Search className="text-slate-400" size={24} />
                                            <span className="text-slate-500 font-medium">No transactions match your search</span>
                                            <button
                                                onClick={() => setSearch('')}
                                                className="text-indigo-500 text-sm hover:text-indigo-600"
                                            >
                                                Clear search
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                transactions.map((txn) => (
                                    <tr key={txn.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition group">
                                        <td className="px-3 py-3">
                                            <input
                                                type="checkbox"
                                                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                                checked={selectedIds.has(txn.id)}
                                                onChange={() => toggleSelect(txn.id)}
                                            />
                                        </td>
                                        <td className="px-3 py-3 text-sm text-slate-800 dark:text-slate-200 font-mono" onClick={() => setEditingCell({ id: txn.id, field: 'date' })}>
                                            {editingCell.id === txn.id && editingCell.field === 'date' ? (
                                                <input
                                                    autoFocus
                                                    type="date"
                                                    defaultValue={txn.date.split('T')[0]}
                                                    onBlur={(e) => {
                                                        if (e.target.value && e.target.value !== txn.date.split('T')[0]) {
                                                            updateMutation.mutate({ id: txn.id, date: e.target.value });
                                                        }
                                                        setEditingCell({ id: null, field: null });
                                                    }}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') e.currentTarget.blur();
                                                        if (e.key === 'Escape') setEditingCell({ id: null, field: null });
                                                    }}
                                                    className="bg-slate-50 dark:bg-slate-700 border-0 rounded px-1 py-0.5 text-xs w-full focus:ring-2 focus:ring-indigo-500"
                                                    onClick={(e) => e.stopPropagation()}
                                                />
                                            ) : (
                                                <span className="cursor-pointer hover:underline decoration-dashed decoration-slate-300 underline-offset-4">
                                                    {new Date(txn.date).toLocaleDateString('en-AU')}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-3 py-3 text-sm text-slate-700 dark:text-slate-300 group/cell max-w-[300px]" onClick={() => setEditingCell({ id: txn.id, field: 'description' })}>
                                            {editingCell.id === txn.id && editingCell.field === 'description' ? (
                                                <input
                                                    autoFocus
                                                    type="text"
                                                    defaultValue={txn.description}
                                                    onBlur={(e) => {
                                                        if (e.target.value !== txn.description) {
                                                            updateMutation.mutate({ id: txn.id, description: e.target.value });
                                                        }
                                                        setEditingCell({ id: null, field: null });
                                                    }}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            e.currentTarget.blur();
                                                        }
                                                        if (e.key === 'Escape') setEditingCell({ id: null, field: null });
                                                    }}
                                                    className="w-full bg-slate-50 dark:bg-slate-700 border-0 rounded px-2 py-1 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 font-medium"
                                                    onClick={(e) => e.stopPropagation()}
                                                />
                                            ) : (
                                                <div className="flex items-center gap-2 cursor-pointer" title={`Original: ${txn.raw_description}`}>
                                                    <span className="font-medium text-slate-900 dark:text-white truncate block hover:underline decoration-dashed decoration-slate-300 underline-offset-4">{txn.description}</span>
                                                    <Pencil size={14} className="text-slate-400 opacity-0 group-hover/cell:opacity-100 transition-opacity flex-shrink-0" />
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-3 py-3">
                                            <select
                                                className="bg-transparent hover:bg-slate-100 dark:hover:bg-slate-600 rounded px-2 py-1 text-sm text-slate-900 dark:text-white border-none focus:ring-2 focus:ring-indigo-500 cursor-pointer max-w-[140px] truncate"
                                                value={txn.bucket_id || ""}
                                                onChange={(e) => updateMutation.mutate({ id: txn.id, bucket_id: parseInt(e.target.value) })}
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <option value="">Uncategorized</option>
                                                {sortBucketsByGroup(buckets).map(b => (
                                                    <option key={b.id} value={b.id}>{b.name}</option>
                                                ))}
                                            </select>
                                        </td>
                                        <td className="px-3 py-3">
                                            <select
                                                className="bg-transparent hover:bg-slate-100 dark:hover:bg-slate-600 rounded px-2 py-1 text-sm text-slate-900 dark:text-white border-none focus:ring-2 focus:ring-indigo-500 cursor-pointer max-w-[100px] truncate"
                                                value={txn.spender || "Joint"}
                                                onChange={(e) => updateMutation.mutate({ id: txn.id, spender: e.target.value })}
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <option value="Joint">Joint</option>
                                                {members.map(member => (
                                                    <option key={member.id} value={member.name}>{member.name}</option>
                                                ))}
                                            </select>
                                        </td>
                                        {/* Actions Cell - Fixed Width */}
                                        <td className="px-3 py-3 w-24">
                                            <div className="flex items-center gap-1">
                                                <button
                                                    onClick={() => { setTransactionToSplit(txn); setSplitModalOpen(true); }}
                                                    className="p-1.5 text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded transition"
                                                    title="Split Transaction"
                                                >
                                                    <Split size={14} />
                                                </button>
                                                <button
                                                    onClick={() => { setTransactionForNote(txn); setNoteModalOpen(true); }}
                                                    className={`p-1.5 rounded transition ${txn.notes ? 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/30' : 'text-slate-400 hover:text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-900/30'}`}
                                                    title={txn.notes || "Add Note"}
                                                >
                                                    <StickyNote size={14} className={txn.notes ? "fill-yellow-600/20" : ""} />
                                                </button>
                                                <button
                                                    onClick={() => { setTransactionForRule(txn); setRuleModalOpen(true); }}
                                                    className="p-1.5 text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded transition"
                                                    title="Create Rule from Transaction"
                                                >
                                                    <BookPlus size={14} />
                                                </button>
                                                {members.length > 0 && (
                                                    <div className="relative">
                                                        <button
                                                            onClick={() => setAssignDropdownId(assignDropdownId === txn.id ? null : txn.id)}
                                                            className={`p-1.5 rounded transition ${txn.assigned_to ? 'text-orange-500 bg-orange-50 dark:bg-orange-900/30' : 'text-slate-400 hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/30'}`}
                                                            title={txn.assigned_to ? `Assigned to ${txn.assigned_to}` : 'Assign for Review'}
                                                        >
                                                            <UserCheck size={14} />
                                                        </button>
                                                        {assignDropdownId === txn.id && (
                                                            <div className="absolute top-full right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg py-1 z-30 min-w-[140px]">
                                                                <button
                                                                    onClick={() => { updateMutation.mutate({ id: txn.id, assigned_to: '' }); setAssignDropdownId(null); }}
                                                                    className="w-full px-3 py-1.5 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400"
                                                                >
                                                                    None
                                                                </button>
                                                                {members.map(member => (
                                                                    <button
                                                                        key={member.id}
                                                                        onClick={() => { updateMutation.mutate({ id: txn.id, assigned_to: member.name }); setAssignDropdownId(null); }}
                                                                        className={`w-full px-3 py-1.5 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2 ${txn.assigned_to === member.name ? 'text-orange-600 font-medium' : ''}`}
                                                                    >
                                                                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: member.color }}></span>
                                                                        {member.name}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td
                                            className={`px-3 py-3 text-sm font-semibold text-right cursor-pointer group/amount`}
                                            onClick={() => setEditingCell({ id: txn.id, field: 'amount' })}
                                        >
                                            {editingCell.id === txn.id && editingCell.field === 'amount' ? (
                                                <input
                                                    autoFocus
                                                    type="number"
                                                    step="0.01"
                                                    defaultValue={Math.abs(txn.amount)}
                                                    onBlur={(e) => {
                                                        const newAmount = parseFloat(e.target.value);
                                                        // Preserve sign (expense vs income)
                                                        const originalSign = txn.amount < 0 ? -1 : 1;
                                                        const finalAmount = Math.abs(newAmount) * originalSign;

                                                        if (finalAmount !== txn.amount && !isNaN(newAmount)) {
                                                            updateMutation.mutate({ id: txn.id, amount: finalAmount });
                                                        }
                                                        setEditingCell({ id: null, field: null });
                                                    }}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') e.currentTarget.blur();
                                                        if (e.key === 'Escape') setEditingCell({ id: null, field: null });
                                                    }}
                                                    className="w-24 bg-slate-50 dark:bg-slate-700 border-0 rounded px-1 py-0.5 text-right text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 text-sm"
                                                    onClick={(e) => e.stopPropagation()}
                                                />
                                            ) : (
                                                <span className={`${txn.amount < 0 ? 'text-slate-900 dark:text-white' : 'text-green-600'} hover:underline decoration-dashed decoration-slate-300 underline-offset-4`}>
                                                    {txn.amount.toFixed(2)}
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            )}
            {/* Sticky Action Bar */}
            {selectedIds.size > 0 && (
                <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-40 flex items-center gap-4 bg-white dark:bg-slate-800 px-6 py-3 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 animate-slide-up">
                    <div className="flex items-center gap-2 border-r border-slate-200 dark:border-slate-700 pr-4">
                        <span className="bg-indigo-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                            {selectedIds.size}
                        </span>
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Selected</span>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Bulk Category */}
                        <div className="relative group">
                            <select
                                onChange={(e) => {
                                    if (e.target.value) {
                                        batchUpdateMutation.mutate({
                                            ids: Array.from(selectedIds),
                                            bucket_id: parseInt(e.target.value)
                                        });
                                        e.target.value = "";
                                    }
                                }}
                                className="appearance-none pl-3 pr-8 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-700 dark:text-slate-200 hover:border-indigo-500 focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
                                disabled={batchUpdateMutation.isPending}
                            >
                                <option value="">In Category...</option>
                                {buckets.map(b => (
                                    <option key={b.id} value={b.id}>{b.name}</option>
                                ))}
                            </select>
                            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        </div>

                        {/* Bulk Spender */}
                        <div className="relative group">
                            <select
                                onChange={(e) => {
                                    if (e.target.value) {
                                        batchUpdateMutation.mutate({
                                            ids: Array.from(selectedIds),
                                            spender: e.target.value
                                        });
                                        e.target.value = "";
                                    }
                                }}
                                className="appearance-none pl-3 pr-8 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-700 dark:text-slate-200 hover:border-indigo-500 focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
                                disabled={batchUpdateMutation.isPending}
                            >
                                <option value="">By Whom...</option>
                                <option value="Joint">Joint</option>
                                {members.map(member => (
                                    <option key={member.id} value={member.name}>{member.name}</option>
                                ))}
                            </select>
                            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        </div>
                    </div>

                    <div className="border-l border-slate-200 dark:border-slate-700 pl-4 flex items-center gap-2">
                        <button
                            onClick={() => setSelectedIds(new Set())}
                            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
                            title="Clear Selection"
                        >
                            <X size={18} />
                        </button>
                        <button
                            onClick={() => {
                                if (window.confirm(`Delete ${selectedIds.size} transactions?`)) {
                                    deleteBatchMutation.mutate(Array.from(selectedIds));
                                }
                            }}
                            className="flex items-center gap-2 px-4 py-2 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/50 transition font-medium text-sm"
                        >
                            <Trash2 size={16} />
                            Delete
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

