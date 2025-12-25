import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LayoutDashboard, Settings as SettingsIcon, UploadCloud, List, LineChart, Calendar, CreditCard, Zap, Target, TrendingUp, Wrench, PiggyBank, Users, BarChart3, MessageCircle } from 'lucide-react';
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
import PrivacyPolicy from './pages/PrivacyPolicy';
import TermsOfService from './pages/TermsOfService';

import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { NotificationProvider } from './context/NotificationContext';
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

const queryClient = new QueryClient();

// Enhanced NavItem component with left accent indicator
function NavItem({ to, icon: Icon, children, end = false }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) => `
        relative flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all duration-200
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
          <Icon size={18} className={isActive ? 'text-indigo-500' : ''} />
          {children}
        </>
      )}
    </NavLink>
  );
}

// Sidebar + Layout
function Layout() {
  const { logout, user } = useAuth();
  const [showFeedback, setShowFeedback] = useState(false);

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-sans">
      {/* Sidebar */}
      <div className="w-64 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 flex flex-col">
        {/* Logo */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <TrendingUp className="text-white" size={20} />
            </div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">Principal</h1>
          </div>
        </div>

        <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto">
          <NavItem to="/" icon={LayoutDashboard} end>Dashboard</NavItem>
          <NavItem to="/net-worth" icon={LineChart}>Net Worth</NavItem>
          <NavItem to="/transactions" icon={List}>Transactions</NavItem>
          <NavItem to="/data-management" icon={UploadCloud}>Data Management</NavItem>
          <NavItem to="/calendar" icon={Calendar}>Calendar</NavItem>
          <NavItem to="/subscriptions" icon={CreditCard}>Subscriptions</NavItem>
          <NavItem to="/goals" icon={Target}>Goals</NavItem>
          <NavItem to="/budget" icon={PiggyBank}>Budget</NavItem>
          <NavItem to="/review" icon={Users}>Review</NavItem>
          <NavItem to="/reports" icon={BarChart3}>Reports</NavItem>
          <NavItem to="/tools" icon={Wrench}>Tools</NavItem>
          <NavItem to="/insights" icon={Zap}>Insights</NavItem>
          <NavItem to="/settings" icon={SettingsIcon}>Settings</NavItem>
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
        <header className="h-16 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center justify-end px-6 shadow-sm z-10">
          <NotificationBell />
        </header>

        <div className="flex-1 overflow-auto">
          <div className="min-h-full flex flex-col">
            <ErrorBoundary>
              <div className="flex-1">
                <Outlet />
              </div>
            </ErrorBoundary>
            <Footer />
          </div>
        </div>
      </div>

      {/* Feedback Modal */}
      <FeedbackModal isOpen={showFeedback} onClose={() => setShowFeedback(false)} />

      {/* AI ChatBot - Available on all pages */}
      <AIChatBot />
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
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

                {/* Protected Routes */}
                <Route element={<PrivateRoute><Layout /></PrivateRoute>}>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/net-worth" element={<NetWorth />} />
                  <Route path="/transactions" element={<Transactions />} />
                  <Route path="/calendar" element={<FinancialCalendar />} />
                  <Route path="/subscriptions" element={<Subscriptions />} />
                  <Route path="/goals" element={<Goals />} />
                  <Route path="/tools" element={<Tools />} />
                  <Route path="/budget" element={<Budget />} />
                  <Route path="/review" element={<Review />} />
                  <Route path="/reports" element={<Reports />} />
                  <Route path="/insights" element={<Insights />} />
                  <Route path="/data-management" element={<DataManagement />} />
                  <Route path="/settings" element={<Settings />} />
                </Route>
              </Routes>
            </Router>
          </NotificationProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
