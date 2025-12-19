import { Dialog, Transition } from '@headlessui/react'
import { Fragment, useState } from 'react'
import axios from 'axios'
import { X } from 'lucide-react'

export default function CheckInModal({ isOpen, onClose, accounts, onSuccess }) {
    const [date, setDate] = useState(new Date().toISOString().split('T')[0])
    const [balances, setBalances] = useState({})
    const [isSubmitting, setIsSubmitting] = useState(false)

    const handleBalanceChange = (accountId, value) => {
        setBalances(prev => ({
            ...prev,
            [accountId]: value
        }))
    }

    // Calculate totals for preview
    const totalAssets = accounts
        .filter(a => a.type === 'Asset')
        .reduce((sum, a) => sum + (parseFloat(balances[a.id]) || 0), 0)

    const totalLiabilities = accounts
        .filter(a => a.type === 'Liability')
        .reduce((sum, a) => sum + (parseFloat(balances[a.id]) || 0), 0)

    const netWorth = totalAssets - totalLiabilities

    const handleSubmit = async (e) => {
        e.preventDefault()
        setIsSubmitting(true)
        try {
            const payload = {
                date,
                balances: Object.entries(balances).map(([accId, val]) => ({
                    account_id: parseInt(accId),
                    balance: parseFloat(val) || 0
                }))
            }

            await axios.post('http://localhost:8000/net-worth/snapshot', payload)
            onSuccess()
            onClose()
            // Reset form?
            setBalances({})
        } catch (error) {
            console.error("Failed to submit snapshot", error)
            alert("Failed to save snapshot")
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <Transition appear show={isOpen} as={Fragment}>
            <Dialog as="div" className="relative z-50" onClose={onClose}>
                <Transition.Child
                    as={Fragment}
                    enter="ease-out duration-300"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in duration-200"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <div className="fixed inset-0 bg-black/25" />
                </Transition.Child>

                <div className="fixed inset-0 overflow-y-auto">
                    <div className="flex min-h-full items-center justify-center p-4 text-center">
                        <Transition.Child
                            as={Fragment}
                            enter="ease-out duration-300"
                            enterFrom="opacity-0 scale-95"
                            enterTo="opacity-100 scale-100"
                            leave="ease-in duration-200"
                            leaveFrom="opacity-100 scale-100"
                            leaveTo="opacity-0 scale-95"
                        >
                            <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-2xl bg-white dark:bg-slate-800 p-6 text-left align-middle shadow-xl transition-all border border-slate-200 dark:border-slate-700">
                                <Dialog.Title
                                    as="h3"
                                    className="text-lg font-bold leading-6 text-slate-900 dark:text-white flex justify-between items-center mb-6"
                                >
                                    Monthly Check-in
                                    <button onClick={onClose} className="text-slate-400 hover:text-slate-500">
                                        <X size={20} />
                                    </button>
                                </Dialog.Title>

                                <form onSubmit={handleSubmit} className="space-y-6">
                                    {/* Date Selection */}
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Check-in Date</label>
                                        <input
                                            type="date"
                                            required
                                            value={date}
                                            onChange={(e) => setDate(e.target.value)}
                                            className="w-full rounded-lg border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                        />
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        {/* Assets Column */}
                                        <div className="space-y-4">
                                            <h4 className="font-semibold text-emerald-600 border-b border-emerald-100 pb-2">Assets</h4>
                                            {accounts.filter(a => a.type === 'Asset').map(account => (
                                                <div key={account.id}>
                                                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">{account.name}</label>
                                                    <div className="relative">
                                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            placeholder="0.00"
                                                            className="pl-7 w-full rounded-lg border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900/50 text-slate-900 dark:text-white text-sm"
                                                            value={balances[account.id] || ''}
                                                            onChange={(e) => handleBalanceChange(account.id, e.target.value)}
                                                        />
                                                    </div>
                                                </div>
                                            ))}
                                            {accounts.filter(a => a.type === 'Asset').length === 0 && (
                                                <p className="text-sm text-slate-400 italic">No assets configured.</p>
                                            )}
                                        </div>

                                        {/* Liabilities Column */}
                                        <div className="space-y-4">
                                            <h4 className="font-semibold text-red-600 border-b border-red-100 pb-2">Liabilities</h4>
                                            {accounts.filter(a => a.type === 'Liability').map(account => (
                                                <div key={account.id}>
                                                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">{account.name}</label>
                                                    <div className="relative">
                                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            placeholder="0.00"
                                                            className="pl-7 w-full rounded-lg border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900/50 text-slate-900 dark:text-white text-sm"
                                                            value={balances[account.id] || ''}
                                                            onChange={(e) => handleBalanceChange(account.id, e.target.value)}
                                                        />
                                                    </div>
                                                </div>
                                            ))}
                                            {accounts.filter(a => a.type === 'Liability').length === 0 && (
                                                <p className="text-sm text-slate-400 italic">No liabilities configured.</p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Summary Footer */}
                                    <div className="bg-slate-50 dark:bg-slate-700/50 p-4 rounded-xl flex justify-between items-center text-sm">
                                        <div>
                                            <span className="text-slate-500 dark:text-slate-400 block">Total Assets</span>
                                            <span className="font-bold text-emerald-600">${totalAssets.toLocaleString()}</span>
                                        </div>
                                        <div className="text-2xl font-bold text-slate-300">−</div>
                                        <div>
                                            <span className="text-slate-500 dark:text-slate-400 block">Total Liabilities</span>
                                            <span className="font-bold text-red-600">${totalLiabilities.toLocaleString()}</span>
                                        </div>
                                        <div className="text-2xl font-bold text-slate-300">=</div>
                                        <div className="text-right">
                                            <span className="text-slate-500 dark:text-slate-400 block">Net Worth</span>
                                            <span className={`font-bold text-lg ${netWorth >= 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-red-600'}`}>
                                                ${netWorth.toLocaleString()}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="mt-4 flex justify-end gap-3">
                                        <button
                                            type="button"
                                            className="inline-flex justify-center rounded-lg border border-transparent bg-slate-100 dark:bg-slate-700 px-4 py-2 text-sm font-medium text-slate-900 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 focus:outline-none"
                                            onClick={onClose}
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={isSubmitting}
                                            className="inline-flex justify-center rounded-lg border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
                                        >
                                            {isSubmitting ? 'Saving...' : 'Save Snapshot'}
                                        </button>
                                    </div>
                                </form>
                            </Dialog.Panel>
                        </Transition.Child>
                    </div>
                </div>
            </Dialog>
        </Transition>
    )
}
