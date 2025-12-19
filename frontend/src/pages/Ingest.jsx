import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Listbox, Transition } from '@headlessui/react';
import { UploadCloud, CheckCircle, AlertCircle, FileText, ArrowRight, Pencil, Table, ChevronDown, Check } from 'lucide-react';
import axios from 'axios';


const uploadFile = async ({ file, spender }) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("spender", spender);
    const res = await axios.post("http://localhost:8000/ingest/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" }
    });
    return res.data;
};


export default function Ingest() {
    const [spender, setSpender] = useState("Joint");
    const [file, setFile] = useState(null);
    const [transactions, setTransactions] = useState([]);
    const [editingId, setEditingId] = useState(null); // Track which row is being edited
    const [error, setError] = useState(null);
    const queryClient = useQueryClient();

    // Fetch User Settings for Names
    const { data: userSettings } = useQuery({
        queryKey: ['userSettings'],
        queryFn: async () => (await axios.get('http://localhost:8000/settings/user')).data
    });

    // ... (fetch and mutations) ...

    const handleDescriptionChange = (txnId, newDescription) => {
        setTransactions(prev => prev.map(t =>
            t.id === txnId ? { ...t, description: newDescription } : t
        ));
    };

    const handleCategoryChange = (txnId, newBucketId) => {
        setTransactions(prev => prev.map(t =>
            t.id === txnId ? {
                ...t,
                bucket_id: newBucketId ? parseInt(newBucketId) : null,
                bucket: newBucketId ? buckets.find(b => b.id === parseInt(newBucketId)) : null
            } : t
        ));
    };


    const handleSpenderChange = (txnId, newSpender) => {
        setTransactions(prev => prev.map(t =>
            t.id === txnId ? { ...t, spender: newSpender } : t
        ));
    };

    // ... (render) ...

    // Fetch Buckets
    const { data: buckets = [] } = useQuery({
        queryKey: ['buckets'],
        queryFn: async () => {
            const res = await axios.get('http://localhost:8000/settings/buckets');
            return res.data;
        }
    });

    // State
    const [activeTab, setActiveTab] = useState("pdf"); // pdf | csv
    const [previewData, setPreviewData] = useState(null); // { headers: [], rows: [] }
    const [mapping, setMapping] = useState({ date: "", description: "", amount: "" });

    // Upload Mutation (PDF)
    const uploadMutation = useMutation({
        mutationFn: uploadFile,
        onSuccess: (data) => {
            setTransactions(data);
            setError(null);
        },
        onError: (err) => {
            setError(err.response?.data?.detail || "Upload failed");
            console.error(err);
        }
    });

    // CSV Analyze Mutation
    const analyzeCsvMutation = useMutation({
        mutationFn: async (file) => {
            const formData = new FormData();
            formData.append("file", file);
            const res = await axios.post("http://localhost:8000/ingest/csv/preview", formData);
            return res.data;
        },
        onSuccess: (data) => {
            setPreviewData(data);
            setError(null);
            // Auto-guess mapping
            const headers = data.headers.map(h => h.toLowerCase());
            const newMapping = { ...mapping };

            data.headers.forEach(h => {
                const lower = h.toLowerCase();
                if (lower.includes("date")) newMapping.date = h;
                if (lower.includes("desc") || lower.includes("narrative") || lower.includes("details")) newMapping.description = h;
                if (lower.includes("amount") || lower.includes("debit") || lower.includes("credit") || lower.includes("value")) newMapping.amount = h;
            });
            setMapping(newMapping);
        },
        onError: (err) => setError(err.response?.data?.detail || "CSV Analysis failed")
    });

    // CSV Ingest Mutation
    const ingestCsvMutation = useMutation({
        mutationFn: async () => {
            if (!file) throw new Error("No file selected");
            const formData = new FormData();
            formData.append("file", file);
            formData.append("map_date", mapping.date);
            formData.append("map_desc", mapping.description);
            formData.append("spender", spender);

            if (mapping.mode === 'split') {
                if (mapping.debit) formData.append("map_debit", mapping.debit);
                if (mapping.credit) formData.append("map_credit", mapping.credit);
            } else {
                formData.append("map_amount", mapping.amount);
            }

            const res = await axios.post("http://localhost:8000/ingest/csv", formData);
            return res.data;
        },
        onSuccess: (data) => {
            setTransactions(data);
            setPreviewData(null); // Clear preview to show results
            setError(null);
        },
        onError: (err) => setError(err.response?.data?.detail || "CSV Import failed")
    });

    // ... confirm mutation (unchanged) ...
    const confirmMutation = useMutation({
        mutationFn: async (txns) => {
            const payload = txns.map(t => ({
                id: t.id,
                id: t.id,
                bucket_id: t.bucket_id || t.bucket?.id, // Use bucket_id if manually set, else existing bucket object's id
                is_verified: true,
                spender: t.spender
            }));
            const res = await axios.post('http://localhost:8000/ingest/confirm', payload);
            return res.data;
        },
        onSuccess: () => {
            setFile(null);
            setTransactions([]);
            alert("Transactions confirmed successfully!");
            queryClient.invalidateQueries(['transactions']);
        },
        onError: (err) => {
            setError("Failed to save transactions.");
            console.error(err);
        }
    });

    const handleFileChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
            uploadMutation.mutate({ file: e.target.files[0], spender });
        }
    };

    // ...

    return (
        <div className="max-w-6xl mx-auto p-8 space-y-8">
            {/* Headers and Upload Area (Unchanged) */}
            <header>
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Import Data</h1>
                <p className="text-slate-500 dark:text-slate-400 mt-2">Upload your bank statements (PDF) to automatically extract and categorize transactions.</p>
            </header>

            {/* Tabs */}
            <div className="flex space-x-4 border-b border-slate-200 dark:border-slate-700 pb-1">
                <button
                    onClick={() => { setActiveTab("pdf"); setFile(null); setTransactions([]); setError(null); }}
                    className={`pb-3 px-2 text-sm font-medium transition-colors border-b-2 ${activeTab === "pdf" ? "border-indigo-600 text-indigo-600 dark:text-indigo-400" : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 hover:border-slate-300"}`}
                >
                    <div className="flex items-center gap-2"><FileText size={16} /> PDF Statement</div>
                </button>
                <button
                    onClick={() => { setActiveTab("csv"); setFile(null); setTransactions([]); setError(null); }}
                    className={`pb-3 px-2 text-sm font-medium transition-colors border-b-2 ${activeTab === "csv" ? "border-indigo-600 text-indigo-600 dark:text-indigo-400" : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 hover:border-slate-300"}`}
                >
                    <div className="flex items-center gap-2"><Table size={16} /> CSV Import</div>
                </button>
            </div>

            {/* Upload Area */}
            {!previewData && transactions.length === 0 && (
                <div className={`
                    relative border-2 border-dashed rounded-2xl p-12 text-center transition-colors
                    ${file ? 'border-green-300 bg-green-50 dark:bg-green-900/10' : 'border-slate-300 hover:border-indigo-400 bg-white dark:bg-slate-800'}
                `}>
                    <div className="flex flex-col items-center justify-center space-y-4">
                        {/* Spender Selection */}
                        <div className="mb-4 relative z-10">
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Who does this statement belong to?</label>
                            <Listbox value={spender} onChange={setSpender} disabled={file !== null}>
                                <div className="relative mt-1">
                                    <Listbox.Button className="relative w-full cursor-default rounded-lg bg-slate-50 dark:bg-slate-700 py-2 pl-10 pr-10 text-center border border-slate-200 dark:border-slate-600 focus:outline-none focus-visible:border-indigo-500 focus-visible:ring-2 focus-visible:ring-white/75 focus-visible:ring-offset-2 focus-visible:ring-offset-indigo-300 sm:text-sm text-slate-900 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed">
                                        <span className="block truncate">
                                            {spender === 'Joint' ? 'Joint Account' :
                                                spender === 'User A' ? (userSettings?.name_a || 'User A') :
                                                    (userSettings?.name_b || 'User B')}
                                        </span>
                                        <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                                            <ChevronDown
                                                className="h-5 w-5 text-slate-400"
                                                aria-hidden="true"
                                            />
                                        </span>
                                    </Listbox.Button>
                                    <Transition
                                        as={React.Fragment}
                                        leave="transition ease-in duration-100"
                                        leaveFrom="opacity-100"
                                        leaveTo="opacity-0"
                                    >
                                        <Listbox.Options className="absolute mt-1 max-h-60 w-full overflow-auto rounded-md bg-white dark:bg-slate-700 py-1 text-base shadow-lg ring-1 ring-black/5 focus:outline-none sm:text-sm z-50 text-center">
                                            {[
                                                { id: 'Joint', name: 'Joint Account' },
                                                { id: 'User A', name: userSettings?.name_a || 'User A' },
                                                { id: 'User B', name: userSettings?.name_b || 'User B' }
                                            ].map((person, personIdx) => (
                                                <Listbox.Option
                                                    key={personIdx}
                                                    className={({ active }) =>
                                                        `relative cursor-default select-none py-2 pl-10 pr-10 ${active ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-900 dark:text-indigo-100' : 'text-slate-900 dark:text-slate-100'
                                                        }`
                                                    }
                                                    value={person.id}
                                                >
                                                    {({ selected }) => (
                                                        <>
                                                            <span className={`block truncate ${selected ? 'font-medium' : 'font-normal'}`}>
                                                                {person.name}
                                                            </span>
                                                            {selected ? (
                                                                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-indigo-600 dark:text-indigo-400">
                                                                    <Check className="h-5 w-5" aria-hidden="true" />
                                                                </span>
                                                            ) : null}
                                                        </>
                                                    )}
                                                </Listbox.Option>
                                            ))}
                                        </Listbox.Options>
                                    </Transition>
                                </div>
                            </Listbox>
                        </div>

                        <div className="p-4 bg-indigo-50 dark:bg-slate-700 rounded-full text-indigo-600 dark:text-indigo-400">
                            {(uploadMutation.isPending || analyzeCsvMutation.isPending) ?
                                <div className="animate-spin h-8 w-8 border-2 border-indigo-600 rounded-full border-t-transparent" /> :
                                <UploadCloud size={32} />
                            }
                        </div>

                        <div className="space-y-1">
                            <h3 className="text-lg font-medium text-slate-900 dark:text-white">
                                {file ? file.name : "Click to upload or drag and drop"}
                            </h3>
                            <p className="text-sm text-slate-500">
                                {activeTab === 'pdf' ? "PDF Bank Statements only" : "CSV files only"}
                            </p>
                        </div>

                        <input
                            type="file"
                            accept={activeTab === 'pdf' ? ".pdf" : ".csv"}
                            onChange={(e) => {
                                if (e.target.files && e.target.files[0]) {
                                    setFile(e.target.files[0]);
                                    if (activeTab === 'pdf') {
                                        uploadMutation.mutate({ file: e.target.files[0], spender });
                                    } else {
                                        analyzeCsvMutation.mutate(e.target.files[0]);
                                    }
                                }
                            }}
                            className="opacity-0 absolute inset-0 cursor-pointer w-full h-64"
                            style={{ height: '300px', width: '100%', maxWidth: '800px', margin: '0 auto', display: file ? 'none' : 'block' }}
                        />

                        {file && !(uploadMutation.isPending || analyzeCsvMutation.isPending) && (
                            <button
                                onClick={() => { setFile(null); setTransactions([]); setPreviewData(null); }}
                                className="text-sm text-slate-400 hover:text-red-500 underline z-10 relative"
                            >
                                Remove and try another
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* CSV Mapping Wizard */}
            {activeTab === 'csv' && previewData && (
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 animate-in fade-in slide-in-from-bottom-4">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Map CSV Columns</h3>

                    <div className="flex items-center gap-2 mb-4">
                        <label className="text-sm font-medium text-slate-600 dark:text-slate-300">Amount Column Mode:</label>
                        <div className="flex bg-slate-100 dark:bg-slate-700 rounded-lg p-1">
                            <button
                                onClick={() => setMapping(prev => ({ ...prev, mode: "single" }))}
                                className={`px-3 py-1 text-xs font-semibold rounded-md transition ${mapping.mode !== 'split' ? 'bg-white dark:bg-slate-600 shadow text-indigo-600 dark:text-indigo-300' : 'text-slate-500'}`}
                            >
                                Single Column
                            </button>
                            <button
                                onClick={() => setMapping(prev => ({ ...prev, mode: "split" }))}
                                className={`px-3 py-1 text-xs font-semibold rounded-md transition ${mapping.mode === 'split' ? 'bg-white dark:bg-slate-600 shadow text-indigo-600 dark:text-indigo-300' : 'text-slate-500'}`}
                            >
                                Debit / Credit
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-1">Date Column</label>
                            <select
                                className="w-full px-2 py-2 border rounded-lg dark:bg-slate-700 dark:border-slate-600 dark:text-white text-sm"
                                value={mapping.date}
                                onChange={(e) => setMapping({ ...mapping, date: e.target.value })}
                            >
                                <option value="">Select Column...</option>
                                {previewData.headers.map(h => <option key={h} value={h}>{h}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-1">Description Column</label>
                            <select
                                className="w-full px-2 py-2 border rounded-lg dark:bg-slate-700 dark:border-slate-600 dark:text-white text-sm"
                                value={mapping.description}
                                onChange={(e) => setMapping({ ...mapping, description: e.target.value })}
                            >
                                <option value="">Select Column...</option>
                                {previewData.headers.map(h => <option key={h} value={h}>{h}</option>)}
                            </select>
                        </div>

                        {mapping.mode === 'split' ? (
                            <div className="contents">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 mb-1">Debit Column</label>
                                    <select
                                        className="w-full px-2 py-2 border rounded-lg dark:bg-slate-700 dark:border-slate-600 dark:text-white text-sm"
                                        value={mapping.debit || ""}
                                        onChange={(e) => setMapping({ ...mapping, debit: e.target.value })}
                                    >
                                        <option value="">Select Column...</option>
                                        {previewData.headers.map(h => <option key={h} value={h}>{h}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 mb-1">Credit Column</label>
                                    <select
                                        className="w-full px-2 py-2 border rounded-lg dark:bg-slate-700 dark:border-slate-600 dark:text-white text-sm"
                                        value={mapping.credit || ""}
                                        onChange={(e) => setMapping({ ...mapping, credit: e.target.value })}
                                    >
                                        <option value="">Select Column...</option>
                                        {previewData.headers.map(h => <option key={h} value={h}>{h}</option>)}
                                    </select>
                                </div>
                            </div>
                        ) : (
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 mb-1">Amount Column</label>
                                <select
                                    className="w-full px-2 py-2 border rounded-lg dark:bg-slate-700 dark:border-slate-600 dark:text-white text-sm"
                                    value={mapping.amount}
                                    onChange={(e) => setMapping({ ...mapping, amount: e.target.value })}
                                >
                                    <option value="">Select Column...</option>
                                    {previewData.headers.map(h => <option key={h} value={h}>{h}</option>)}
                                </select>
                            </div>
                        )}
                    </div>

                    <div className="border rounded-lg overflow-hidden mb-6">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500">
                                <tr>
                                    {previewData.headers.map(h => <th key={h} className="p-3 font-medium">{h}</th>)}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                {previewData.rows.slice(0, 5).map((row, i) => (
                                    <tr key={i}>
                                        {previewData.headers.map(h => <td key={h} className="p-3 text-slate-700 dark:text-slate-300">{row[h]}</td>)}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="flex justify-end gap-3">
                        <button
                            onClick={() => { setFile(null); setPreviewData(null); }}
                            className="px-4 py-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 font-medium"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={() => ingestCsvMutation.mutate()}
                            disabled={!mapping.date || !mapping.description || (mapping.mode === 'split' ? (!mapping.debit && !mapping.credit) : !mapping.amount) || ingestCsvMutation.isPending}
                            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium flex items-center gap-2 disabled:opacity-50"
                        >
                            {ingestCsvMutation.isPending ? "Importing..." : "Run Import"}
                            <ArrowRight size={16} />
                        </button>
                    </div>
                </div>
            )}

            {/* Error Message */}
            {error && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 rounded-lg flex items-center gap-2">
                    <AlertCircle size={18} />
                    <span>{error}</span>
                </div>
            )}

            {/* Transaction Review Table */}
            {transactions.length > 0 && (
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                            <CheckCircle className="text-green-500" size={20} />
                            Review Extracted Data ({transactions.length})
                        </h2>
                        <button
                            onClick={() => confirmMutation.mutate(transactions)}
                            disabled={confirmMutation.isPending}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg font-medium transition flex items-center gap-2 disabled:opacity-50"
                        >
                            {confirmMutation.isPending ? "Saving..." : "Confirm & Save"}
                            <ArrowRight size={18} />
                        </button>
                    </div>

                    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
                                <tr>
                                    <th className="p-4 font-semibold text-sm text-slate-600 dark:text-slate-400">Date</th>
                                    <th className="p-4 font-semibold text-sm text-slate-600 dark:text-slate-400">Description</th>
                                    <th className="p-4 font-semibold text-sm text-slate-600 dark:text-slate-400">Category</th>
                                    <th className="p-4 font-semibold text-sm text-slate-600 dark:text-slate-400">Spender</th>
                                    <th className="p-4 font-semibold text-sm text-slate-600 dark:text-slate-400 text-right">Amount</th>
                                    <th className="p-4 font-semibold text-sm text-slate-600 dark:text-slate-400">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                {transactions.map((txn, idx) => (
                                    <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition">
                                        <td className="p-4 text-sm text-slate-800 dark:text-slate-200 font-mono">
                                            {new Date(txn.date).toLocaleDateString('en-AU')}
                                        </td>
                                        <td className="p-4 text-sm text-slate-700 dark:text-slate-300 group/cell cursor-pointer" onClick={() => setEditingId(txn.id)} title={`Original: ${txn.raw_description}`}>
                                            {editingId === txn.id ? (
                                                <input
                                                    autoFocus
                                                    type="text"
                                                    value={txn.description}
                                                    onChange={(e) => handleDescriptionChange(txn.id, e.target.value)}
                                                    onBlur={() => setEditingId(null)}
                                                    onKeyDown={(e) => e.key === 'Enter' && setEditingId(null)}
                                                    className="w-full bg-slate-50 dark:bg-slate-700 border-0 rounded px-2 py-1 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                                                    onClick={(e) => e.stopPropagation()} // Prevent re-triggering parent click
                                                />
                                            ) : (
                                                <div className="flex items-center gap-2">
                                                    <span className="font-medium text-slate-900 dark:text-white">{txn.description}</span>
                                                    <Pencil size={14} className="text-slate-400 opacity-0 group-hover/cell:opacity-100 transition-opacity" />
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-4">
                                            <select
                                                className="bg-slate-50 dark:bg-slate-700 border-0 rounded-md text-sm text-slate-900 dark:text-white ring-1 ring-slate-200 dark:ring-slate-600 focus:ring-2 focus:ring-indigo-500 py-1 pl-2 pr-8"
                                                value={txn.bucket_id || txn.bucket?.id || ""}
                                                onChange={(e) => handleCategoryChange(txn.id, e.target.value)}
                                            >
                                                <option value="">Uncategorized</option>
                                                {buckets.map(b => (
                                                    <option key={b.id} value={b.id}>
                                                        {b.name}
                                                    </option>
                                                ))}
                                            </select>
                                        </td>
                                        <td className="p-4">
                                            <select
                                                className="bg-slate-50 dark:bg-slate-700 border-0 rounded-md text-sm text-slate-900 dark:text-white ring-1 ring-slate-200 dark:ring-slate-600 focus:ring-2 focus:ring-indigo-500 py-1 pl-2 pr-8"
                                                value={txn.spender || "Joint"}
                                                onChange={(e) => handleSpenderChange(txn.id, e.target.value)}
                                            >
                                                <option value="Joint">Joint</option>
                                                <option value="User A">{userSettings?.name_a || "User A"}</option>
                                                <option value="User B">{userSettings?.name_b || "User B"}</option>
                                            </select>
                                        </td>
                                        <td className={`p-4 text-sm font-semibold text-right ${txn.amount < 0 ? 'text-slate-900 dark:text-white' : 'text-green-600'}`}>
                                            {txn.amount.toFixed(2)}
                                        </td>
                                        <td className="p-4">
                                            {txn.category_confidence > 0.8 ? (
                                                <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                                    Auto-Matched
                                                </span>
                                            ) : (
                                                <span className="px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
                                                    Review
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
