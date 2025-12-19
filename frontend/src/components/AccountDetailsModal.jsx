import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog } from '@headlessui/react';
import { X, Plus, Trash2, Pencil, Save } from 'lucide-react';
import * as api from '../services/api';
import TickerSearch from './TickerSearch';

const AccountDetailsModal = ({ isOpen, onClose, account }) => {
    const queryClient = useQueryClient();
    const [isAdding, setIsAdding] = useState(false);
    const [editingId, setEditingId] = useState(null);

    // Form States
    const [formData, setFormData] = useState({
        ticker: '',
        name: '',
        quantity: 0,
        price: 0,
        cost_basis: 0,
        currency: 'USD',
        exchange_rate: 1.0
    });

    const isInvestment = account?.category === 'Investment';

    // Fetch Holdings
    const { data: holdings = [], isLoading, refetch } = useQuery({
        queryKey: ['holdings', account?.id],
        queryFn: () => api.getHoldings(account.id),
        enabled: !!account && isOpen
    });

    // Mutations
    const queryKey = ['holdings', account?.id];

    // Mutations

    const createMutation = useMutation({
        mutationFn: (data) => api.createHolding(account.id, data),
        onSuccess: () => {
            refetch(); // Direct refetch to ensure UI updates
            queryClient.invalidateQueries({ queryKey: ['holdings', account.id] });
            setIsAdding(false);
            resetForm();
        },
        onError: (err) => {
            console.error("Create holding failed", err);
        }
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }) => api.updateHolding(id, data),
        onSuccess: () => {
            refetch();
            queryClient.invalidateQueries({ queryKey: ['holdings', account.id] });
            setEditingId(null);
            resetForm();
        },
        onError: (err) => {
            console.error("Update holding failed", err);
        }
    });

    const deleteMutation = useMutation({
        mutationFn: (id) => api.deleteHolding(id),
        onSuccess: () => {
            refetch();
            queryClient.invalidateQueries({ queryKey: ['holdings', account.id] });
        },
        onError: (err) => {
            console.error("Delete holding failed", err);
        }
    });

    const resetForm = () => {
        setFormData({ ticker: '', name: '', quantity: 0, price: 0, cost_basis: 0, currency: 'USD', exchange_rate: 1.0 });
    };

    const handleSave = async (e) => {
        e.preventDefault();
        const payload = {
            ...formData,
            quantity: parseFloat(formData.quantity),
            price: parseFloat(formData.price),
            cost_basis: parseFloat(formData.cost_basis) || 0,
            exchange_rate: parseFloat(formData.exchange_rate)
        };

        if (editingId) {
            updateMutation.mutate({ id: editingId, data: payload });
        } else {
            createMutation.mutate(payload);
        }
    };

    const startEdit = (holding) => {
        setEditingId(holding.id);
        const rate = holding.exchange_rate || 1.0;
        setFormData({
            ticker: holding.ticker,
            name: holding.name,
            quantity: holding.quantity,
            price: holding.price,
            cost_basis: holding.cost_basis || 0,
            currency: holding.currency || 'USD',
            exchange_rate: rate
        });
        setIsAdding(true);
    };

    if (!isOpen || !account) return null;

    return (
        <Dialog open={isOpen} onClose={onClose} className="relative z-50">
            <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" aria-hidden="true" />
            <div className="fixed inset-0 flex items-center justify-center p-4">
                <Dialog.Panel className="w-full max-w-4xl bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 flex flex-col max-h-[90vh]">
                    {/* Header */}
                    <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-start">
                        <div>
                            <Dialog.Title className="text-xl font-bold text-slate-900 dark:text-white">
                                {account.name}
                            </Dialog.Title>
                            <p className="text-sm text-slate-500 dark:text-slate-400">{account.category} Details</p>
                        </div>
                        <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition">
                            <X size={20} className="text-slate-500" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-auto p-6">
                        {!isInvestment ? (
                            <div className="text-center text-slate-500 py-12">
                                <p>Detailed holdings are currently available for Investment accounts only.</p>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                <div className="flex justify-between items-center">
                                    <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">Holdings</h3>
                                    {!isAdding && (
                                        <button
                                            onClick={() => { setIsAdding(true); resetForm(); setEditingId(null); }}
                                            className="flex items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-700 bg-indigo-50 dark:bg-indigo-900/20 px-3 py-1.5 rounded-lg transition"
                                        >
                                            <Plus size={16} />
                                            Add Holding
                                        </button>
                                    )}
                                </div>

                                {isAdding && (
                                    <form onSubmit={handleSave} className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700 grid grid-cols-1 md:grid-cols-8 gap-4 items-end animate-in fade-in slide-in-from-top-2">
                                        <div className="md:col-span-2">
                                            <label className="text-xs font-bold text-slate-500 uppercase">Ticker</label>
                                            <TickerSearch
                                                data-testid="ticker-search"
                                                value={formData.ticker}
                                                onChange={(val) => setFormData(prev => ({ ...prev, ticker: val }))}
                                                onSelect={(data) => {
                                                    setFormData(prev => ({
                                                        ...prev,
                                                        ticker: data.ticker,
                                                        name: data.name || prev.name,
                                                        price: data.price || prev.price,
                                                        currency: data.currency || prev.currency,
                                                        exchange_rate: data.exchange_rate || prev.exchange_rate
                                                    }));
                                                }}
                                            />
                                        </div>
                                        <div className="md:col-span-2">
                                            <label className="text-xs font-bold text-slate-500 uppercase">Name</label>
                                            <input
                                                data-testid="holding-name-input"
                                                className="w-full mt-1 px-3 py-2 rounded-lg border-0 text-sm bg-slate-100 dark:bg-slate-700 text-slate-500 cursor-not-allowed"
                                                placeholder="Apple Inc."
                                                value={formData.name}
                                                readOnly
                                            />
                                        </div>
                                        <div className="md:col-span-1">
                                            <label className="text-xs font-bold text-slate-500 uppercase">Qty</label>
                                            <input
                                                data-testid="holding-qty-input"
                                                type="number" step="any"
                                                className="w-full mt-1 px-3 py-2 rounded-lg border-0 text-sm focus:ring-2 focus:ring-indigo-500"
                                                value={formData.quantity}
                                                onChange={e => setFormData({ ...formData, quantity: e.target.value })}
                                                required
                                            />
                                        </div>
                                        <div className="md:col-span-1">
                                            <label className="text-xs font-bold text-slate-500 uppercase">Price</label>
                                            <input
                                                data-testid="holding-price-input"
                                                type="number" step="0.01"
                                                className="w-full mt-1 px-3 py-2 rounded-lg border-0 text-sm bg-slate-100 dark:bg-slate-700 text-slate-500 cursor-not-allowed"
                                                value={formData.price}
                                                readOnly
                                            />
                                        </div>
                                        <div className="md:col-span-1">
                                            <label className="text-xs font-bold text-slate-500 uppercase">Currency</label>
                                            <input
                                                data-testid="holding-currency-input"
                                                className="w-full mt-1 px-3 py-2 rounded-lg border-0 text-sm bg-slate-100 dark:bg-slate-700 text-slate-500 cursor-not-allowed"
                                                value={formData.currency}
                                                readOnly
                                            />
                                        </div>

                                        {/* Hidden Exchange Rate Field for State */}
                                        <input type="hidden" value={formData.exchange_rate} />

                                        <div className="md:col-span-1 flex gap-2">
                                            <button type="submit" data-testid="save-holding-btn" className="flex-1 bg-indigo-600 text-white rounded-lg py-2 flex justify-center items-center hover:bg-indigo-700">
                                                <Save size={18} />
                                            </button>
                                            <button type="button" onClick={() => { setIsAdding(false); setEditingId(null); }} className="px-3 bg-white dark:bg-slate-700 text-slate-500 rounded-lg hover:text-slate-700 border border-slate-200 dark:border-slate-600">
                                                <X size={18} />
                                            </button>
                                        </div>
                                    </form>
                                )}

                                {isLoading ? (
                                    <div className="text-center py-8 text-slate-500">Loading holdings...</div>
                                ) : holdings.length === 0 ? (
                                    <div className="text-center py-12 border-2 border-dashed border-slate-100 dark:border-slate-700 rounded-xl">
                                        <p className="text-slate-400">No holdings tracked.</p>
                                    </div>
                                ) : (
                                    <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
                                        <table className="w-full text-sm text-left">
                                            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 border-b border-slate-200 dark:border-slate-700">
                                                <tr>
                                                    <th className="px-4 py-3 font-bold">Ticker</th>
                                                    <th className="px-4 py-3 font-bold">Name</th>
                                                    <th className="px-4 py-3 font-bold text-right">Quantity</th>
                                                    <th className="px-4 py-3 font-bold text-right">Price (Native)</th>
                                                    <th className="px-4 py-3 font-bold text-right">Sys. Value (USD)</th>
                                                    <th className="px-4 py-3 font-bold text-right">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                                {holdings.map(h => (
                                                    <tr key={h.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                                                        <td className="px-4 py-3 font-bold text-slate-700 dark:text-slate-200">{h.ticker}</td>
                                                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{h.name}</td>
                                                        <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-400">{h.quantity}</td>
                                                        <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-400">
                                                            {h.currency} {h.price.toFixed(2)}
                                                        </td>
                                                        <td className="px-4 py-3 text-right font-bold text-slate-900 dark:text-white">${h.value.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                                        <td className="px-4 py-3 text-right">
                                                            <div className="flex justify-end gap-2">
                                                                <button onClick={() => startEdit(h)} className="p-1 text-slate-400 hover:text-indigo-600 transition"><Pencil size={14} /></button>
                                                                <button onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(h.id); }} className="p-1 text-slate-400 hover:text-red-600 transition"><Trash2 size={14} /></button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                                <tr className="bg-slate-50 dark:bg-slate-800/20 font-bold text-slate-900 dark:text-white">
                                                    <td colSpan={4} className="px-4 py-3 text-right">Total Net Value</td>
                                                    <td className="px-4 py-3 text-right">${holdings.reduce((sum, h) => sum + h.value, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                                    <td></td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </Dialog.Panel>
            </div>
        </Dialog>
    );
};

export default AccountDetailsModal;
