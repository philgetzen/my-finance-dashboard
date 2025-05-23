import React, { useEffect, useState } from 'react';
import { PlaidLink } from 'react-plaid-link';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import './App.css';
import { auth } from './firebase';
import { GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { collection, addDoc, getDocs, query, where } from 'firebase/firestore';
import { getFirestore } from 'firebase/firestore';
import { HomeIcon, CreditCardIcon, ListBulletIcon, Cog6ToothIcon } from '@heroicons/react/24/outline';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useLocation, Outlet } from 'react-router-dom';
import { PlaidDataProvider, usePlaid } from './contexts/PlaidDataContext';

const COLORS = ['#6366F1', '#A78BFA', '#F472B6', '#34D399', '#FBBF24', '#60A5FA'];
const ACCOUNT_TYPE_COLORS = {
  depository: 'bg-blue-200 text-blue-800',
  credit: 'bg-purple-200 text-purple-800',
  loan: 'bg-green-200 text-green-800',
  investment: 'bg-yellow-200 text-yellow-800',
  other: 'bg-gray-200 text-gray-800',
};

// --- Helper Components ---
const Spinner = () => (
  <div className="flex justify-center items-center h-32">
    <svg className="animate-spin h-8 w-8 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V4a10 10 0 00-9.95 9.5H4zm8-8a8 8 0 018 8h2a10 10 0 00-9.5-9.95V4z"></path>
    </svg>
  </div>
);

const LoginCard = ({ onLogin }) => (
  <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-[var(--color-bg)] to-[var(--color-surface-alt)]">
    <div className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-2xl p-8 w-full max-w-md mx-auto">
      <div className="flex flex-col items-center mb-6">
        <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mb-2">
          <svg width="28" height="28" fill="none" viewBox="0 0 24 24"><path fill="#6366F1" d="M12 2a10 10 0 100 20 10 10 0 000-20zm0 3a7 7 0 110 14A7 7 0 0112 5z"/></svg>
        </div>
        <h2 className="text-2xl font-bold text-blue-800 mb-1">Welcome</h2>
        <p className="text-gray-500 text-sm">Sign in with Google to get started</p>
      </div>
      <button
        className="w-full flex items-center justify-center gap-2 border border-gray-200 rounded-lg py-2 mb-3 hover:bg-gray-50 transition bg-white text-gray-700 font-medium text-base"
        onClick={onLogin}
      >
        <img src="https://upload.wikimedia.org/wikipedia/commons/4/4a/Logo_2013_Google.png" alt="Google" className="w-5 h-5" />
        Sign in with Google
      </button>
    </div>
  </div>
);

const ManualAccountModal = ({ user, show, onClose, onAccountAdded }) => {
  const [manualForm, setManualForm] = useState({ name: '', type: '', subtype: '', balance: '' });
  const [manualError, setManualError] = useState('');
  const dbClient = getFirestore();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setManualError('');
    if (!manualForm.name || !manualForm.type || !manualForm.balance) {
      setManualError('Name, type, and balance are required.');
      return;
    }
    if (!user) {
      setManualError('You must be logged in to add an account.');
      return;
    }
    try {
      await addDoc(collection(dbClient, 'manual_accounts'), {
        user_id: user.uid,
        name: manualForm.name,
        type: manualForm.type,
        subtype: manualForm.subtype,
        balance: parseFloat(manualForm.balance),
      });
      setManualForm({ name: '', type: '', subtype: '', balance: '' });
      onClose();
      if (onAccountAdded) onAccountAdded();
    } catch (err) {
      setManualError('Failed to add manual account.');
      console.error("Error adding manual account:", err);
    }
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"><div className="bg-white rounded-xl shadow-lg p-8 w-full max-w-md mx-auto"><h2 className="text-xl font-bold mb-4 text-blue-800">Add Manual Account</h2><form onSubmit={handleSubmit} className="flex flex-col gap-3"><input type="text" placeholder="Account Name" className="border rounded px-3 py-2" value={manualForm.name} onChange={e => setManualForm(f => ({ ...f, name: e.target.value }))} /><select className="border rounded px-3 py-2" value={manualForm.type} onChange={e => setManualForm(f => ({ ...f, type: e.target.value }))}><option value="">Select Type</option><option value="depository">Asset (Checking/Savings)</option><option value="investment">Investment</option><option value="credit">Credit Card</option><option value="loan">Loan</option><option value="mortgage">Mortgage</option><option value="other">Other</option></select><input type="text" placeholder="Subtype (optional)" className="border rounded px-3 py-2" value={manualForm.subtype} onChange={e => setManualForm(f => ({ ...f, subtype: e.target.value }))} /><input type="number" step="any" placeholder="Balance" className="border rounded px-3 py-2" value={manualForm.balance} onChange={e => setManualForm(f => ({ ...f, balance: e.target.value }))} />{manualError && <div className="text-red-600 text-sm">{manualError}</div>}<div className="flex gap-2 mt-2"><button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg px-4 py-2 transition">Add</button><button type="button" className="bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg px-4 py-2 transition" onClick={onClose}>Cancel</button></div></form></div></div>
  );
};

const DarkModeToggle = () => {
  const [dark, setDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches);
  useEffect(() => { document.documentElement.classList.toggle('dark', dark); }, [dark]);
  return (<button className="link-action" onClick={() => setDark(d => !d)}>{dark ? '🌙 Dark' : '☀️ Light'}</button>);
};

const PieChartIcon = (props) => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6a7.5 7.5 0 107.5 7.5h-7.5V6z" /><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5H21A7.5 7.5 0 0013.5 3v7.5z" /></svg>;


// --- Main Application Structure ---
function MainLayout() { 
  const { user, error: plaidErrorGlobal } = usePlaid(); 
  const location = useLocation();

  const handleLogout = async () => {
    try { await signOut(auth); } catch (error) { console.error("Error signing out: ", error); }
  };
  
  const navLinks = [
    { name: 'Dashboard', path: '/', icon: HomeIcon },
    { name: 'Snapshot', path: '/snapshot', icon: PieChartIcon }, 
    { name: 'Balance Sheet', path: '/balance-sheet', icon: ListBulletIcon },
    { name: 'Accounts', path: '/accounts', icon: CreditCardIcon },
    { name: 'Inv. Allocation', path: '/investment-allocation', icon: PieChartIcon },
    { name: 'Holdings', path: '/holdings', icon: Cog6ToothIcon }, 
  ];

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-[var(--color-bg)] to-[var(--color-surface-alt)]">
      <aside className="card w-60 min-h-screen flex flex-col justify-between border border-[var(--color-border)] bg-white mr-12 mt-8 ml-8" style={{ boxShadow: 'none', borderRadius: '8px' }}>
        <div>
          <div className="flex items-center gap-3 mb-10 mt-2 pl-2">
            <img src="/logo.png" alt="Logo" className="w-10 h-10 rounded-md" />
            <span className="text-2xl font-bold text-[var(--color-primary)] tracking-tight">Finance</span>
          </div>
          <nav className="flex flex-col gap-1">
            {navLinks.map(link => (
              <Link key={link.name} to={link.path} className={`flex items-center gap-3 px-4 py-2 font-medium transition text-base ${location.pathname === link.path ? 'bg-[var(--color-primary-light)] text-[var(--color-primary)]' : 'text-[var(--color-muted)] hover:bg-[var(--color-surface-alt)]'} rounded`} style={{ fontWeight: location.pathname === link.path ? 700 : 500 }}>
                <link.icon className="h-5 w-5" /> {link.name}
              </Link>
            ))}
          </nav>
        </div>
        <div className="mb-6 pl-2 flex flex-col gap-2"><DarkModeToggle /><button onClick={handleLogout} className="link-action">Log out</button></div>
      </aside>
      <main className="flex-1 flex flex-col gap-8 mt-8 mr-8">
        {plaidErrorGlobal && <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4" role="alert"><p className="font-bold">Plaid Error</p><p>{plaidErrorGlobal}</p></div>}
        <Outlet /> 
      </main>
    </div>
  );
}
// --- Page Components (Refactored) ---

function DashboardPage() {
  const { accounts: plaidAccounts, transactions: plaidTransactions, loading: plaidLoading, error: plaidError, refetchData, user } = usePlaid();
  const [linkToken, setLinkToken] = useState(null);
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState(() => { const d = new Date(); d.setMonth(d.getMonth() - 1); return d.toISOString().slice(0, 10); });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [fetchingNewPlaidAccount, setFetchingNewPlaidAccount] = useState(false);
  const [plaidLinkError, setPlaidLinkError] = useState('');
  const [manualAccounts, setManualAccounts] = useState([]);
  const [showManualModal, setShowManualModal] = useState(false);
  const [isFetchingLinkToken, setIsFetchingLinkToken] = useState(false); // New state for link token fetching
  const dbClient = getFirestore();

  // Removed useEffect that fetches link_token on mount.

  const fetchManualAccounts = async (userId) => {
    if (!userId) { setManualAccounts([]); return; }
    const q = query(collection(dbClient, 'manual_accounts'), where('user_id', '==', userId));
    try { const querySnapshot = await getDocs(q); const accs = []; querySnapshot.forEach(doc => accs.push({ ...doc.data(), id: doc.id })); setManualAccounts(accs); }
    catch (err) { console.error("Error fetching manual accounts for Dashboard:", err); setPlaidLinkError("Error fetching manual accounts."); }
  };

  useEffect(() => { if (user) fetchManualAccounts(user.uid); else setManualAccounts([]); }, [user]);

  const handlePlaidLinkSuccess = async (public_token) => {
    setFetchingNewPlaidAccount(true); setPlaidLinkError('');
    try {
      const exchangeRes = await fetch('http://localhost:5001/api/exchange_public_token', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ public_token }) });
      if (!exchangeRes.ok) throw new Error(`Token exchange HTTP error! status: ${exchangeRes.status}`);
      const exchangeData = await exchangeRes.json();
      if (user && exchangeData.access_token) {
        const saveTokenRes = await fetch('http://localhost:5001/api/save_access_token', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: user.uid, access_token: exchangeData.access_token }) });
        if(!saveTokenRes.ok) throw new Error(`Save access token HTTP error! status: ${saveTokenRes.status}`);
        await refetchData();
        setLinkToken(null); 
      } else if (exchangeData.error) {
        throw new Error(exchangeData.error.error_message || exchangeData.error.error_code || 'Plaid token exchange error');
      } else {
        throw new Error('Unknown error during Plaid token exchange.');
      }
    } catch (err) { console.error("Plaid success/exchange error on Dashboard:", err); setPlaidLinkError(`Linking account failed: ${err.message}. Please try again.`); }
    setFetchingNewPlaidAccount(false);
  };

  const allAccounts = [...(plaidAccounts || []), ...manualAccounts];
  const liabilityTypes = ['credit', 'loan', 'mortgage'];
  const netWorth = allAccounts.reduce((sum, acc) => { const bal = acc.balances?.current ?? acc.balance ?? 0; return liabilityTypes.includes(acc.type) || (acc.subtype && liabilityTypes.includes(acc.subtype)) ? sum - Math.abs(bal) : sum + bal; }, 0);
  const allocation = Object.values(allAccounts.reduce((acc, account) => { const type = account.type || 'other'; const balance = typeof account.balances?.current === 'number' ? account.balances.current : (typeof account.balance === 'number' ? account.balance : 0); acc[type] = acc[type] || { name: type, value: 0 }; acc[type].value += balance; return acc; }, {})).filter(item => item.value > 0);
  const accountIdToName = Object.fromEntries(allAccounts.map(acc => [acc.account_id || acc.id, acc.name]));
  const filteredTransactions = (plaidTransactions || []).filter(txn => { const searchLower = search.toLowerCase(); return ((txn.name || '').toLowerCase().includes(searchLower) || (accountIdToName[txn.account_id] || '').toLowerCase().includes(searchLower) || (txn.amount || 0).toString().includes(searchLower)); });

  if (plaidLoading && !plaidAccounts && !plaidError) return <Spinner />; 

  return (
    <div className="flex flex-col gap-8">
      <header className="flex items-center justify-between mb-8">
        <h1 className="text-4xl font-bold text-[var(--color-text)]">Dashboard</h1>
        <div className="flex gap-2">
          {user && (
            <>
              {linkToken ? (
                <PlaidLink 
                  token={linkToken} 
                  onSuccess={handlePlaidLinkSuccess} 
                  onExit={(error, metadata) => {
                    if (error) {
                      setPlaidLinkError(`Plaid Link exited with error: ${error.error_message || error.error_code}`);
                      console.error("Plaid Link onExit error:", error, metadata);
                    }
                    // Optionally reset linkToken here if PlaidLink should not be re-rendered with the same token after exit
                    // setLinkToken(null); 
                  }}
                >
                  <button className="link-action" disabled={fetchingNewPlaidAccount || isFetchingLinkToken}>
                    {fetchingNewPlaidAccount ? "Linking..." : (isFetchingLinkToken ? "Initializing..." : "+ Add Bank Account")}
                  </button>
                </PlaidLink>
              ) : (
                <button 
                  className="link-action" 
                  onClick={async () => {
                    if (!user) return;
                    setIsFetchingLinkToken(true);
                    setPlaidLinkError('');
                    try {
                      const res = await fetch('http://localhost:5001/api/create_link_token', { method: 'POST', headers: { 'Content-Type': 'application/json' }});
                      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
                      const data = await res.json();
                      if (data.link_token) {
                        setLinkToken(data.link_token);
                      } else {
                        throw new Error(data.error?.error_message || data.error?.message || data.error || 'Failed to get Plaid link token');
                      }
                    } catch (err) {
                      console.error("Error fetching link token for Dashboard:", err);
                      setPlaidLinkError(`Failed to initialize Plaid Link: ${err.message}. Try again.`);
                    } finally {
                      setIsFetchingLinkToken(false);
                    }
                  }}
                  disabled={isFetchingLinkToken || fetchingNewPlaidAccount}
                >
                  {isFetchingLinkToken ? "Initializing..." : "+ Add Bank Account"}
                </button>
              )}
              <button onClick={() => setShowManualModal(true)} className="link-action" disabled={fetchingNewPlaidAccount || isFetchingLinkToken}>+ Add Manual Account</button>
            </>
          )}
        </div>
      </header>
      {fetchingNewPlaidAccount && <div className="bg-blue-100 text-blue-700 p-3 rounded mb-4 text-center">Linking new account...</div>}
      {plaidLinkError && <div className="bg-red-100 text-red-700 p-3 rounded mb-4 text-center">{plaidLinkError}</div>}
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="card flex flex-col items-center justify-center"><h2 className="text-lg font-semibold text-[var(--color-muted)] mb-2">Net Worth</h2><div className="text-4xl font-bold text-[var(--color-primary)]">${netWorth.toLocaleString(undefined, {maximumFractionDigits: 2})}</div></div>
        <div className="card flex flex-col items-center justify-center md:col-span-2 min-h-[380px]"><h2 className="text-lg font-semibold text-[var(--color-muted)] mb-2">Asset Allocation</h2>{allocation.length > 0 ? (<div className="w-full flex justify-center"><div className="w-full min-w-[350px] max-w-[600px] h-[320px]"><ResponsiveContainer width="100%" height={320}><PieChart><Pie data={allocation} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={110} fill="var(--color-primary)" label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`} labelLine={false}>{allocation.map((entry, index) => (<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />))}</Pie><Tooltip /><Legend layout="vertical" align="right" verticalAlign="middle" /></PieChart></ResponsiveContainer></div></div>) : <p className="text-gray-500">No allocation data.</p>}</div>
        <div className="card flex flex-col items-center justify-center bg-[var(--color-surface-alt)]"><h2 className="text-lg font-semibold text-[var(--color-muted)] mb-2">Cash Flow (WIP)</h2><div className="w-full h-32 flex items-center justify-center text-[var(--color-primary-light)]">Bar chart placeholder</div></div>
      </div>
      <div className="card"><h2 className="text-lg font-semibold text-[var(--color-primary-dark)] mb-4">Recent Transactions</h2><div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="sticky top-0 bg-[var(--color-surface)]"><tr><th className="px-2 py-1 text-left">Date</th><th className="px-2 py-1 text-left">Name</th><th className="px-2 py-1 text-left">Amount</th><th className="px-2 py-1 text-left">Account</th></tr></thead><tbody>{filteredTransactions.slice(0, 10).map(txn => (<tr key={txn.transaction_id} className="border-b last:border-b-0 hover:bg-[var(--color-surface-alt)] transition"><td className="px-2 py-1">{txn.date}</td><td className="px-2 py-1">{txn.name}</td><td className="px-2 py-1">${(txn.amount || 0).toLocaleString(undefined, {maximumFractionDigits: 2})}</td><td className="px-2 py-1">{accountIdToName[txn.account_id] || txn.account_id}</td></tr>))}{filteredTransactions.length === 0 && !plaidLoading && (<tr><td colSpan="4" className="text-center py-4 text-gray-500">No transactions.</td></tr>)}</tbody></table></div></div>
      <ManualAccountModal user={user} show={showManualModal} onClose={() => setShowManualModal(false)} onAccountAdded={() => fetchManualAccounts(user?.uid)} />
    </div>
  );
}

function BalanceSheetPage() {
  const { accounts: plaidAccounts, loading: plaidLoading, error: plaidError, user } = usePlaid();
  const [manualAccounts, setManualAccounts] = useState([]);
  const dbClient = getFirestore();
  const [tab, setTab] = useState('current');

  const fetchManualAccounts = async (userId) => {
    if (!userId) { setManualAccounts([]); return; }
    const q = query(collection(dbClient, 'manual_accounts'), where('user_id', '==', userId));
    try { const querySnapshot = await getDocs(q); const accs = []; querySnapshot.forEach(doc => accs.push({ ...doc.data(), id: doc.id })); setManualAccounts(accs); }
    catch (err) { console.error("Error fetching manual accounts for BalanceSheet:", err); }
  };
  useEffect(() => { if (user) fetchManualAccounts(user.uid); else setManualAccounts([]); }, [user]);

  const allAccounts = [...(plaidAccounts || []), ...manualAccounts];
  const liabilityTypes = ['credit', 'loan', 'mortgage'];
  const totalAssets = allAccounts.reduce((sum, acc) => { const bal = acc.balances?.current ?? acc.balance ?? 0; return (!liabilityTypes.includes(acc.type) && !(acc.subtype && liabilityTypes.includes(acc.subtype))) ? sum + bal : sum; }, 0);
  const totalLiabilities = allAccounts.reduce((sum, acc) => { const bal = acc.balances?.current ?? acc.balance ?? 0; return (liabilityTypes.includes(acc.type) || (acc.subtype && liabilityTypes.includes(acc.subtype))) ? sum + Math.abs(bal) : sum; }, 0);
  const netWorth = totalAssets - totalLiabilities;

  if (plaidLoading && !plaidAccounts && !plaidError) return <Spinner />;
  
  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-3xl font-bold mb-4">Balance Sheet</h1>
      {!user && !plaidLoading && <p className="text-center text-gray-500">Please log in.</p>}
      {user && (
        <>
          <div className="flex gap-2 mb-4"><button className={`link-action${tab === 'current' ? ' underline' : ''}`} onClick={() => setTab('current')}>Current</button><button className={`link-action${tab === 'details' ? ' underline' : ''}`} onClick={() => setTab('details')}>Details (WIP)</button><button className={`link-action${tab === 'historical' ? ' underline' : ''}`} onClick={() => setTab('historical')}>Historical (WIP)</button></div>
          <div className="card">
            {tab === 'current' && (<div className="flex flex-col gap-4"><h2 className="text-lg font-semibold text-[var(--color-primary-dark)] mb-2">Current Snapshot</h2><div className="grid grid-cols-1 md:grid-cols-3 gap-4"><div className="flex flex-col"><div className="text-md font-semibold text-[var(--color-muted)]">Total Assets</div><div className="text-2xl font-bold text-[var(--color-primary)]">${totalAssets.toLocaleString(undefined, {maximumFractionDigits: 2})}</div></div><div className="flex flex-col"><div className="text-md font-semibold text-[var(--color-muted)]">Total Liabilities</div><div className="text-2xl font-bold text-[var(--color-danger)]">-${totalLiabilities.toLocaleString(undefined, {maximumFractionDigits: 2})}</div></div><div className="flex flex-col"><div className="text-md font-semibold text-[var(--color-muted)]">Net Worth</div><div className="text-2xl font-bold text-[var(--color-primary)]">${netWorth.toLocaleString(undefined, {maximumFractionDigits: 2})}</div></div></div><h3 className="text-lg font-semibold text-[var(--color-muted)] mt-4 mb-2">Account Breakdown</h3><div className="overflow-x-auto"><table className="min-w-full text-sm"><thead><tr><th className="px-2 py-1 text-left">Name</th><th className="px-2 py-1 text-left">Type</th><th className="px-2 py-1 text-left">Balance</th></tr></thead><tbody>{allAccounts.map(account => (<tr key={account.account_id || account.id} className="border-b last:border-b-0 hover:bg-[var(--color-surface-alt)] transition"><td className="px-2 py-1">{account.name}</td><td className="px-2 py-1 capitalize">{account.type || 'other'}</td><td className={`px-2 py-1 ${liabilityTypes.includes(account.type) || (account.subtype && liabilityTypes.includes(account.subtype)) ? 'text-[var(--color-danger)]' : 'text-[var(--color-primary)]'}`}>${(account.balances?.current ?? account.balance ?? 0).toLocaleString(undefined, {maximumFractionDigits: 2})}</td></tr>))}{allAccounts.length === 0 && (<tr><td colSpan="3" className="px-2 py-4 text-center text-[var(--color-muted)]">No accounts.</td></tr>)}</tbody></table></div></div>)}
            {tab === 'details' && <div>[Detailed Balance Sheet Table Placeholder]</div>}
            {tab === 'historical' && <div>[Historical Balance Sheet Table Placeholder]</div>}
          </div>
        </>
      )}
    </div>
  );
}

function AccountsPage() {
  const { accounts: plaidAccounts, loading: plaidLoading, error: plaidError, refetchData, user } = usePlaid();
  const [manualAccounts, setManualAccounts] = useState([]);
  const [linkToken, setLinkToken] = useState(null);
  const [plaidLinkError, setPlaidLinkError] = useState('');
  const [showManualModal, setShowManualModal] = useState(false);
  const dbClient = getFirestore();

  useEffect(() => {
    if (user && !linkToken && !plaidLinkError) {
      fetch('http://localhost:5001/api/create_link_token', { method: 'POST', headers: { 'Content-Type': 'application/json' }})
      .then(res => { if (!res.ok) {setPlaidLinkError(`HTTP error ${res.status}`); throw new Error(`HTTP error! status: ${res.status}`);} return res.json(); })
      .then(data => { if (data.link_token) setLinkToken(data.link_token); else {setPlaidLinkError(data.error?.error_message || data.error?.message || data.error || 'Failed to get Plaid link token'); throw new Error(data.error?.error_message || data.error?.message || data.error || 'Failed to get Plaid link token');}})
      .catch(err => { console.error("Error fetching link token for AccountsPage:", err); if(!plaidLinkError) setPlaidLinkError(`Plaid Link init failed. Try again.`); });
    }
  }, [user, linkToken, plaidLinkError]);

  const fetchManualAccounts = async (userId) => {
    if (!userId) { setManualAccounts([]); return; }
    const q = query(collection(dbClient, 'manual_accounts'), where('user_id', '==', userId));
    try { const querySnapshot = await getDocs(q); const accs = []; querySnapshot.forEach(doc => accs.push({ ...doc.data(), id: doc.id })); setManualAccounts(accs); }
    catch (err) { console.error("Error fetching manual accounts for AccountsPage:", err); }
  };
  useEffect(() => { if (user) fetchManualAccounts(user.uid); else setManualAccounts([]); }, [user]);

  const handlePlaidSuccess = async (public_token) => {
    setPlaidLinkError('');
    try {
      const exchangeRes = await fetch('http://localhost:5001/api/exchange_public_token', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ public_token }) });
      if (!exchangeRes.ok) throw new Error(`Token exchange HTTP error! status: ${exchangeRes.status}`);
      const exchangeData = await exchangeRes.json();
      if (user && exchangeData.access_token) {
        const saveTokenRes = await fetch('http://localhost:5001/api/save_access_token', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: user.uid, access_token: exchangeData.access_token }) });
        if(!saveTokenRes.ok) throw new Error(`Save access token HTTP error! status: ${saveTokenRes.status}`);
        await refetchData();
        setLinkToken(null);
      } else if (exchangeData.error) { throw new Error(exchangeData.error.error_message || exchangeData.error.error_code || 'Plaid token exchange error'); }
      else { throw new Error('Unknown error during Plaid token exchange.'); }
    } catch (err) { console.error("Plaid success/exchange error in AccountsPage:", err); setPlaidLinkError(`Linking failed: ${err.message}. Please try again.`); }
  };
  
  const allAccounts = [...(plaidAccounts || []), ...manualAccounts];
  const liabilityTypes = ['credit', 'loan', 'mortgage']; 
  const netWorth = allAccounts.reduce((sum, acc) => { const bal = acc.balances?.current ?? acc.balance ?? 0; return liabilityTypes.includes(acc.type) || (acc.subtype && liabilityTypes.includes(acc.subtype)) ? sum - Math.abs(bal) : sum + bal; }, 0);
  const accountsByType = allAccounts.reduce((acc, account) => { const type = account.type || 'other'; acc[type] = acc[type] || []; acc[type].push(account); return acc; }, {});

  if (plaidLoading && !plaidAccounts && !plaidError) return <Spinner />;

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-3xl font-bold mb-4">Accounts</h1>
      {plaidLinkError && !linkToken && <div className="text-red-500 text-center p-4">Linking Error: {plaidLinkError} <button className="link-action underline ml-2" onClick={() => {setLinkToken(null); setPlaidLinkError('');}}>Retry</button></div>}
      {!user && !plaidLoading && <p className="text-center text-gray-500">Please log in.</p>}
      {user && (
        <>
          <div className="card flex flex-col items-center justify-center max-w-md mx-auto"><h2 className="text-lg font-semibold text-[var(--color-muted)] mb-2">Net Worth</h2><div className="text-3xl font-bold text-[var(--color-primary)]">${netWorth.toLocaleString(undefined, {maximumFractionDigits: 2})}</div></div>
          <div className="flex gap-2 mb-4">
            {linkToken && (<PlaidLink token={linkToken} onSuccess={handlePlaidSuccess}><button className="link-action">+ Add Bank Account</button></PlaidLink>)}
            <button onClick={() => setShowManualModal(true)} className="link-action">+ Add Manual Account</button>
          </div>
          <div className="card"><h2 className="text-lg font-semibold text-[var(--color-primary-dark)] mb-4">All Accounts</h2><div className="overflow-x-auto"><table className="min-w-full text-sm"><thead><tr><th className="px-2 py-1 text-left">Type</th><th className="px-2 py-1 text-left">Name</th><th className="px-2 py-1 text-left">Balance</th></tr></thead><tbody>{Object.entries(accountsByType).map(([type, accountList]) => (<React.Fragment key={type}>{accountList.map(account => (<tr key={account.account_id || account.id} className="border-b last:border-b-0 hover:bg-[var(--color-surface-alt)] transition"><td className="px-2 py-1 font-semibold capitalize">{type}</td><td className="px-2 py-1">{account.name}</td><td className="px-2 py-1">${(account.balances?.current ?? account.balance ?? 0).toLocaleString(undefined, {maximumFractionDigits: 2})}</td></tr>))}</React.Fragment>))}{allAccounts.length === 0 && (<tr><td colSpan="3" className="px-2 py-4 text-center text-[var(--color-muted)]">No accounts.</td></tr>)}</tbody></table></div></div>
        </>
      )}
      <ManualAccountModal user={user} show={showManualModal} onClose={() => setShowManualModal(false)} onAccountAdded={() => fetchManualAccounts(user?.uid)} />
    </div>
  );
}

function InvestmentAllocationPage() {
  const { accounts: plaidAccounts, loading: plaidLoading, error: plaidError, user } = usePlaid();
  const [manualAccounts, setManualAccounts] = useState([]);
  const dbClient = getFirestore();
  const [tab, setTab] = useState('summary');

  const fetchManualAccounts = async (userId) => {
    if (!userId) { setManualAccounts([]); return; }
    const q = query(collection(dbClient, 'manual_accounts'), where('user_id', '==', userId));
    try { const querySnapshot = await getDocs(q); const accs = []; querySnapshot.forEach(doc => accs.push({ ...doc.data(), id: doc.id })); setManualAccounts(accs); }
    catch (err) { console.error("Error fetching manual accounts for Inv. Allocation:", err); }
  };
  useEffect(() => { if (user) fetchManualAccounts(user.uid); else setManualAccounts([]); }, [user]);
  
  const allAccounts = [...(plaidAccounts || []), ...manualAccounts];
  const investmentAccounts = allAccounts.filter(account => account.type === 'investment');
  const investmentAllocation = Object.values(investmentAccounts.reduce((acc, account) => { const subtype = account.subtype || account.type || 'other'; const balance = typeof account.balances?.current === 'number' ? account.balances.current : (typeof account.balance === 'number' ? account.balance : 0); acc[subtype] = acc[subtype] || { name: subtype, value: 0 }; acc[subtype].value += balance; return acc; }, {})).filter(item => item.value > 0);

  if (plaidLoading && !plaidAccounts && !plaidError) return <Spinner />;

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-3xl font-bold mb-4">Investment Allocation</h1>
      {!user && !plaidLoading && <p className="text-center text-gray-500">Please log in.</p>}
      {user && (
         <>
          <div className="flex gap-2 mb-4"><button className={`link-action${tab === 'summary' ? ' underline' : ''}`} onClick={() => setTab('summary')}>Summary</button><button className={`link-action${tab === 'detail' ? ' underline' : ''}`} onClick={() => setTab('detail')}>Detail (WIP)</button></div>
          {tab === 'summary' && (<div className="card flex flex-col items-center justify-center min-h-[380px]"><h2 className="text-lg font-semibold text-[var(--color-muted)] mb-2">Investment Allocation Summary</h2>{investmentAllocation.length > 0 ? (<div className="w-full flex justify-center"><div className="w-full min-w-[350px] max-w-[600px] h-[320px]"><ResponsiveContainer width="100%" height={320}><PieChart><Pie data={investmentAllocation} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={110} fill="var(--color-primary)" label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`} labelLine={false}>{investmentAllocation.map((entry, index) => (<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />))}</Pie><Tooltip /><Legend layout="vertical" align="right" verticalAlign="middle" /></PieChart></ResponsiveContainer></div></div>) : (<div className="w-full h-full flex items-center justify-center text-[var(--color-muted)]">No investment accounts.</div>)}</div>)}
          {tab === 'detail' && (<div className="card"><h2 className="text-lg font-semibold text-[var(--color-muted)] mb-2">Asset Allocation Detail</h2><div className="w-full h-72 flex items-center justify-center text-[var(--color-muted)]">[Detail Chart/Table Placeholder]</div></div>)}
         </>
       )}
    </div>
  );
}

function HoldingsPage() {
  const { accounts: plaidGlobalAccounts, loading: plaidGlobalLoading, error: plaidGlobalError, user } = usePlaid();
  const [holdings, setHoldings] = useState([]);
  const [loadingHoldings, setLoadingHoldings] = useState(false);
  const [errorHoldings, setErrorHoldings] = useState(null);
  const [manualAccountsForNaming, setManualAccountsForNaming] = useState([]);
  const dbClient = getFirestore();

  const fetchManualAccountsForNames = async (userId) => {
    if (!userId) { setManualAccountsForNaming([]); return; }
    const q = query(collection(dbClient, 'manual_accounts'), where('user_id', '==', userId));
    try { const querySnapshot = await getDocs(q); const accs = []; querySnapshot.forEach(doc => accs.push({ ...doc.data(), id: doc.id })); setManualAccountsForNaming(accs); }
    catch (err) { console.error("Error fetching manual accounts for Holdings names:", err); }
  };

  const fetchHoldingsData = async (userId) => {
    if (!userId) { setHoldings([]); return; }
    setLoadingHoldings(true); setErrorHoldings(null);
    try {
      console.log('Fetching tokens for user_id:', userId);
      const doc = await dbClient.collection('user_tokens').doc(userId).get();
      console.log('Firestore document:', doc);
      if (!doc.exists) {
        console.error('No document found for user_id:', userId);
        return res.status(404).json({ error: 'No tokens found for this user' });
      }
      const tokensRes = await fetch(`http://localhost:5001/api/access_tokens?user_id=${userId}`);
      if(!tokensRes.ok) throw new Error(`Failed to fetch access tokens: HTTP ${tokensRes.status}`);
      const tokenData = await tokensRes.json(); 
      const accessTokens = tokenData?.tokens; 

      if (!accessTokens || accessTokens.length === 0) { setHoldings([]); setLoadingHoldings(false); return; }
      
      let allHoldings = [];
      for (const tokenObj of accessTokens) {
        const accessToken = tokenObj.access_token; 
        if (!accessToken) continue;

        const holdingsRes = await fetch('http://localhost:5001/api/holdings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ access_token: accessToken }) });
        if(!holdingsRes.ok) { console.warn(`Failed to fetch holdings for a token: HTTP ${holdingsRes.status}`); continue; }
        const data = await holdingsRes.json();
        if (data.holdings) { allHoldings = [...allHoldings, ...data.holdings.filter(h => !allHoldings.some(existing => existing.security_id === h.security_id && existing.account_id === h.account_id))]; }
      }
      setHoldings(allHoldings);
    } catch (err) { console.error("Error fetching holdings data:", err); setErrorHoldings(err.message || 'Failed to fetch holdings.'); }
    setLoadingHoldings(false);
  };

  useEffect(() => { if (user) { fetchHoldingsData(user.uid); fetchManualAccountsForNames(user.uid); } else { setHoldings([]); setManualAccountsForNaming([]); }}, [user]);
  
  const allAccountsForNaming = [...(plaidGlobalAccounts || []), ...manualAccountsForNaming];
  const accountIdToName = Object.fromEntries(allAccountsForNaming.map(acc => [acc.account_id || acc.id, acc.name]));
  const isLoading = plaidGlobalLoading || loadingHoldings;
  const displayError = plaidGlobalError || errorHoldings;

  if (isLoading && !holdings.length && !displayError) return <Spinner />;

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-3xl font-bold mb-4">Holdings</h1>
      {displayError && <div className="text-red-500 text-center p-4">Error: {displayError}</div>}
      {!user && !isLoading && <p className="text-center text-gray-500">Please log in.</p>}
      {user && (
         <>
          <div className="card"><h2 className="text-lg font-semibold text-[var(--color-primary-dark)] mb-4">All Holdings</h2><div className="overflow-x-auto"><table className="min-w-full text-sm"><thead><tr><th className="px-2 py-1 text-left">Name</th><th className="px-2 py-1 text-left">Ticker</th><th className="px-2 py-1 text-left">Account</th><th className="px-2 py-1 text-right">Quantity</th><th className="px-2 py-1 text-right">Cost Basis</th><th className="px-2 py-1 text-right">Market Value</th><th className="px-2 py-1 text-left text-[var(--color-muted)]">Performance (WIP)</th></tr></thead><tbody>
            {holdings.length > 0 ? (holdings.map(holding => (<tr key={`holding-${holding.account_id}-${holding.security_id}`} className="border-b last:border-b-0 hover:bg-[var(--color-surface-alt)] transition cursor-pointer"><td className="px-2 py-1">{holding.security?.name || 'N/A'}</td><td className="px-2 py-1">{holding.security?.ticker_symbol || 'N/A'}</td><td className="px-2 py-1">{accountIdToName[holding.account_id] || holding.account_id}</td><td className="px-2 py-1 text-right">{(holding.quantity || 0).toLocaleString()}</td><td className="px-2 py-1 text-right">${(holding.cost_basis !== null && holding.cost_basis !== undefined) ? holding.cost_basis.toLocaleString(undefined, {maximumFractionDigits: 2}) : 'N/A'}</td><td className="px-2 py-1 text-right">${(holding.market_value || 0).toLocaleString(undefined, {maximumFractionDigits: 2})}</td><td className="px-2 py-1 text-left text-[var(--color-muted)]">[N/A]</td></tr>)))
            : (<tr><td colSpan="7" className="px-2 py-4 text-center text-[var(--color-muted)]">No holdings data.</td></tr>)}
          </tbody></table></div></div>
          <div className="card"><h2 className="text-lg font-semibold text-[var(--color-muted)] mb-2">Performance Graph (WIP)</h2><div className="w-full h-72 flex items-center justify-center text-[var(--color-muted)]">[Performance Graph Placeholder]</div></div>
         </>
       )}
    </div>
  );
}

function SnapshotPage() {
  const { accounts: plaidAccounts, loading: plaidLoading, error: plaidError, user } = usePlaid();
  const [manualAccounts, setManualAccounts] = useState([]);
  const dbClient = getFirestore();

  const fetchManualAccounts = async (userId) => {
    if (!userId) { setManualAccounts([]); return; }
    const q = query(collection(dbClient, 'manual_accounts'), where('user_id', '==', userId));
    try { const querySnapshot = await getDocs(q); const accs = []; querySnapshot.forEach(doc => accs.push({ ...doc.data(), id: doc.id })); setManualAccounts(accs); }
    catch (err) { console.error("Error fetching manual accounts for Snapshot:", err); }
  };
  useEffect(() => { if (user) fetchManualAccounts(user.uid); else setManualAccounts([]); }, [user]);

  const allAccounts = [...(plaidAccounts || []), ...manualAccounts];
  const liabilityTypes = ['credit', 'loan', 'mortgage'];
  const netWorth = allAccounts.reduce((sum, acc) => { const bal = acc.balances?.current ?? acc.balance ?? 0; return liabilityTypes.includes(acc.type) || (acc.subtype && liabilityTypes.includes(acc.subtype)) ? sum - Math.abs(bal) : sum + bal; }, 0);
  const allocation = Object.values(allAccounts.reduce((acc, account) => { const type = account.type || 'other'; const balance = typeof account.balances?.current === 'number' ? account.balances.current : (typeof account.balance === 'number' ? account.balance : 0); acc[type] = acc[type] || { name: type, value: 0 }; acc[type].value += balance; return acc; }, {})).filter(item => item.value > 0);

  if (plaidLoading && !plaidAccounts && !plaidError) return <Spinner />;

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-3xl font-bold mb-4">Snapshot</h1>
      {!user && !plaidLoading && <p className="text-center text-gray-500">Please log in.</p>}
      {user && (
         <>
           <div className="card flex flex-col items-center justify-center"><h2 className="text-lg font-semibold text-[var(--color-muted)] mb-2">Net Worth</h2><div className="text-4xl font-bold text-[var(--color-primary)]">${netWorth.toLocaleString(undefined, {maximumFractionDigits: 2})}</div></div>
           <div className="card flex flex-col items-center justify-center md:col-span-2 min-h-[380px]"><h2 className="text-lg font-semibold text-[var(--color-muted)] mb-2">Asset Allocation</h2>{allocation.length > 0 ? (<div className="w-full flex justify-center"><div className="w-full min-w-[350px] max-w-[600px] h-[320px]"><ResponsiveContainer width="100%" height={320}><PieChart><Pie data={allocation} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={110} fill="var(--color-primary)" label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`} labelLine={false}>{allocation.map((entry, index) => (<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />))}</Pie><Tooltip /><Legend layout="vertical" align="right" verticalAlign="middle" /></PieChart></ResponsiveContainer></div></div>) : <p className="text-gray-500">No allocation data.</p>}</div>
           <div className="card flex flex-col items-center justify-center bg-[var(--color-surface-alt)]"><h2 className="text-lg font-semibold text-[var(--color-muted)] mb-2">Income/Expenses (WIP)</h2><div className="w-full h-32 flex items-center justify-center text-[var(--color-primary-light)]">Chart placeholder</div></div>
         </>
       )}
    </div>
  );
}

// RootApp is the entry point
export default function RootApp() {
  return (
    <PlaidDataProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<LoginWrapper />} />
          <Route path="/*" element={<ProtectedRoutes />} /> 
        </Routes>
      </Router>
    </PlaidDataProvider>
  );
}

// Wrapper to handle login logic
function LoginWrapper() {
  const { user, loading } = usePlaid(); 
  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try { await signInWithPopup(auth, provider); } catch (err) { console.error("Login error:", err); alert(err.message); }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Spinner /></div>; 
  if (user) return <Navigate to="/" replace />; 
  return <LoginCard onLogin={handleGoogleLogin} />;
}

// Wrapper for protected routes that require authentication
function ProtectedRoutes() {
  const { user, loading } = usePlaid();

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Spinner /></div>;
  if (!user) return <Navigate to="/login" replace />; 

  return (
    <MainLayout> 
      <Routes> 
        <Route path="/" element={<DashboardPage />} />
        <Route path="/snapshot" element={<SnapshotPage />} />
        <Route path="/balance-sheet" element={<BalanceSheetPage />} />
        <Route path="/accounts" element={<AccountsPage />} />
        <Route path="/investment-allocation" element={<InvestmentAllocationPage />} />
        <Route path="/holdings" element={<HoldingsPage />} />
        <Route path="*" element={<Navigate to="/" />} /> 
      </Routes>
    </MainLayout>
  );
}
