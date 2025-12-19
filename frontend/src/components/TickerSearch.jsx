import React, { useState, useEffect } from 'react';
import { Combobox } from '@headlessui/react';
import { Search, Loader2, TrendingUp, Info } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import * as api from '../services/api';

const TickerSearch = ({ value, onChange, onSelect }) => {
    const [query, setQuery] = useState('');
    const [selected, setSelected] = useState(null);

    // Debounce query
    const [debouncedQuery, setDebouncedQuery] = useState('');
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedQuery(query), 500);
        return () => clearTimeout(timer);
    }, [query]);

    // Fetch Results
    const { data: results = [], isLoading } = useQuery({
        queryKey: ['tickerSearch', debouncedQuery],
        queryFn: () => api.searchTicker(debouncedQuery),
        enabled: debouncedQuery.length > 0,
        staleTime: 1000 * 60 * 5, // Cache for 5 mins
    });

    // Handle Selection
    const handleSelect = async (item) => {
        if (!item) return;
        setSelected(item);
        onChange(item.symbol); // Update basic input value

        // Fetch full quote details
        try {
            const quote = await api.getQuote(item.symbol);
            if (onSelect) {
                onSelect({
                    ticker: item.symbol,
                    name: item.shortname,
                    price: quote.price,
                    currency: quote.currency,
                    exchange_rate: quote.exchange_rate
                });
            }
        } catch (err) {
            console.error("Failed to fetch quote", err);
            // Fallback: just set symbol/name
            if (onSelect) {
                onSelect({ ticker: item.symbol, name: item.shortname });
            }
        }
    };

    return (
        <div className="relative">
            <Combobox value={selected} onChange={handleSelect} nullable>
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
                        <Search size={16} />
                    </div>
                    <Combobox.Input
                        className="w-full rounded-lg border-0 py-2 pl-9 pr-3 text-sm focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-700 shadow-sm"
                        placeholder="Search ticker (e.g. AAPL, BMW.DE)"
                        displayValue={(v) => value || v?.symbol || ''}
                        onChange={(event) => {
                            setQuery(event.target.value);
                            onChange(event.target.value);
                        }}
                    />
                    {isLoading && (
                        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-indigo-500">
                            <Loader2 size={16} className="animate-spin" />
                        </div>
                    )}
                </div>

                {results.length > 0 && (
                    <Combobox.Options className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white dark:bg-slate-800 py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
                        {results.map((item) => (
                            <Combobox.Option
                                key={item.symbol}
                                value={item}
                                className={({ active }) =>
                                    `relative cursor-default select-none py-2 pl-4 pr-4 ${active ? 'bg-indigo-600 text-white' : 'text-slate-900 dark:text-slate-200'
                                    }`
                                }
                            >
                                {({ selected, active }) => (
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <span className={`block truncate font-bold ${selected ? 'font-medium' : 'font-normal'}`}>
                                                {item.symbol}
                                            </span>
                                            <span className={`block truncate text-xs ${active ? 'text-indigo-200' : 'text-slate-500 dark:text-slate-400'}`}>
                                                {item.shortname}
                                            </span>
                                        </div>
                                        <div className="text-right">
                                            <span className={`block text-xs uppercase ${active ? 'text-indigo-200' : 'text-slate-400'}`}>
                                                {item.exchange}
                                            </span>
                                            <span className={`block text-[10px] uppercase ${active ? 'text-indigo-200' : 'text-slate-400'}`}>
                                                {item.type}
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </Combobox.Option>
                        ))}
                    </Combobox.Options>
                )}
            </Combobox>
        </div>
    );
};

export default TickerSearch;
