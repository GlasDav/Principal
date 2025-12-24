/**
 * AI-Powered Feature Tour Component
 * 
 * Provides contextual tips and guided tours based on:
 * - Current page/context
 * - User's data state (has transactions, budgets, etc.)
 * - AI-generated personalized recommendations
 */
import React, { useState, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { X, Lightbulb, ChevronRight, ChevronLeft, Sparkles, HelpCircle } from 'lucide-react';
import { chatWithAI } from '../services/api';

// Tour steps for different pages
const TOUR_CONTENT = {
    dashboard: {
        title: "Dashboard Overview",
        tips: [
            { target: "summary-cards", title: "Quick Stats", description: "See your income, expenses, and savings at a glance." },
            { target: "spending-chart", title: "Spending Trends", description: "Track how your spending changes over time." },
            { target: "ai-chat", title: "AI Assistant", description: "Click the chat bubble to ask questions about your finances." }
        ]
    },
    transactions: {
        title: "Managing Transactions",
        tips: [
            { target: "filters", title: "Smart Filtering", description: "Use filters to find specific transactions quickly." },
            { target: "categorize", title: "AI Categorization", description: "Uncategorized transactions can be auto-categorized using AI." },
            { target: "bulk-actions", title: "Bulk Actions", description: "Select multiple transactions to categorize or delete at once." }
        ]
    },
    budget: {
        title: "Budget Planning",
        tips: [
            { target: "categories", title: "Budget Categories", description: "Set spending limits for each category." },
            { target: "progress", title: "Progress Tracking", description: "See how much of your budget you've used." },
            { target: "rollover", title: "Rollover Budgets", description: "Enable rollover to carry unused budget to next month." }
        ]
    },
    insights: {
        title: "AI-Powered Insights",
        tips: [
            { target: "savings", title: "Savings Opportunities", description: "AI-detected ways to reduce your spending." },
            { target: "anomalies", title: "Spending Anomalies", description: "Unusual transactions that may need attention." },
            { target: "ai-chat", title: "Ask Questions", description: "Use the chat to get personalized financial advice." }
        ]
    }
};

// Component to show floating help button
export function FeatureTourButton({ page, onStartTour }) {
    const [showTooltip, setShowTooltip] = useState(false);

    const hasSeenTour = localStorage.getItem(`tour_${page}_seen`);

    if (hasSeenTour) return null;

    return (
        <div className="fixed bottom-24 right-6 z-40">
            <button
                onClick={onStartTour}
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
                className="relative p-3 bg-amber-500 hover:bg-amber-600 text-white rounded-full shadow-lg transition-all hover:scale-105"
            >
                <Sparkles className="w-5 h-5" />

                {/* Pulse animation */}
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-ping" />
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full" />
            </button>

            {showTooltip && (
                <div className="absolute bottom-full right-0 mb-2 px-3 py-2 bg-slate-900 text-white text-sm rounded-lg whitespace-nowrap">
                    Take a quick tour!
                </div>
            )}
        </div>
    );
}

// Main tour modal
export function FeatureTour({ page, isOpen, onClose }) {
    const [currentStep, setCurrentStep] = useState(0);
    const [aiTip, setAiTip] = useState(null);
    const [loadingAiTip, setLoadingAiTip] = useState(false);

    const tourContent = TOUR_CONTENT[page] || TOUR_CONTENT.dashboard;
    const steps = tourContent.tips;
    const currentTip = steps[currentStep];

    // Fetch AI-generated tip for current context
    const fetchAiTip = useMutation({
        mutationFn: chatWithAI,
        onSuccess: (data) => {
            setAiTip(data.answer);
            setLoadingAiTip(false);
        },
        onError: () => {
            setLoadingAiTip(false);
        }
    });

    const handleGetAiTip = () => {
        setLoadingAiTip(true);
        fetchAiTip.mutate(`Give me one quick helpful tip about ${currentTip.title.toLowerCase()} in personal finance. Keep it under 30 words.`);
    };

    const handleNext = () => {
        setAiTip(null);
        if (currentStep < steps.length - 1) {
            setCurrentStep(currentStep + 1);
        } else {
            handleComplete();
        }
    };

    const handleBack = () => {
        setAiTip(null);
        if (currentStep > 0) {
            setCurrentStep(currentStep - 1);
        }
    };

    const handleComplete = () => {
        localStorage.setItem(`tour_${page}_seen`, 'true');
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
            {/* Backdrop */}
            <div className="fixed inset-0 bg-black/50" onClick={onClose} />

            {/* Modal */}
            <div className="relative w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="p-4 bg-gradient-to-r from-indigo-600 to-violet-600 text-white">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Lightbulb className="w-5 h-5" />
                            <span className="font-semibold">{tourContent.title}</span>
                        </div>
                        <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-full">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Progress */}
                    <div className="flex gap-1 mt-3">
                        {steps.map((_, idx) => (
                            <div
                                key={idx}
                                className={`h-1 flex-1 rounded-full transition-all ${idx <= currentStep ? 'bg-white' : 'bg-white/30'
                                    }`}
                            />
                        ))}
                    </div>
                </div>

                {/* Content */}
                <div className="p-6">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
                        {currentTip.title}
                    </h3>
                    <p className="text-slate-600 dark:text-slate-300">
                        {currentTip.description}
                    </p>

                    {/* AI Tip Section */}
                    <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                        {aiTip ? (
                            <div className="flex gap-2">
                                <Sparkles className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                                <p className="text-sm text-amber-800 dark:text-amber-200">{aiTip}</p>
                            </div>
                        ) : (
                            <button
                                onClick={handleGetAiTip}
                                disabled={loadingAiTip}
                                className="w-full flex items-center justify-center gap-2 text-sm text-amber-700 dark:text-amber-300 hover:text-amber-800"
                            >
                                {loadingAiTip ? (
                                    <span className="animate-pulse">Getting AI tip...</span>
                                ) : (
                                    <>
                                        <Sparkles className="w-4 h-4" />
                                        <span>Get AI tip for this feature</span>
                                    </>
                                )}
                            </button>
                        )}
                    </div>
                </div>

                {/* Navigation */}
                <div className="flex justify-between items-center px-6 pb-6">
                    <button
                        onClick={handleBack}
                        disabled={currentStep === 0}
                        className={`flex items-center gap-1 px-3 py-2 rounded-lg transition-colors ${currentStep === 0
                                ? 'text-slate-300 cursor-not-allowed'
                                : 'text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700'
                            }`}
                    >
                        <ChevronLeft className="w-4 h-4" />
                        Back
                    </button>

                    <span className="text-sm text-slate-400">
                        {currentStep + 1} of {steps.length}
                    </span>

                    <button
                        onClick={handleNext}
                        className="flex items-center gap-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                    >
                        {currentStep === steps.length - 1 ? 'Done' : 'Next'}
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
}

// Hook to manage tour state
export function useFeatureTour(page) {
    const [isOpen, setIsOpen] = useState(false);

    const hasSeenTour = localStorage.getItem(`tour_${page}_seen`);

    const startTour = () => setIsOpen(true);
    const closeTour = () => setIsOpen(false);
    const resetTour = () => {
        localStorage.removeItem(`tour_${page}_seen`);
    };

    return {
        isOpen,
        hasSeenTour: !!hasSeenTour,
        startTour,
        closeTour,
        resetTour
    };
}

export default FeatureTour;
