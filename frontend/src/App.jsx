import React from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LayoutDashboard, Settings as SettingsIcon, UploadCloud, List, LineChart, Calendar, CreditCard, TrendingDown, Zap, Target } from 'lucide-react';
import Settings from './pages/Settings';
import Ingest from './pages/Ingest';
import Transactions from './pages/Transactions';
import Dashboard from './pages/Dashboard';
import NetWorth from './pages/NetWorth';
import FinancialCalendar from './pages/FinancialCalendar';
import Subscriptions from './pages/Subscriptions';
import DebtVisualizer from './pages/DebtVisualizer';
import Insights from './pages/Insights';
import Goals from './pages/Goals';
import TaxCalculator from './pages/TaxCalculator';
import PrivacyPolicy from './pages/PrivacyPolicy';
import TermsOfService from './pages/TermsOfService';

import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { Navigate, Outlet } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import PrivateRoute from './components/PrivateRoute';
import { LogOut, Calculator } from 'lucide-react';

const queryClient = new QueryClient();

// Sidebar + Layout
function Layout() {
  const { logout, user } = useAuth();

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-sans">
      {/* Sidebar */}
      <div className="w-64 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 flex flex-col">
        <div className="p-6 border-b border-slate-100 dark:border-slate-700">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">Principal</h1>

        </div>

        <nav className="flex-1 p-4 space-y-1">
          <NavLink to="/" className={({ isActive }) => `flex items-center gap-3 px-4 py-3 rounded-xl transition ${isActive ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 font-medium' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>
            <LayoutDashboard size={20} />
            Dashboard
          </NavLink>
          <NavLink to="/net-worth" className={({ isActive }) => `flex items-center gap-3 px-4 py-3 rounded-xl transition ${isActive ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 font-medium' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>
            <LineChart size={20} />
            Net Worth
          </NavLink>
          <NavLink to="/transactions" className={({ isActive }) => `flex items-center gap-3 px-4 py-3 rounded-xl transition ${isActive ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 font-medium' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>
            <List size={20} />
            Transactions
          </NavLink>
          <NavLink to="/ingest" className={({ isActive }) => `flex items-center gap-3 px-4 py-3 rounded-xl transition ${isActive ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 font-medium' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>
            <UploadCloud size={20} />
            Import Data
          </NavLink>
          <NavLink to="/calendar" className={({ isActive }) => `flex items-center gap-3 px-4 py-3 rounded-xl transition ${isActive ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 font-medium' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>
            <Calendar size={20} />
            Calendar
          </NavLink>
          <NavLink to="/subscriptions" className={({ isActive }) => `flex items-center gap-3 px-4 py-3 rounded-xl transition ${isActive ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 font-medium' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>
            <CreditCard size={20} />
            Subscriptions
          </NavLink>
          <NavLink to="/goals" className={({ isActive }) => `flex items-center gap-3 px-4 py-3 rounded-xl transition ${isActive ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 font-medium' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>
            <Target size={20} />
            Goals
          </NavLink>
          <NavLink to="/debt" className={({ isActive }) => `flex items-center gap-3 px-4 py-3 rounded-xl transition ${isActive ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 font-medium' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>
            <TrendingDown size={20} />
            Debt Visualizer
          </NavLink>
          <NavLink to="/insights" className={({ isActive }) => `flex items-center gap-3 px-4 py-3 rounded-xl transition ${isActive ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 font-medium' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>
            <Zap size={20} />
            Insights
          </NavLink>
          <NavLink to="/settings" className={({ isActive }) => `flex items-center gap-3 px-4 py-3 rounded-xl transition ${isActive ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 font-medium' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>
            <SettingsIcon size={20} />
            Settings
          </NavLink>
          <NavLink to="/taxes" className={({ isActive }) => `flex items-center gap-3 px-4 py-3 rounded-xl transition ${isActive ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 font-medium' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>
            <Calculator size={20} />
            Taxes
          </NavLink>
        </nav>

        <div className="p-4 border-t border-slate-100 dark:border-slate-700">
          <button
            onClick={logout}
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 w-full transition"
          >
            <LogOut size={20} />
            Sign Out
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <Outlet />
      </div>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <Router>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
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
                <Route path="/debt" element={<DebtVisualizer />} />
                <Route path="/insights" element={<Insights />} />
                <Route path="/ingest" element={<Ingest />} />
                <Route path="/taxes" element={<TaxCalculator />} />
                <Route path="/settings" element={<Settings />} />
              </Route>
            </Routes>
          </Router>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
