/**
 * Onboarding Wizard Component
 * 
 * A step-by-step setup wizard for new users.
 * Guides users through initial configuration:
 * - Welcome & account setup
 * - Currency selection
 * - Couple mode configuration
 * - Initial budget categories
 * - Connect bank or import data
 */
import React, { useState, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import {
    UserIcon,
    CurrencyDollarIcon,
    UsersIcon,
    TagIcon,
    BanknotesIcon,
    CheckCircleIcon,
    ArrowRightIcon,
    ArrowLeftIcon,
    XMarkIcon
} from '@heroicons/react/24/outline';

const STEPS = [
    { id: 'welcome', title: 'Welcome', icon: UserIcon },
    { id: 'currency', title: 'Currency', icon: CurrencyDollarIcon },
    { id: 'household', title: 'Household', icon: UsersIcon },
    { id: 'categories', title: 'Categories', icon: TagIcon },
    { id: 'complete', title: 'Complete', icon: CheckCircleIcon },
];

const CURRENCIES = [
    { code: 'AUD', symbol: '$', name: 'Australian Dollar' },
    { code: 'USD', symbol: '$', name: 'US Dollar' },
    { code: 'GBP', symbol: '£', name: 'British Pound' },
    { code: 'EUR', symbol: '€', name: 'Euro' },
    { code: 'NZD', symbol: '$', name: 'New Zealand Dollar' },
    { code: 'CAD', symbol: '$', name: 'Canadian Dollar' },
    { code: 'SGD', symbol: '$', name: 'Singapore Dollar' },
];

const DEFAULT_CATEGORIES = [
    { name: 'Salary', group: 'Income', isIncome: true },
    { name: 'Rent/Mortgage', group: 'Non-Discretionary' },
    { name: 'Utilities', group: 'Non-Discretionary' },
    { name: 'Groceries', group: 'Discretionary' },
    { name: 'Transport', group: 'Discretionary' },
    { name: 'Entertainment', group: 'Discretionary' },
    { name: 'Health', group: 'Discretionary' },
    { name: 'Shopping', group: 'Discretionary' },
];

export function OnboardingWizard({ isOpen, onClose, onComplete }) {
    const [currentStep, setCurrentStep] = useState(0);
    const [formData, setFormData] = useState({
        currency: 'AUD',
        coupleMode: false,
        partnerAName: 'You',
        partnerBName: 'Partner',
        selectedCategories: DEFAULT_CATEGORIES.map(c => c.name),
    });

    const handleNext = () => {
        if (currentStep < STEPS.length - 1) {
            setCurrentStep(currentStep + 1);
        }
    };

    const handleBack = () => {
        if (currentStep > 0) {
            setCurrentStep(currentStep - 1);
        }
    };

    const handleComplete = async () => {
        // Save preferences to API
        try {
            // Update user settings
            await fetch('/settings/user', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('access_token')}`
                },
                body: JSON.stringify({
                    currency_symbol: formData.currency,
                    is_couple_mode: formData.coupleMode,
                    name_a: formData.partnerAName,
                    name_b: formData.partnerBName,
                })
            });

            // Mark onboarding complete
            localStorage.setItem('principal_onboarding_complete', 'true');

            if (onComplete) {
                onComplete(formData);
            }
            onClose();
        } catch (error) {
            console.error('Failed to save onboarding settings:', error);
        }
    };

    const toggleCategory = (categoryName) => {
        setFormData(prev => ({
            ...prev,
            selectedCategories: prev.selectedCategories.includes(categoryName)
                ? prev.selectedCategories.filter(c => c !== categoryName)
                : [...prev.selectedCategories, categoryName]
        }));
    };

    const renderStep = () => {
        switch (STEPS[currentStep].id) {
            case 'welcome':
                return (
                    <div className="text-center py-8">
                        <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-6">
                            <BanknotesIcon className="w-10 h-10 text-white" />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-3">
                            Welcome to Principal
                        </h2>
                        <p className="text-gray-600 max-w-sm mx-auto">
                            Let's set up your personal finance tracker. This will only take a minute.
                        </p>
                    </div>
                );

            case 'currency':
                return (
                    <div className="py-6">
                        <h2 className="text-xl font-semibold text-gray-900 mb-2">
                            Select Your Currency
                        </h2>
                        <p className="text-gray-600 mb-6">
                            Choose the currency you'll use for tracking expenses.
                        </p>
                        <div className="grid grid-cols-2 gap-3">
                            {CURRENCIES.map((currency) => (
                                <button
                                    key={currency.code}
                                    onClick={() => setFormData(prev => ({ ...prev, currency: currency.code }))}
                                    className={`flex items-center gap-3 p-4 rounded-lg border-2 transition-all ${formData.currency === currency.code
                                            ? 'border-blue-500 bg-blue-50'
                                            : 'border-gray-200 hover:border-gray-300'
                                        }`}
                                >
                                    <span className="text-2xl font-bold text-gray-700">
                                        {currency.symbol}
                                    </span>
                                    <div className="text-left">
                                        <div className="font-medium text-gray-900">{currency.code}</div>
                                        <div className="text-xs text-gray-500">{currency.name}</div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                );

            case 'household':
                return (
                    <div className="py-6">
                        <h2 className="text-xl font-semibold text-gray-900 mb-2">
                            Household Setup
                        </h2>
                        <p className="text-gray-600 mb-6">
                            Are you tracking finances solo or with a partner?
                        </p>

                        <div className="space-y-4">
                            <button
                                onClick={() => setFormData(prev => ({ ...prev, coupleMode: false }))}
                                className={`w-full flex items-center gap-4 p-4 rounded-lg border-2 transition-all ${!formData.coupleMode
                                        ? 'border-blue-500 bg-blue-50'
                                        : 'border-gray-200 hover:border-gray-300'
                                    }`}
                            >
                                <UserIcon className="w-8 h-8 text-gray-600" />
                                <div className="text-left">
                                    <div className="font-medium text-gray-900">Individual</div>
                                    <div className="text-sm text-gray-500">Track your personal finances</div>
                                </div>
                            </button>

                            <button
                                onClick={() => setFormData(prev => ({ ...prev, coupleMode: true }))}
                                className={`w-full flex items-center gap-4 p-4 rounded-lg border-2 transition-all ${formData.coupleMode
                                        ? 'border-blue-500 bg-blue-50'
                                        : 'border-gray-200 hover:border-gray-300'
                                    }`}
                            >
                                <UsersIcon className="w-8 h-8 text-gray-600" />
                                <div className="text-left">
                                    <div className="font-medium text-gray-900">Couple / Household</div>
                                    <div className="text-sm text-gray-500">Track shared & individual expenses</div>
                                </div>
                            </button>

                            {formData.coupleMode && (
                                <div className="mt-4 p-4 bg-gray-50 rounded-lg space-y-3">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Your Name
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.partnerAName}
                                            onChange={(e) => setFormData(prev => ({ ...prev, partnerAName: e.target.value }))}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                            placeholder="e.g., John"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Partner's Name
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.partnerBName}
                                            onChange={(e) => setFormData(prev => ({ ...prev, partnerBName: e.target.value }))}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                            placeholder="e.g., Jane"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                );

            case 'categories':
                return (
                    <div className="py-6">
                        <h2 className="text-xl font-semibold text-gray-900 mb-2">
                            Budget Categories
                        </h2>
                        <p className="text-gray-600 mb-6">
                            Select the categories you want to track. You can customize these later in Settings.
                        </p>

                        <div className="space-y-4">
                            {['Income', 'Non-Discretionary', 'Discretionary'].map((group) => (
                                <div key={group}>
                                    <h3 className="text-sm font-medium text-gray-500 mb-2">{group}</h3>
                                    <div className="flex flex-wrap gap-2">
                                        {DEFAULT_CATEGORIES.filter(c => c.group === group).map((category) => (
                                            <button
                                                key={category.name}
                                                onClick={() => toggleCategory(category.name)}
                                                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${formData.selectedCategories.includes(category.name)
                                                        ? 'bg-blue-100 text-blue-800 border-2 border-blue-300'
                                                        : 'bg-gray-100 text-gray-600 border-2 border-transparent hover:bg-gray-200'
                                                    }`}
                                            >
                                                {category.name}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                );

            case 'complete':
                return (
                    <div className="text-center py-8">
                        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                            <CheckCircleIcon className="w-12 h-12 text-green-600" />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-3">
                            You're All Set!
                        </h2>
                        <p className="text-gray-600 max-w-sm mx-auto mb-6">
                            Your account is ready. Start by importing your bank statements or connecting your bank.
                        </p>
                        <div className="flex gap-3 justify-center">
                            <button
                                onClick={() => {
                                    handleComplete();
                                    window.location.href = '/ingest';
                                }}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                            >
                                Import Data
                            </button>
                            <button
                                onClick={handleComplete}
                                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                            >
                                Skip for now
                            </button>
                        </div>
                    </div>
                );

            default:
                return null;
        }
    };

    return (
        <Transition appear show={isOpen} as={Fragment}>
            <Dialog as="div" className="relative z-50" onClose={() => { }}>
                <Transition.Child
                    as={Fragment}
                    enter="ease-out duration-300"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in duration-200"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <div className="fixed inset-0 bg-black bg-opacity-50" />
                </Transition.Child>

                <div className="fixed inset-0 overflow-y-auto">
                    <div className="flex min-h-full items-center justify-center p-4">
                        <Transition.Child
                            as={Fragment}
                            enter="ease-out duration-300"
                            enterFrom="opacity-0 scale-95"
                            enterTo="opacity-100 scale-100"
                            leave="ease-in duration-200"
                            leaveFrom="opacity-100 scale-100"
                            leaveTo="opacity-0 scale-95"
                        >
                            <Dialog.Panel className="w-full max-w-lg transform overflow-hidden rounded-2xl bg-white shadow-xl transition-all">
                                {/* Progress bar */}
                                <div className="bg-gray-100 h-1">
                                    <div
                                        className="bg-blue-600 h-1 transition-all duration-300"
                                        style={{ width: `${((currentStep + 1) / STEPS.length) * 100}%` }}
                                    />
                                </div>

                                {/* Step indicators */}
                                <div className="flex justify-center gap-2 pt-6 px-6">
                                    {STEPS.map((step, index) => {
                                        const Icon = step.icon;
                                        const isComplete = index < currentStep;
                                        const isCurrent = index === currentStep;
                                        return (
                                            <div
                                                key={step.id}
                                                className={`flex items-center justify-center w-10 h-10 rounded-full transition-all ${isComplete
                                                        ? 'bg-green-100 text-green-600'
                                                        : isCurrent
                                                            ? 'bg-blue-100 text-blue-600'
                                                            : 'bg-gray-100 text-gray-400'
                                                    }`}
                                            >
                                                <Icon className="w-5 h-5" />
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Content */}
                                <div className="p-6">
                                    {renderStep()}
                                </div>

                                {/* Navigation */}
                                {STEPS[currentStep].id !== 'complete' && (
                                    <div className="flex justify-between items-center px-6 pb-6">
                                        <button
                                            onClick={handleBack}
                                            disabled={currentStep === 0}
                                            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${currentStep === 0
                                                    ? 'text-gray-300 cursor-not-allowed'
                                                    : 'text-gray-600 hover:bg-gray-100'
                                                }`}
                                        >
                                            <ArrowLeftIcon className="w-4 h-4" />
                                            Back
                                        </button>
                                        <button
                                            onClick={handleNext}
                                            className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                                        >
                                            Next
                                            <ArrowRightIcon className="w-4 h-4" />
                                        </button>
                                    </div>
                                )}
                            </Dialog.Panel>
                        </Transition.Child>
                    </div>
                </div>
            </Dialog>
        </Transition>
    );
}

/**
 * Hook to check if user needs onboarding
 */
export function useOnboarding() {
    const [needsOnboarding, setNeedsOnboarding] = useState(false);

    React.useEffect(() => {
        const complete = localStorage.getItem('principal_onboarding_complete');
        const isNewUser = !complete;
        setNeedsOnboarding(isNewUser);
    }, []);

    const markComplete = () => {
        localStorage.setItem('principal_onboarding_complete', 'true');
        setNeedsOnboarding(false);
    };

    const reset = () => {
        localStorage.removeItem('principal_onboarding_complete');
        setNeedsOnboarding(true);
    };

    return { needsOnboarding, markComplete, reset };
}

export default OnboardingWizard;
