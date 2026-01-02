import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LayoutDashboard, Settings as SettingsIcon, UploadCloud, List, LineChart, Calendar, CreditCard, Zap, Target, TrendingUp, Wrench, PiggyBank, Users, BarChart3, MessageCircle, Briefcase } from 'lucide-react';
import Settings from './pages/Settings';
import DataManagement from './pages/DataManagement';
import Transactions from './pages/Transactions';
import Dashboard from './pages/Dashboard';
import NetWorth from './pages/NetWorth';
import FinancialCalendar from './pages/FinancialCalendar';
import Subscriptions from './pages/Subscriptions';
import Tools from './pages/Tools';
import Budget from './pages/Budget';
import Review from './pages/Review';
import Reports from './pages/Reports';
import Insights from './pages/Insights';
import Goals from './pages/Goals';
import Investments from './pages/Investments';
import TransactionsHub from './pages/TransactionsHub';
import ReportsHub from './pages/ReportsHub';
import PrivacyPolicy from './pages/PrivacyPolicy';
import TermsOfService from './pages/TermsOfService';
import BasiqCallback from './pages/BasiqCallback';

import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { NotificationProvider } from './context/NotificationContext';
import { ToastProvider } from './context/ToastContext';
import { Navigate, Outlet } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import VerifyEmail from './pages/VerifyEmail';
import PrivateRoute from './components/PrivateRoute';
import ErrorBoundary from './components/ErrorBoundary';
import Footer from './components/Footer';
import { FeedbackModal, FeedbackButton } from './components/FeedbackModal';
import { LogOut } from 'lucide-react';
import NotificationBell from './components/NotificationBell';
import AIChatBot from './components/AIChatBot';
import QuickAddFAB from './components/QuickAddFAB';
import CommandPalette from './components/CommandPalette';

// Optimized QueryClient configuration for better performance and UX
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes - data stays fresh, reduces refetches
      cacheTime: 10 * 60 * 1000, // 10 minutes - keep in cache longer
      refetchOnWindowFocus: false, // Stop aggressive refetching on window focus
      refetchOnReconnect: 'always', // Refetch only when reconnecting after offline
      retry: 1, // Retry failed requests once instead of 3 times
    },
    mutations: {
      retry: 0, // Don't retry mutations automatically (user-triggered)
    },
  },
});

// Enhanced NavItem component with left accent indicator
function NavItem({ to, icon: Icon, children, end = false }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) => `
        group relative flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all duration-200
        ${isActive
          ? 'bg-gradient-to-r from-indigo-50 to-transparent dark:from-indigo-900/30 dark:to-transparent text-indigo-600 dark:text-indigo-400 font-medium'
          : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700/50 hover:text-slate-700 dark:hover:text-slate-300'
        }
      `}
    >
      {({ isActive }) => (
        <>
          {/* Left accent indicator */}
          <div className={`absolute left-0 top-1/2 -translate-y-1/2 w-1 rounded-full transition-all duration-200 ${isActive ? 'h-5 bg-gradient-to-b from-indigo-500 to-violet-500' : 'h-0 bg-transparent'}`}></div>
          <Icon size={18} className={`transition-transform duration-200 ${isActive ? 'text-indigo-500' : 'group-hover:scale-110'}`} />
          <span className="transition-transform duration-200 group-hover:translate-x-1">{children}</span>
        </>
      )}
    </NavLink>
  );
}

// Page title mapping
const PAGE_TITLES = {
  '/': 'Dashboard',
  '/transactions': 'Transactions',
  '/budget': 'Budget',
  '/net-worth': 'Net Worth',
  '/goals': 'Goals',
  '/reports': 'Reports',
  '/settings': 'Settings',
  '/data-management': 'Data Management',
  '/calendar': 'Calendar',
  '/subscriptions': 'Subscriptions',
  '/review': 'Review',
  '/tools': 'Tools',
  '/insights': 'Insights',
  '/investments': 'Investments',
};

// Header with page title
function Header() {
  const location = useLocation();
  const title = PAGE_TITLES[location.pathname] || 'Principal';

  return (
    <header className="h-[72px] bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between px-6 shadow-sm z-10">
      <h1 className="text-lg font-semibold text-slate-800 dark:text-white">{title}</h1>
      <NotificationBell />
    </header>
  );
}

// Sidebar + Layout
function Layout() {
  const { logout, user } = useAuth();
  const [showFeedback, setShowFeedback] = useState(false);
  const location = useLocation();

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-sans">
      {/* Sidebar */}
      <div className="w-64 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 flex flex-col">
        {/* Logo */}
        <div className="h-[72px] px-4 border-b border-slate-100 dark:border-slate-700 flex items-center">
          <div className="flex items-center gap-2.5">
            <img src="/logo.svg" alt="Principal Finance" className="w-10 h-10" />
            <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">Principal</h1>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 overflow-y-auto">
          {/* Overview */}
          <div className="mb-4">
            <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Overview</div>
            <NavItem to="/" icon={LayoutDashboard} end>Dashboard</NavItem>
          </div>

          {/* Money */}
          <div className="mb-4">
            <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Money</div>
            <NavItem to="/transactions" icon={List}>Transactions</NavItem>
            <NavItem to="/budget" icon={PiggyBank}>Budget</NavItem>
            <NavItem to="/investments" icon={Briefcase}>Investments</NavItem>
            <NavItem to="/net-worth" icon={LineChart}>Net Worth</NavItem>
          </div>

          {/* Planning */}
          <div className="mb-4">
            <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Planning</div>
            <NavItem to="/goals" icon={Target}>Goals</NavItem>
            <NavItem to="/reports" icon={BarChart3}>Reports</NavItem>
          </div>

          {/* System */}
          <div>
            <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">System</div>
            <NavItem to="/settings" icon={SettingsIcon}>Settings</NavItem>
          </div>
        </nav>

        <div className="p-3 border-t border-slate-100 dark:border-slate-700">
          <button
            onClick={() => setShowFeedback(true)}
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 w-full transition-all duration-200 mb-1"
          >
            <MessageCircle size={18} />
            Send Feedback
          </button>
          <button
            onClick={logout}
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 w-full transition-all duration-200"
          >
            <LogOut size={18} />
            Sign Out
          </button>
        </div>
      </div>

      {/* Main Content - wrapped in error boundary */}
      {/* Main Content - wrapped in error boundary */}
      <div className="flex-1 flex flex-col overflow-hidden bg-slate-50 dark:bg-slate-900">
        <Header />

        <div className="flex-1 overflow-auto">
          <div className="min-h-full flex flex-col">
            <ErrorBoundary>
              <div className="flex-1">
                <Outlet />
              </div>
            </ErrorBoundary>
            {/* Hide footer on Settings page to keep sidebar fixed */}
            {location.pathname !== '/settings' && <Footer />}
          </div>
        </div>
      </div>

      {/* Feedback Modal */}
      <FeedbackModal isOpen={showFeedback} onClose={() => setShowFeedback(false)} />

      {/* Command Palette (Cmd/Ctrl+K) */}
      <CommandPalette />

      {/* Quick Add FAB */}
      <QuickAddFAB />

      {/* AI ChatBot - Available on all pages */}
      <AIChatBot />
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            <NotificationProvider>
              <Router>
                <Routes>
                  <Route path="/login" element={<Login />} />
                  <Route path="/register" element={<Register />} />
                  <Route path="/forgot-password" element={<ForgotPassword />} />
                  <Route path="/reset-password" element={<ResetPassword />} />
                  <Route path="/verify-email" element={<VerifyEmail />} />
                  <Route path="/privacy" element={<PrivacyPolicy />} />
                  <Route path="/terms" element={<TermsOfService />} />
                  <Route path="/basiq-callback" element={<BasiqCallback />} />

                  {/* Protected Routes */}
                  <Route element={<PrivateRoute><Layout /></PrivateRoute>}>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/transactions" element={<TransactionsHub />} />
                    <Route path="/budget" element={<Budget />} />
                    <Route path="/net-worth" element={<NetWorth />} />
                    <Route path="/investments" element={<Investments />} />
                    <Route path="/goals" element={<Goals />} />
                    <Route path="/reports" element={<ReportsHub />} />
                    <Route path="/settings" element={<Settings />} />
                    {/* Legacy routes - redirect to consolidated pages */}
                    <Route path="/subscriptions" element={<TransactionsHub />} />
                    <Route path="/review" element={<TransactionsHub />} />
                    <Route path="/calendar" element={<ReportsHub />} />
                    <Route path="/insights" element={<ReportsHub />} />
                    <Route path="/data-management" element={<DataManagement />} />
                    <Route path="/tools" element={<Settings />} />
                  </Route>
                </Routes>
              </Router>
            </NotificationProvider>
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
