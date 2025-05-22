import { useEffect, useState } from 'react';
import { PlaidLink } from 'react-plaid-link';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import './App.css';
import { auth } from './firebase';
import { GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { collection, addDoc, getDocs, query, where } from 'firebase/firestore';
import { getFirestore } from 'firebase/firestore';
import { Bars3Icon, XMarkIcon, HomeIcon, CreditCardIcon, ListBulletIcon, Cog6ToothIcon } from '@heroicons/react/24/outline';
import { BrowserRouter as Router, Routes, Route, Navigate, Link } from 'react-router-dom';

const COLORS = ['#6366F1', '#A78BFA', '#F472B6', '#34D399', '#FBBF24', '#60A5FA'];
const ACCOUNT_TYPE_COLORS = {
  depository: 'bg-blue-200 text-blue-800',
  credit: 'bg-purple-200 text-purple-800',
  loan: 'bg-green-200 text-green-800',
  investment: 'bg-yellow-200 text-yellow-800',
  other: 'bg-gray-200 text-gray-800',
};

function App() {
  const [linkToken, setLinkToken] = useState(null);
  const [accessToken, setAccessToken] = useState(() => localStorage.getItem('access_token'));
  const [accounts, setAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [showPlaidLink, setShowPlaidLink] = useState(false);
  const [user, setUser] = useState(null);
  const [fetchingNewAccount, setFetchingNewAccount] = useState(false);
  const [fetchingError, setFetchingError] = useState('');
  const [manualAccounts, setManualAccounts] = useState([]);
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualForm, setManualForm] = useState({ name: '', type: '', subtype: '', balance: '' });
  const [manualError, setManualError] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navLinks = [
    { name: 'Dashboard', icon: HomeIcon },
    { name: 'Accounts', icon: CreditCardIcon },
    { name: 'Transactions', icon: ListBulletIcon },
    { name: 'Settings', icon: Cog6ToothIcon },
  ];
  const [activePage, setActivePage] = useState('Dashboard');

  const dbClient = getFirestore();

  // Firebase auth state listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  // Fetch link token on mount or when linking another account
  useEffect(() => {
    if (!showPlaidLink && accessToken) return;
    fetch('http://localhost:5001/api/create_link_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })
      .then(res => res.json())
      .then(data => setLinkToken(data.link_token));
  }, [accessToken, showPlaidLink]);

  // Fetch all access tokens for the user and load all accounts/transactions
  const fetchAllUserData = async (userId) => {
    const tokensRes = await fetch(`http://localhost:5001/api/access_tokens?user_id=${userId}`);
    const { tokens } = await tokensRes.json();
    let allAccounts = [];
    let allTransactions = [];
    for (const token of tokens) {
      const [accountsRes, transactionsRes] = await Promise.all([
        fetch('http://localhost:5001/api/accounts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ access_token: token }),
        }).then(res => res.json()),
        fetch('http://localhost:5001/api/transactions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ access_token: token }),
        }).then(res => res.json()),
      ]);
      // Merge accounts (by account_id)
      allAccounts = [
        ...allAccounts,
        ...(accountsRes.accounts || []).filter(
          acc => !allAccounts.some(existing => existing.account_id === acc.account_id)
        ),
      ];
      // Merge transactions (by transaction_id)
      allTransactions = [
        ...allTransactions,
        ...(transactionsRes.transactions || []).filter(
          txn => !allTransactions.some(existing => existing.transaction_id === txn.transaction_id)
        ),
      ];
    }
    setAccounts(allAccounts);
    setTransactions(allTransactions);
  };

  // Fetch manual accounts for the user
  const fetchManualAccounts = async (userId) => {
    const q = query(collection(dbClient, 'manual_accounts'), where('user_id', '==', userId));
    const querySnapshot = await getDocs(q);
    const accounts = [];
    querySnapshot.forEach(doc => accounts.push({ ...doc.data(), id: doc.id }));
    setManualAccounts(accounts);
  };

  // On user login, fetch all their accounts/transactions and manual accounts
  useEffect(() => {
    if (user) {
      setLoading(true);
      fetchAllUserData(user.uid).finally(() => setLoading(false));
      fetchManualAccounts(user.uid);
    } else {
      setAccounts([]);
      setTransactions([]);
      setManualAccounts([]);
    }
    // eslint-disable-next-line
  }, [user, startDate, endDate]);

  // Merge Plaid and manual accounts for display and net worth
  const allAccounts = [...accounts, ...manualAccounts];

  // Calculate net worth (subtract liabilities)
  const liabilityTypes = ['credit', 'loan', 'mortgage'];
  const netWorth = allAccounts.reduce((sum, acc) => {
    const bal = acc.balances?.current ?? acc.balance ?? 0;
    if (liabilityTypes.includes(acc.type) || (acc.subtype && liabilityTypes.includes(acc.subtype))) {
      return sum - Math.abs(bal);
    }
    return sum + bal;
  }, 0);

  // Prepare asset allocation data
  const allocation = Object.values(
    allAccounts.reduce((acc, account) => {
      const type = account.type || 'other';
      acc[type] = acc[type] || { name: type, value: 0 };
      acc[type].value += account.balances?.current || 0;
      return acc;
    }, {})
  );

  // Map account_id to account name for quick lookup
  const accountIdToName = Object.fromEntries(allAccounts.map(acc => [acc.account_id || acc.id, acc.name]));

  // Handle Plaid Link success
  const handlePlaidSuccess = async (public_token, metadata) => {
    setFetchingNewAccount(true);
    setFetchingError('');
    try {
      const res = await fetch('http://localhost:5001/api/exchange_public_token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ public_token }),
      });
      const data = await res.json();
      if (user && data.access_token) {
        await fetch('http://localhost:5001/api/save_access_token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: user.uid, access_token: data.access_token }),
        });

        // Retry fetching transactions up to 5 times, 2s apart
        let accountsRes, transactionsRes, success = false;
        for (let i = 0; i < 5; i++) {
          [accountsRes, transactionsRes] = await Promise.all([
            fetch('http://localhost:5001/api/accounts', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ access_token: data.access_token }),
            }).then(res => res.json()),
            fetch('http://localhost:5001/api/transactions', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ access_token: data.access_token }),
            }).then(res => res.json()),
          ]);
          if (!transactionsRes.error || transactionsRes.error.error_code !== 'PRODUCT_NOT_READY') {
            success = true;
            break;
          }
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
        if (!success) {
          setFetchingError('Transactions for this account are not ready yet. Please try again in a minute.');
        } else {
          setAccounts(prev => [
            ...prev,
            ...(accountsRes.accounts || []).filter(
              acc => !prev.some(existing => existing.account_id === acc.account_id)
            ),
          ]);
          setTransactions(prev => [
            ...prev,
            ...(transactionsRes.transactions || []).filter(
              txn => !prev.some(existing => existing.transaction_id === txn.transaction_id)
            ),
          ]);
        }
      }
    } catch (err) {
      setFetchingError('An error occurred while fetching your new account.');
    }
    setFetchingNewAccount(false);
    setShowPlaidLink(false);
  };

  // Google login handler
  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (err) {
      alert(err.message);
    }
  };

  // Logout handler (Firebase)
  const handleLogout = async () => {
    await signOut(auth);
    setAccessToken(null);
    setAccounts([]);
    setTransactions([]);
    localStorage.removeItem('access_token');
  };

  // Filter transactions by search
  const filteredTransactions = transactions.filter(txn => {
    const searchLower = search.toLowerCase();
    return (
      txn.name.toLowerCase().includes(searchLower) ||
      (accountIdToName[txn.account_id] || '').toLowerCase().includes(searchLower) ||
      txn.amount.toString().includes(searchLower)
    );
  });

  // Loading spinner
  const Spinner = () => (
    <div className="flex justify-center items-center h-32">
      <svg className="animate-spin h-8 w-8 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
      </svg>
    </div>
  );

  // Modern login card with Google login only
  const LoginCard = () => (
    <div className="flex flex-col items-center justify-center min-h-[80vh]">
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
          onClick={handleGoogleLogin}
        >
          <img src="https://upload.wikimedia.org/wikipedia/commons/4/4a/Logo_2013_Google.png" alt="Google" className="w-5 h-5" />
          Sign in with Google
        </button>
      </div>
    </div>
  );

  // Manual account modal and form
  const ManualAccountModal = () => (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-lg p-8 w-full max-w-md mx-auto">
        <h2 className="text-xl font-bold mb-4 text-blue-800">Add Manual Account</h2>
        <form onSubmit={async e => {
          e.preventDefault();
          setManualError('');
          if (!manualForm.name || !manualForm.type || !manualForm.balance) {
            setManualError('Name, type, and balance are required.');
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
            setShowManualModal(false);
            setManualForm({ name: '', type: '', subtype: '', balance: '' });
            fetchManualAccounts(user.uid);
          } catch (err) {
            setManualError('Failed to add manual account.');
          }
        }} className="flex flex-col gap-3">
          <input type="text" placeholder="Account Name" className="border rounded px-3 py-2" value={manualForm.name} onChange={e => setManualForm(f => ({ ...f, name: e.target.value }))} />
          <select className="border rounded px-3 py-2" value={manualForm.type} onChange={e => setManualForm(f => ({ ...f, type: e.target.value }))}>
            <option value="">Select Type</option>
            <option value="depository">Asset (Checking/Savings)</option>
            <option value="investment">Investment</option>
            <option value="credit">Credit Card</option>
            <option value="loan">Loan</option>
            <option value="mortgage">Mortgage</option>
            <option value="other">Other</option>
          </select>
          <input type="text" placeholder="Subtype (optional)" className="border rounded px-3 py-2" value={manualForm.subtype} onChange={e => setManualForm(f => ({ ...f, subtype: e.target.value }))} />
          <input type="number" step="any" placeholder="Balance" className="border rounded px-3 py-2" value={manualForm.balance} onChange={e => setManualForm(f => ({ ...f, balance: e.target.value }))} />
          {manualError && <div className="text-red-600 text-sm">{manualError}</div>}
          <div className="flex gap-2 mt-2">
            <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg px-4 py-2 transition">Add</button>
            <button type="button" className="bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg px-4 py-2 transition" onClick={() => setShowManualModal(false)}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-[var(--color-bg)] to-[var(--color-surface-alt)]">
      {/* Sidebar */}
      <aside className="card w-60 min-h-screen flex flex-col justify-between border border-[var(--color-border)] bg-white mr-12 mt-8 ml-8" style={{ boxShadow: 'none', borderRadius: '8px' }}>
        <div>
          <div className="flex items-center gap-3 mb-10 mt-2 pl-2">
            <img src="/logo.png" alt="Logo" className="w-10 h-10 rounded-md" />
            <span className="text-2xl font-bold text-[var(--color-primary)] tracking-tight">Finance</span>
          </div>
          <nav className="flex flex-col gap-1">
            {navLinks.map(link => (
              <button
                key={link.name}
                className={`flex items-center gap-3 px-4 py-2 font-medium transition text-base ${activePage === link.name ? 'bg-[var(--color-primary-light)] text-[var(--color-primary)]' : 'text-[var(--color-muted)] hover:bg-[var(--color-surface-alt)]'}`}
                style={{ borderRadius: '6px', fontWeight: activePage === link.name ? 700 : 500 }}
                onClick={() => { setActivePage(link.name); setSidebarOpen(false); }}
              >
                <link.icon className="h-5 w-5" />
                {link.name}
              </button>
            ))}
          </nav>
        </div>
        <div className="mb-6 pl-2">
          <button onClick={handleLogout} className="link-action">Log out</button>
        </div>
      </aside>
      {/* Main Content */}
      <main className="flex-1 flex flex-col gap-8 mt-8 mr-8">
        <header className="flex items-center justify-between mb-8">
          <h1 className="text-4xl font-bold text-[var(--color-text)]">{activePage}</h1>
          <div className="flex gap-2">
            {user && linkToken && activePage === 'Dashboard' && (
              <>
                <PlaidLink
                  token={linkToken}
                  onSuccess={handlePlaidSuccess}
                  onExit={() => {}}
                >
                  <span className="link-action">+ Add Account</span>
                </PlaidLink>
                <button
                  onClick={() => setShowManualModal(true)}
                  className="link-action"
                >
                  + Add Manual Account
                </button>
              </>
            )}
          </div>
        </header>
        {/* Dashboard Cards */}
        {activePage === 'Dashboard' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="card flex flex-col items-center justify-center" style={{ borderRadius: '8px', boxShadow: 'none' }}>
              <h2 className="text-lg font-semibold text-[var(--color-muted)] mb-2">Net Worth</h2>
              <div className="text-4xl font-bold text-[var(--color-primary)]">${netWorth.toLocaleString(undefined, {maximumFractionDigits: 2})}</div>
            </div>
            <div className="card flex flex-col items-center justify-center md:col-span-2" style={{ borderRadius: '8px', minHeight: '380px', boxShadow: 'none', minWidth: 400, maxWidth: 900 }}>
              <h2 className="text-lg font-semibold text-[var(--color-muted)] mb-2">Asset Allocation</h2>
              <div className="w-full flex justify-center">
                <div className="w-full" style={{ minWidth: 350, maxWidth: 600, height: 320 }}>
                  <ResponsiveContainer width="100%" height={320}>
                    <PieChart>
                      <Pie
                        data={allocation}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={110}
                        fill="var(--color-primary)"
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
                        labelLine={false}
                      >
                        {allocation.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend layout="vertical" align="right" verticalAlign="middle" />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
            <div className="card flex flex-col items-center justify-center bg-[var(--color-surface-alt)]" style={{ borderRadius: '8px', boxShadow: 'none' }}>
              <h2 className="text-lg font-semibold text-[var(--color-muted)] mb-2">Cash Flow (Coming Soon)</h2>
              <div className="w-full h-32 flex items-center justify-center text-[var(--color-primary-light)]">Bar chart placeholder</div>
            </div>
          </div>
        )}
        {/* Recent Transactions */}
        {activePage === 'Dashboard' && (
          <div className="card">
            <h2 className="text-lg font-semibold text-[var(--color-primary-dark)] mb-4">Recent Transactions</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="sticky top-0 bg-[var(--color-surface)]">
                  <tr>
                    <th className="px-2 py-1 text-left">Date</th>
                    <th className="px-2 py-1 text-left">Name</th>
                    <th className="px-2 py-1 text-left">Amount</th>
                    <th className="px-2 py-1 text-left">Account</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTransactions.slice(0, 10).map(txn => (
                    <tr key={txn.transaction_id} className="border-b last:border-b-0 hover:bg-[var(--color-surface-alt)] transition">
                      <td className="px-2 py-1">{txn.date}</td>
                      <td className="px-2 py-1">{txn.name}</td>
                      <td className="px-2 py-1">${txn.amount.toLocaleString(undefined, {maximumFractionDigits: 2})}</td>
                      <td className="px-2 py-1">{accountIdToName[txn.account_id] || txn.account_id}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {/* Other Pages (Accounts, Transactions, Settings) can be refactored similarly */}
        {showManualModal && <ManualAccountModal />}
      </main>
    </div>
  );
}

function DashboardContent(props) {
  // Real data logic from App
  const [linkToken, setLinkToken] = useState(null);
  const [accessToken, setAccessToken] = useState(() => localStorage.getItem('access_token'));
  const [accounts, setAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [showPlaidLink, setShowPlaidLink] = useState(false);
  const [user, setUser] = useState(null);
  const [fetchingNewAccount, setFetchingNewAccount] = useState(false);
  const [fetchingError, setFetchingError] = useState('');
  const [manualAccounts, setManualAccounts] = useState([]);
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualForm, setManualForm] = useState({ name: '', type: '', subtype: '', balance: '' });
  const [manualError, setManualError] = useState('');
  const dbClient = getFirestore();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!showPlaidLink && accessToken) return;
    fetch('http://localhost:5001/api/create_link_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })
      .then(res => res.json())
      .then(data => setLinkToken(data.link_token));
  }, [accessToken, showPlaidLink]);

  const fetchAllUserData = async (userId) => {
    const tokensRes = await fetch(`http://localhost:5001/api/access_tokens?user_id=${userId}`);
    const { tokens } = await tokensRes.json();
    let allAccounts = [];
    let allTransactions = [];
    for (const token of tokens) {
      const [accountsRes, transactionsRes] = await Promise.all([
        fetch('http://localhost:5001/api/accounts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ access_token: token }),
        }).then(res => res.json()),
        fetch('http://localhost:5001/api/transactions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ access_token: token }),
        }).then(res => res.json()),
      ]);
      allAccounts = [
        ...allAccounts,
        ...(accountsRes.accounts || []).filter(
          acc => !allAccounts.some(existing => existing.account_id === acc.account_id)
        ),
      ];
      allTransactions = [
        ...allTransactions,
        ...(transactionsRes.transactions || []).filter(
          txn => !allTransactions.some(existing => existing.transaction_id === txn.transaction_id)
        ),
      ];
    }
    setAccounts(allAccounts);
    setTransactions(allTransactions);
  };

  const fetchManualAccounts = async (userId) => {
    const q = query(collection(dbClient, 'manual_accounts'), where('user_id', '==', userId));
    const querySnapshot = await getDocs(q);
    const accounts = [];
    querySnapshot.forEach(doc => accounts.push({ ...doc.data(), id: doc.id }));
    setManualAccounts(accounts);
  };

  useEffect(() => {
    if (user) {
      setLoading(true);
      fetchAllUserData(user.uid).finally(() => setLoading(false));
      fetchManualAccounts(user.uid);
    } else {
      setAccounts([]);
      setTransactions([]);
      setManualAccounts([]);
    }
    // eslint-disable-next-line
  }, [user, startDate, endDate]);

  const allAccounts = [...accounts, ...manualAccounts];
  const liabilityTypes = ['credit', 'loan', 'mortgage'];
  const netWorth = allAccounts.reduce((sum, acc) => {
    const bal = acc.balances?.current ?? acc.balance ?? 0;
    if (liabilityTypes.includes(acc.type) || (acc.subtype && liabilityTypes.includes(acc.subtype))) {
      return sum - Math.abs(bal);
    }
    return sum + bal;
  }, 0);

  const allocation = Object.values(
    allAccounts.reduce((acc, account) => {
      const type = account.type || 'other';
      acc[type] = acc[type] || { name: type, value: 0 };
      acc[type].value += account.balances?.current || 0;
      return acc;
    }, {})
  );

  const accountIdToName = Object.fromEntries(allAccounts.map(acc => [acc.account_id || acc.id, acc.name]));

  const handlePlaidSuccess = async (public_token, metadata) => {
    setFetchingNewAccount(true);
    setFetchingError('');
    try {
      const res = await fetch('http://localhost:5001/api/exchange_public_token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ public_token }),
      });
      const data = await res.json();
      if (user && data.access_token) {
        await fetch('http://localhost:5001/api/save_access_token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: user.uid, access_token: data.access_token }),
        });
        let accountsRes, transactionsRes, success = false;
        for (let i = 0; i < 5; i++) {
          [accountsRes, transactionsRes] = await Promise.all([
            fetch('http://localhost:5001/api/accounts', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ access_token: data.access_token }),
            }).then(res => res.json()),
            fetch('http://localhost:5001/api/transactions', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ access_token: data.access_token }),
            }).then(res => res.json()),
          ]);
          if (!transactionsRes.error || transactionsRes.error.error_code !== 'PRODUCT_NOT_READY') {
            success = true;
            break;
          }
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
        if (!success) {
          setFetchingError('Transactions for this account are not ready yet. Please try again in a minute.');
        } else {
          setAccounts(prev => [
            ...prev,
            ...(accountsRes.accounts || []).filter(
              acc => !prev.some(existing => existing.account_id === acc.account_id)
            ),
          ]);
          setTransactions(prev => [
            ...prev,
            ...(transactionsRes.transactions || []).filter(
              txn => !prev.some(existing => existing.transaction_id === txn.transaction_id)
            ),
          ]);
        }
      }
    } catch (err) {
      setFetchingError('An error occurred while fetching your new account.');
    }
    setFetchingNewAccount(false);
    setShowPlaidLink(false);
  };

  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setAccessToken(null);
    setAccounts([]);
    setTransactions([]);
    localStorage.removeItem('access_token');
  };

  const filteredTransactions = transactions.filter(txn => {
    const searchLower = search.toLowerCase();
    return (
      txn.name.toLowerCase().includes(searchLower) ||
      (accountIdToName[txn.account_id] || '').toLowerCase().includes(searchLower) ||
      txn.amount.toString().includes(searchLower)
    );
  });

  // Render the real dashboard content (as before, but with .link-action for buttons)
  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-3xl font-bold mb-4">Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="card flex flex-col items-center justify-center">
          <h2 className="text-lg font-semibold text-[var(--color-muted)] mb-2">Net Worth</h2>
          <div className="text-3xl font-bold text-[var(--color-primary)]">${netWorth.toLocaleString(undefined, {maximumFractionDigits: 2})}</div>
        </div>
        <div className="card flex flex-col items-center justify-center">
          <h2 className="text-lg font-semibold text-[var(--color-muted)] mb-2">Asset Allocation</h2>
          <div className="w-full h-64 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={allocation}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={60}
                  fill="var(--color-primary)"
                  label
                >
                  {allocation.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card flex flex-col items-center justify-center bg-[var(--color-surface-alt)]">
          <h2 className="text-lg font-semibold text-[var(--color-muted)] mb-2">Cash Flow (Coming Soon)</h2>
          <div className="w-full h-32 flex items-center justify-center text-[var(--color-primary-light)]">Bar chart placeholder</div>
        </div>
      </div>
      <div className="card">
        <h2 className="text-lg font-semibold text-[var(--color-primary-dark)] mb-4">Recent Transactions</h2>
        <div className="flex flex-col md:flex-row md:items-end md:justify-between mb-4 gap-4">
          <div className="flex gap-2 items-center flex-wrap">
            <label className="text-sm text-[var(--color-muted)]">Start:</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="border rounded px-2 py-1 text-sm" />
            <label className="text-sm text-[var(--color-muted)]">End:</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="border rounded px-2 py-1 text-sm" />
          </div>
          <div className="flex flex-col">
            <label className="text-sm text-[var(--color-muted)] mb-1">Search:</label>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name or amount"
              className="border rounded px-2 py-1 text-sm"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 bg-[var(--color-surface)]">
              <tr>
                <th className="px-2 py-1 text-left">Date</th>
                <th className="px-2 py-1 text-left">Name</th>
                <th className="px-2 py-1 text-left">Amount</th>
                <th className="px-2 py-1 text-left">Account</th>
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.slice(0, 10).map(txn => (
                <tr key={txn.transaction_id} className="border-b last:border-b-0 hover:bg-[var(--color-surface-alt)] transition">
                  <td className="px-2 py-1">{txn.date}</td>
                  <td className="px-2 py-1">{txn.name}</td>
                  <td className="px-2 py-1">${txn.amount.toLocaleString(undefined, {maximumFractionDigits: 2})}</td>
                  <td className="px-2 py-1">{accountIdToName[txn.account_id] || txn.account_id}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="flex gap-2 mb-4">
        {linkToken && (
          <PlaidLink
            token={linkToken}
            onSuccess={handlePlaidSuccess}
            onExit={() => {}}
          >
            <span className="link-action">+ Add Account</span>
          </PlaidLink>
        )}
        <button
          onClick={() => setShowManualModal(true)}
          className="link-action"
        >
          + Add Manual Account
        </button>
      </div>
      {showManualModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-lg p-8 w-full max-w-md mx-auto">
            <h2 className="text-xl font-bold mb-4 text-[var(--color-primary)]">Add Manual Account</h2>
            <form onSubmit={async e => {
              e.preventDefault();
              setManualError('');
              if (!manualForm.name || !manualForm.type || !manualForm.balance) {
                setManualError('Name, type, and balance are required.');
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
                setShowManualModal(false);
                setManualForm({ name: '', type: '', subtype: '', balance: '' });
                fetchManualAccounts(user.uid);
              } catch (err) {
                setManualError('Failed to add manual account.');
              }
            }} className="flex flex-col gap-3">
              <input type="text" placeholder="Account Name" className="border rounded px-3 py-2" value={manualForm.name} onChange={e => setManualForm(f => ({ ...f, name: e.target.value }))} />
              <select className="border rounded px-3 py-2" value={manualForm.type} onChange={e => setManualForm(f => ({ ...f, type: e.target.value }))}>
                <option value="">Select Type</option>
                <option value="depository">Asset (Checking/Savings)</option>
                <option value="investment">Investment</option>
                <option value="credit">Credit Card</option>
                <option value="loan">Loan</option>
                <option value="mortgage">Mortgage</option>
                <option value="other">Other</option>
              </select>
              <input type="text" placeholder="Subtype (optional)" className="border rounded px-3 py-2" value={manualForm.subtype} onChange={e => setManualForm(f => ({ ...f, subtype: e.target.value }))} />
              <input type="number" step="any" placeholder="Balance" className="border rounded px-3 py-2" value={manualForm.balance} onChange={e => setManualForm(f => ({ ...f, balance: e.target.value }))} />
              {manualError && <div className="text-red-600 text-sm">{manualError}</div>}
              <div className="flex gap-2 mt-2">
                <button type="submit" className="link-action">Add</button>
                <button type="button" className="link-action" onClick={() => setShowManualModal(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {fetchingNewAccount && (
        <div className="bg-[var(--color-primary-light)] text-[var(--color-primary-dark)] p-3 rounded mb-4 text-center">
          Fetching transactions for your new account… this may take a few seconds.
        </div>
      )}
      {fetchingError && (
        <div className="bg-[var(--color-danger)] text-white p-3 rounded mb-4 text-center">
          {fetchingError}
        </div>
      )}
      {error && <div className="bg-[var(--color-danger)] text-white p-2 rounded mb-4 text-center">{error}</div>}
      {loading && (
        <div className="flex justify-center items-center h-32">
          <svg className="animate-spin h-8 w-8 text-[var(--color-primary)]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
          </svg>
        </div>
      )}
    </div>
  );
}

function DashboardPage(props) { return <DashboardContent {...props} />; }

// Placeholder pages
function BalanceSheetPage() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [manualAccounts, setManualAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]); // Include transactions for potential future use (e.g., tracking changes)

  const dbClient = getFirestore();

  // Firebase auth state listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        setLoading(true);
        setError(null);
        // Fetch data when user is authenticated
        fetchAllUserData(currentUser.uid)
          .then(() => fetchManualAccounts(currentUser.uid))
          .catch(err => setError(err))
          .finally(() => setLoading(false));
      } else {
        setAccounts([]);
        setTransactions([]);
        setManualAccounts([]);
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  // --- Copy of data fetching functions from App (slightly modified to fetch transactions too) ---
  const fetchAllUserData = async (userId) => {
    const tokensRes = await fetch(`http://localhost:5001/api/access_tokens?user_id=${userId}`);
    const { tokens } = await tokensRes.json();
    let allAccounts = [];
    let allTransactions = [];
    for (const token of tokens) {
      const [accountsRes, transactionsRes] = await Promise.all([
        fetch('http://localhost:5001/api/accounts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ access_token: token }),
        }).then(res => res.json()),
        fetch('http://localhost:5001/api/transactions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ access_token: token }),
        }).then(res => res.json()),
      ]);
      allAccounts = [
        ...allAccounts,
        ...(accountsRes.accounts || []).filter(
          acc => !allAccounts.some(existing => existing.account_id === acc.account_id)
        ),
      ];
      allTransactions = [
        ...allTransactions,
        ...(transactionsRes.transactions || []).filter(
          txn => !allTransactions.some(existing => existing.transaction_id === txn.transaction_id)
        ),
      ];
    }
    setAccounts(allAccounts);
    setTransactions(allTransactions);
  };

  const fetchManualAccounts = async (userId) => {
    const q = query(collection(dbClient, 'manual_accounts'), where('user_id', '==', userId));
    const querySnapshot = await getDocs(q);
    const accounts = [];
    querySnapshot.forEach(doc => accounts.push({ ...doc.data(), id: doc.id }));
    setManualAccounts(accounts);
  };
  // --- End of copied functions ---

  // Merge Plaid and manual accounts
  const allAccounts = [...accounts, ...manualAccounts];

  // Calculate total assets and liabilities
  const liabilityTypes = ['credit', 'loan', 'mortgage'];
  const totalAssets = allAccounts.reduce((sum, acc) => {
    const bal = acc.balances?.current ?? acc.balance ?? 0;
    if (!liabilityTypes.includes(acc.type) && !(acc.subtype && liabilityTypes.includes(acc.subtype))) {
      return sum + bal;
    }
    return sum;
  }, 0);

  const totalLiabilities = allAccounts.reduce((sum, acc) => {
    const bal = acc.balances?.current ?? acc.balance ?? 0;
    if (liabilityTypes.includes(acc.type) || (acc.subtype && liabilityTypes.includes(acc.subtype))) {
      return sum + Math.abs(bal);
    }
    return sum;
  }, 0);

  const netWorth = totalAssets - totalLiabilities;

  const [tab, setTab] = useState('current');
  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-3xl font-bold mb-4">Balance Sheet</h1>
      {loading && <p>Loading Balance Sheet...</p>}
      {error && <p className="text-red-600">Error loading data: {error.message}</p>}
      {!loading && !error && (
        <>
          <div className="flex gap-2 mb-4">
             <button className={`link-action${tab === 'current' ? ' underline' : ''}`} onClick={() => setTab('current')}>Current</button>
             {/* Details and Historical tabs remain placeholders for now */}
             <button className={`link-action${tab === 'details' ? ' underline' : ''}`} onClick={() => setTab('details')}>Details (Coming Soon)</button>
             <button className={`link-action${tab === 'historical' ? ' underline' : ''}`} onClick={() => setTab('historical')}>Historical (Coming Soon)</button>
          </div>

          <div className="card">
            {tab === 'current' && (
              <div className="flex flex-col gap-4">
                 <h2 className="text-lg font-semibold text-[var(--color-primary-dark)] mb-2">Current Snapshot</h2>

                 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                   <div className="flex flex-col">
                     <div className="text-md font-semibold text-[var(--color-muted)]">Total Assets</div>
                     <div className="text-2xl font-bold text-[var(--color-primary)]">${totalAssets.toLocaleString(undefined, {maximumFractionDigits: 2})}</div>
                   </div>
                    <div className="flex flex-col">
                     <div className="text-md font-semibold text-[var(--color-muted)]">Total Liabilities</div>
                     <div className="text-2xl font-bold text-[var(--color-danger)]">-${totalLiabilities.toLocaleString(undefined, {maximumFractionDigits: 2})}</div>
                   </div>
                    <div className="flex flex-col">
                     <div className="text-md font-semibold text-[var(--color-muted)]">Net Worth</div>
                     <div className="text-2xl font-bold text-[var(--color-primary)]">${netWorth.toLocaleString(undefined, {maximumFractionDigits: 2})}</div>
                   </div>
                 </div>

                 {/* Breakdown of Assets and Liabilities (simple list for now) */}
                 <h3 className="text-lg font-semibold text-[var(--color-muted)] mt-4 mb-2">Account Breakdown</h3>
                 <div className="overflow-x-auto">
                   <table className="min-w-full text-sm">
                      <thead>
                        <tr>
                          <th className="px-2 py-1 text-left">Name</th>
                          <th className="px-2 py-1 text-left">Type</th>
                          <th className="px-2 py-1 text-left">Balance</th>
                        </tr>
                      </thead>
                      <tbody>
                         {allAccounts.map(account => (
                           <tr key={account.account_id || account.id} className="border-b last:border-b-0 hover:bg-[var(--color-surface-alt)] transition">
                             <td className="px-2 py-1">{account.name}</td>
                             <td className="px-2 py-1 capitalize">{account.type || 'other'}</td>
                             <td className={`px-2 py-1 ${liabilityTypes.includes(account.type) || (account.subtype && liabilityTypes.includes(account.subtype)) ? 'text-[var(--color-danger)]' : 'text-[var(--color-primary)]'}`}>${(account.balances?.current ?? account.balance ?? 0).toLocaleString(undefined, {maximumFractionDigits: 2})}</td>
                           </tr>
                         ))}
                          {allAccounts.length === 0 && (
                              <tr>
                                 <td colSpan="3" className="px-2 py-4 text-center text-[var(--color-muted)]">No accounts added yet.</td>
                              </tr>
                           )}
                      </tbody>
                   </table>
                 </div>

              </div>
            )}
             {tab === 'details' && <div>[Detailed Balance Sheet Table Placeholder]</div>}
             {tab === 'historical' && <div>[Historical Balance Sheet Table Placeholder]</div>}
          </div>
        </>
      )}
    </div>
  );
}
function AccountsPage() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [manualAccounts, setManualAccounts] = useState([]);
  const [linkToken, setLinkToken] = useState(null);
  const [accessToken, setAccessToken] = useState(() => localStorage.getItem('access_token'));

  const dbClient = getFirestore();

  // Firebase auth state listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        setLoading(true);
        setError(null);
        // Fetch data when user is authenticated
        fetchAllUserData(currentUser.uid)
          .then(() => fetchManualAccounts(currentUser.uid))
          .catch(err => setError(err))
          .finally(() => setLoading(false));
      } else {
        setAccounts([]);
        setTransactions([]);
        setManualAccounts([]);
        setLoading(false);
      }
    });
    return () => unsubscribe(); // Cleanup subscription
  }, []);

   // --- Copy of data fetching functions from App ---
  const fetchAllUserData = async (userId) => {
    const tokensRes = await fetch(`http://localhost:5001/api/access_tokens?user_id=${userId}`);
    const { tokens } = await tokensRes.json();
    let allAccounts = [];
    // Fetch only accounts for this page
    for (const token of tokens) {
      const accountsRes = await fetch('http://localhost:5001/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_token: token }),
      }).then(res => res.json());
      allAccounts = [
        ...allAccounts,
        ...(accountsRes.accounts || []).filter(
          acc => !allAccounts.some(existing => existing.account_id === acc.account_id)
        ),
      ];
    }
    setAccounts(allAccounts);
  };

  const fetchManualAccounts = async (userId) => {
    const q = query(collection(dbClient, 'manual_accounts'), where('user_id', '==', userId));
    const querySnapshot = await getDocs(q);
    const accounts = [];
    querySnapshot.forEach(doc => accounts.push({ ...doc.data(), id: doc.id }));
    setManualAccounts(accounts);
  };
  // --- End of copied functions ---

  // Merge Plaid and manual accounts
  const allAccounts = [...accounts, ...manualAccounts];

  // Calculate net worth (optional for this page, but might be useful)
  const liabilityTypes = ['credit', 'loan', 'mortgage'];
  const netWorth = allAccounts.reduce((sum, acc) => {
    const bal = acc.balances?.current ?? acc.balance ?? 0;
    if (liabilityTypes.includes(acc.type) || (acc.subtype && liabilityTypes.includes(acc.subtype))) {
      return sum - Math.abs(bal);
    }
    return sum + bal;
  }, 0);

  // Group accounts by type
  const accountsByType = allAccounts.reduce((acc, account) => {
    const type = account.type || 'other';
    acc[type] = acc[type] || [];
    acc[type].push(account);
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-3xl font-bold mb-4">Accounts</h1>
      {loading && <p>Loading Accounts...</p>}
      {error && <p className="text-red-600">Error loading data: {error.message}</p>}
      {!loading && !error && (
        <>
          {/* Net Worth Card (optional) */}
          <div className="card flex flex-col items-center justify-center max-w-md mx-auto" style={{ borderRadius: '8px', boxShadow: 'none' }}>
            <h2 className="text-lg font-semibold text-[var(--color-muted)] mb-2">Net Worth</h2>
            <div className="text-3xl font-bold text-[var(--color-primary)]">${netWorth.toLocaleString(undefined, {maximumFractionDigits: 2})}</div>
          </div>

          <div className="flex gap-2 mb-4">
            {/* Add Account button - integrate PlaidLink here or handle via context/prop drilling */}
            <button className="link-action">+ Add Account</button>
            {/* Reconnect Broken Accounts button - needs implementation */}
            <button className="link-action">Reconnect Broken Accounts</button>
          </div>

          {/* Accounts Table */}
          <div className="card">
            <h2 className="text-lg font-semibold text-[var(--color-primary-dark)] mb-4">All Accounts</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr>
                    <th className="px-2 py-1 text-left">Type</th>
                    <th className="px-2 py-1 text-left">Name</th>
                    <th className="px-2 py-1 text-left">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(accountsByType).map(([type, accountList]) => (
                    <React.Fragment key={type}>
                      {accountList.map(account => (
                        <tr key={account.account_id || account.id} className="border-b last:border-b-0 hover:bg-[var(--color-surface-alt)] transition">
                          <td className="px-2 py-1 font-semibold capitalize">{type}</td>
                          <td className="px-2 py-1">{account.name}</td>
                          <td className="px-2 py-1">${(account.balances?.current ?? account.balance ?? 0).toLocaleString(undefined, {maximumFractionDigits: 2})}</td>
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                  {/* Handle case with no accounts */}
                  {allAccounts.length === 0 && (
                     <tr>
                        <td colSpan="3" className="px-2 py-4 text-center text-[var(--color-muted)]">No accounts added yet.</td>
                     </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
function InvestmentAllocationPage() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [manualAccounts, setManualAccounts] = useState([]);

  const dbClient = getFirestore();

  // Firebase auth state listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        setLoading(true);
        setError(null);
        // Fetch data when user is authenticated
        fetchAllUserData(currentUser.uid)
          .then(() => fetchManualAccounts(currentUser.uid))
          .catch(err => setError(err))
          .finally(() => setLoading(false));
      } else {
        setAccounts([]);
        setManualAccounts([]);
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  // --- Copy of data fetching functions from App (fetching only accounts) ---
  const fetchAllUserData = async (userId) => {
    const tokensRes = await fetch(`http://localhost:5001/api/access_tokens?user_id=${userId}`);
    const { tokens } = await tokensRes.json();
    let allAccounts = [];
    for (const token of tokens) {
      const accountsRes = await fetch('http://localhost:5001/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_token: token }),
      }).then(res => res.json());
      allAccounts = [
        ...allAccounts,
        ...(accountsRes.accounts || []).filter(
          acc => !allAccounts.some(existing => existing.account_id === acc.account_id)
        ),
      ];
    }
    setAccounts(allAccounts);
  };

  const fetchManualAccounts = async (userId) => {
    const q = query(collection(dbClient, 'manual_accounts'), where('user_id', '==', userId));
    const querySnapshot = await getDocs(q);
    const accounts = [];
    querySnapshot.forEach(doc => accounts.push({ ...doc.data(), id: doc.id }));
    setManualAccounts(accounts);
  };
  // --- End of copied functions ---

  // Merge Plaid and manual accounts
  const allAccounts = [...accounts, ...manualAccounts];

  // Filter for investment accounts and prepare allocation data
  const investmentAccounts = allAccounts.filter(account => account.type === 'investment');

  const investmentAllocation = Object.values(
    investmentAccounts.reduce((acc, account) => {
      const subtype = account.subtype || account.type || 'other'; // Use subtype if available, otherwise type
      acc[subtype] = acc[subtype] || { name: subtype, value: 0 };
      acc[subtype].value += account.balances?.current || 0;
      return acc;
    }, {})
  ).filter(item => item.value > 0); // Only include types with positive value

  const [tab, setTab] = useState('summary');
  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-3xl font-bold mb-4">Investment Allocation</h1>
       {loading && <p>Loading Investment Allocation...</p>}
       {error && <p className="text-red-600">Error loading data: {error.message}</p>}
       {!loading && !error && (
         <>
          <div className="flex gap-2 mb-4">
            <button className={`link-action${tab === 'summary' ? ' underline' : ''}`} onClick={() => setTab('summary')}>Summary</button>
            {/* Detail tab remains a placeholder */}
            <button className={`link-action${tab === 'detail' ? ' underline' : ''}`} onClick={() => setTab('detail')}>Detail (Coming Soon)</button>
          </div>

          {tab === 'summary' && (
            <div className="card flex flex-col items-center justify-center" style={{ borderRadius: '8px', minHeight: '380px', boxShadow: 'none', minWidth: 400, maxWidth: 900 }}>
               <h2 className="text-lg font-semibold text-[var(--color-muted)] mb-2">Investment Allocation Summary</h2>
               {investmentAllocation.length > 0 ? (
                 <div className="w-full flex justify-center">
                   <div className="w-full" style={{ minWidth: 350, maxWidth: 600, height: 320 }}>
                     <ResponsiveContainer width="100%" height={320}>
                       <PieChart>
                         <Pie
                           data={investmentAllocation}
                           dataKey="value"
                           nameKey="name"
                           cx="50%"
                           cy="50%"
                           outerRadius={110}
                           fill="var(--color-primary)"
                           label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
                           labelLine={false}
                         >
                           {investmentAllocation.map((entry, index) => (
                             <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                           ))}
                         </Pie>
                         <Tooltip />
                         <Legend layout="vertical" align="right" verticalAlign="middle" />
                       </PieChart>
                     </ResponsiveContainer>
                   </div>
                 </div>
               ) : (
                  <div className="w-full h-full flex items-center justify-center text-[var(--color-muted)]">No investment accounts found.</div>
               )}
            </div>
          )}
          {tab === 'detail' && (
            <div className="card">
              <h2 className="text-lg font-semibold text-[var(--color-muted)] mb-2">Asset Allocation Detail</h2>
              <div className="w-full h-72 flex items-center justify-center text-[var(--color-muted)]">[Detail Chart/Table Placeholder]</div>
            </div>
          )}
         </>
       )}
    </div>
  );
}
function HoldingsPage() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [holdings, setHoldings] = useState([]);
  const [accounts, setAccounts] = useState([]); // Needed to map account_id to name

  const dbClient = getFirestore(); // Initialize Firestore client - though not strictly needed for holdings fetching, good practice if related manual data were added

  // Firebase auth state listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        setLoading(true);
        setError(null);
        // Fetch data when user is authenticated
        fetchHoldingsData(currentUser.uid)
          .catch(err => setError(err))
          .finally(() => setLoading(false));
         // Fetch accounts as well to map account IDs to names in the holdings table
         fetchAllAccountsData(currentUser.uid);
      } else {
        setHoldings([]);
        setAccounts([]);
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

   // --- Data fetching functions for Holdings and Accounts ---
   const fetchHoldingsData = async (userId) => {
     const tokensRes = await fetch(`http://localhost:5001/api/access_tokens?user_id=${userId}`);
     const { tokens } = await tokensRes.json();
     let allHoldings = [];
     for (const token of tokens) {
       try {
         const holdingsRes = await fetch('http://localhost:5001/api/holdings', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ access_token: token }),
         }).then(res => res.json());

         // Plaid holdings response includes holdings and accounts
         if (holdingsRes.holdings) {
            allHoldings = [
              ...allHoldings,
              ...holdingsRes.holdings.filter(
                 holding => !allHoldings.some(existing => existing.security_id === holding.security_id && existing.account_id === holding.account_id) // Prevent duplicates
              ),
            ];
         }
         // Optionally update accounts state here if needed, but fetching separately is cleaner

       } catch (error) {
          console.error(`Error fetching holdings for token ${token}:`, error);
          // Decide how to handle errors for individual tokens - maybe skip and log, or set an error state
       }
     }
     setHoldings(allHoldings);
   };

    // Fetch accounts data (needed to map account IDs)
    const fetchAllAccountsData = async (userId) => {
       const tokensRes = await fetch(`http://localhost:5001/api/access_tokens?user_id=${userId}`);
       const { tokens } = await tokensRes.json();
       let allAccounts = [];
       for (const token of tokens) {
          try {
             const accountsRes = await fetch('http://localhost:5001/api/accounts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ access_token: token }),
             }).then(res => res.json());
             allAccounts = [
                ...allAccounts,
                ...(accountsRes.accounts || []).filter(
                   acc => !allAccounts.some(existing => existing.account_id === acc.account_id)
                ),
             ];
          } catch (error) {
             console.error(`Error fetching accounts for token ${token}:`, error);
          }
       }
       // Note: This won't include manual accounts. Need to fetch those too if they can hold investments.
       fetchManualAccounts(userId).then(manualAccs => setAccounts([...allAccounts, ...manualAccs]));
    };

     const fetchManualAccounts = async (userId) => {
        const q = query(collection(dbClient, 'manual_accounts'), where('user_id', '==', userId));
        const querySnapshot = await getDocs(q);
        const accounts = [];
        querySnapshot.forEach(doc => accounts.push({ ...doc.data(), id: doc.id }));
        return accounts; // Return the accounts to be merged
      };

   // --- End of data fetching functions ---

   // Helper to map account_id to account name
   const accountIdToName = Object.fromEntries((accounts || []).map(acc => [acc.account_id || acc.id, acc.name]));

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-3xl font-bold mb-4">Holdings</h1>
       {loading && <p>Loading Holdings...</p>}
       {error && <p className="text-red-600">Error loading data: {error.message}</p>}
       {!loading && !error && (
         <>
          <div className="card">
            <h2 className="text-lg font-semibold text-[var(--color-primary-dark)] mb-4">All Holdings</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr>
                    <th className="px-2 py-1 text-left">Name</th>
                    <th className="px-2 py-1 text-left">Ticker</th>
                    <th className="px-2 py-1 text-left">Account</th>
                    <th className="px-2 py-1 text-right">Quantity</th>
                    <th className="px-2 py-1 text-right">Current Price</th>
                    <th className="px-2 py-1 text-right">Market Value</th>
                    {/* Performance column requires more data/calculation */}
                    <th className="px-2 py-1 text-left text-[var(--color-muted)]">Performance (Coming Soon)</th>
                  </tr>
                </thead>
                <tbody>
                  {holdings.length > 0 ? (
                    holdings.map(holding => (
                      <tr key={`holding-${holding.account_id}-${holding.security_id}`} className="border-b last:border-b-0 hover:bg-[var(--color-surface-alt)] transition cursor-pointer">
                        <td className="px-2 py-1">{holding.security.name || 'N/A'}</td>
                        <td className="px-2 py-1">{holding.security.ticker_symbol || 'N/A'}</td>
                         <td className="px-2 py-1">{accountIdToName[holding.account_id] || holding.account_id}</td>
                        <td className="px-2 py-1 text-right">{holding.quantity.toLocaleString()}</td>
                        <td className="px-2 py-1 text-right">{holding.cost_basis !== null ? holding.cost_basis.toLocaleString(undefined, {maximumFractionDigits: 2}) : 'N/A'}</td>{/* Using cost_basis as proxy for price for now */}
                        <td className="px-2 py-1 text-right">${holding.market_value.toLocaleString(undefined, {maximumFractionDigits: 2})}</td>
                        <td className="px-2 py-1 text-left text-[var(--color-muted)]">[N/A]</td>{/* Placeholder */}
                      </tr>
                    ))
                  ) : (
                     <tr>
                        <td colSpan="7" className="px-2 py-4 text-center text-[var(--color-muted)]">No holdings data available. Ensure you have linked an investment account.</td>
                     </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <h2 className="text-lg font-semibold text-[var(--color-muted)] mb-2">Performance Graph (Coming Soon)</h2>
            <div className="w-full h-72 flex items-center justify-center text-[var(--color-muted)]">[Performance Graph Placeholder]</div>
          </div>
         </>
       )}
    </div>
  );
}

function SnapshotPage() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [manualAccounts, setManualAccounts] = useState([]);
  const [linkToken, setLinkToken] = useState(null);
  const [accessToken, setAccessToken] = useState(() => localStorage.getItem('access_token'));

  const dbClient = getFirestore();

  // Firebase auth state listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        setLoading(true);
        setError(null);
        // Fetch data when user is authenticated
        fetchAllUserData(currentUser.uid)
          .then(() => fetchManualAccounts(currentUser.uid))
          .catch(err => setError(err))
          .finally(() => setLoading(false));
      } else {
        setAccounts([]);
        setTransactions([]);
        setManualAccounts([]);
        setLoading(false);
      }
    });
    return () => unsubscribe(); // Cleanup subscription
  }, []); // Empty dependency array means this runs once on mount

  // --- Copy of data fetching functions from App ---
  const fetchAllUserData = async (userId) => {
    const tokensRes = await fetch(`http://localhost:5001/api/access_tokens?user_id=${userId}`);
    const { tokens } = await tokensRes.json();
    let allAccounts = [];
    let allTransactions = [];
    for (const token of tokens) {
      const [accountsRes, transactionsRes] = await Promise.all([
        fetch('http://localhost:5001/api/accounts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ access_token: token }),
        }).then(res => res.json()),
        fetch('http://localhost:5001/api/transactions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ access_token: token }),
        }).then(res => res.json()),
      ]);
      allAccounts = [
        ...allAccounts,
        ...(accountsRes.accounts || []).filter(
          acc => !allAccounts.some(existing => existing.account_id === acc.account_id)
        ),
      ];
      allTransactions = [
        ...allTransactions,
        ...(transactionsRes.transactions || []).filter(
          txn => !allTransactions.some(existing => existing.transaction_id === txn.transaction_id)
        ),
      ];
    }
    setAccounts(allAccounts);
    setTransactions(allTransactions);
  };

  const fetchManualAccounts = async (userId) => {
    const q = query(collection(dbClient, 'manual_accounts'), where('user_id', '==', userId));
    const querySnapshot = await getDocs(q);
    const accounts = [];
    querySnapshot.forEach(doc => accounts.push({ ...doc.data(), id: doc.id }));
    setManualAccounts(accounts);
  };
  // --- End of copied functions ---

  // Calculations based on state will go here
  const allAccounts = [...accounts, ...manualAccounts];
  const liabilityTypes = ['credit', 'loan', 'mortgage'];
  const netWorth = allAccounts.reduce((sum, acc) => {
    const bal = acc.balances?.current ?? acc.balance ?? 0;
    if (liabilityTypes.includes(acc.type) || (acc.subtype && liabilityTypes.includes(acc.subtype))) {
      return sum - Math.abs(bal);
    }
    return sum + bal;
  }, 0);

  // Prepare asset allocation data
  const allocation = Object.values(
    allAccounts.reduce((acc, account) => {
      const type = account.type || 'other';
      acc[type] = acc[type] || { name: type, value: 0 };
      acc[type].value += account.balances?.current || 0;
      return acc;
    }, {})
  );

  // Render JSX with data
  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-3xl font-bold mb-4">Snapshot</h1>
       {loading && <p>Loading Snapshot Data...</p>}
       {error && <p className="text-red-600">Error loading data: {error.message}</p>}
       {!loading && !error && (
         <>
           {/* Net Worth Card */}
           <div className="card flex flex-col items-center justify-center" style={{ borderRadius: '8px', boxShadow: 'none' }}>
              <h2 className="text-lg font-semibold text-[var(--color-muted)] mb-2">Net Worth</h2>
              <div className="text-4xl font-bold text-[var(--color-primary)]">${netWorth.toLocaleString(undefined, {maximumFractionDigits: 2})}</div>
            </div>

           {/* Asset Allocation Card */}
            <div className="card flex flex-col items-center justify-center md:col-span-2" style={{ borderRadius: '8px', minHeight: '380px', boxShadow: 'none', minWidth: 400, maxWidth: 900 }}>
              <h2 className="text-lg font-semibold text-[var(--color-muted)] mb-2">Asset Allocation</h2>
              <div className="w-full flex justify-center">
                <div className="w-full" style={{ minWidth: 350, maxWidth: 600, height: 320 }}>
                  <ResponsiveContainer width="100%" height={320}>
                    <PieChart>
                      <Pie
                        data={allocation}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={110}
                        fill="var(--color-primary)"
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
                        labelLine={false}
                      >
                        {allocation.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend layout="vertical" align="right" verticalAlign="middle" />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Other Snapshot Metrics Placeholder (Income, Expenses, etc.) */}
            <div className="card flex flex-col items-center justify-center bg-[var(--color-surface-alt)]" style={{ borderRadius: '8px', boxShadow: 'none' }}>
              <h2 className="text-lg font-semibold text-[var(--color-muted)] mb-2">Income/Expenses (Coming Soon)</h2>
              <div className="w-full h-32 flex items-center justify-center text-[var(--color-primary-light)]">Chart placeholder</div>
            </div>

         </>
       )}
    </div>
  );
}

function DarkModeToggle() {
  const [dark, setDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches);
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
  }, [dark]);
  return (
    <button className="link-action" onClick={() => setDark(d => !d)}>
      {dark ? '🌙 Dark' : '☀️ Light'}
    </button>
  );
}

export default function RootApp() {
  return (
    <Router>
      <div className="min-h-screen flex bg-gradient-to-br from-[var(--color-bg)] to-[var(--color-surface-alt)]">
        <aside className="card w-60 min-h-screen flex flex-col justify-between border border-[var(--color-border)] bg-white mr-12 mt-8 ml-8" style={{ boxShadow: 'none', borderRadius: '8px' }}>
          <div>
            <div className="flex items-center gap-3 mb-10 mt-2 pl-2">
              <img src="/logo.png" alt="Logo" className="w-10 h-10 rounded-md" />
              <span className="text-2xl font-bold text-[var(--color-primary)] tracking-tight">Finance</span>
            </div>
            <nav className="flex flex-col gap-1">
              <Link to="/" element={<DashboardPage />} className="flex items-center gap-3 px-4 py-2 font-medium transition text-base text-[var(--color-muted)] hover:bg-[var(--color-surface-alt)] rounded" style={{ fontWeight: 700 }}>
                Dashboard
              </Link>
              <Link to="/snapshot" element={<SnapshotPage />} className="flex items-center gap-3 px-4 py-2 font-medium transition text-base text-[var(--color-muted)] hover:bg-[var(--color-surface-alt)] rounded">
                Snapshot
              </Link>
              <Link to="/balance-sheet" element={<BalanceSheetPage />} className="flex items-center gap-3 px-4 py-2 font-medium transition text-base text-[var(--color-muted)] hover:bg-[var(--color-surface-alt)] rounded">
                Balance Sheet
              </Link>
              <Link to="/accounts" element={<AccountsPage />} className="flex items-center gap-3 px-4 py-2 font-medium transition text-base text-[var(--color-muted)] hover:bg-[var(--color-surface-alt)] rounded">
                Accounts
              </Link>
              <Link to="/investment-allocation" element={<InvestmentAllocationPage />} className="flex items-center gap-3 px-4 py-2 font-medium transition text-base text-[var(--color-muted)] hover:bg-[var(--color-surface-alt)] rounded">
                Investment Allocation
              </Link>
              <Link to="/holdings" element={<HoldingsPage />} className="flex items-center gap-3 px-4 py-2 font-medium transition text-base text-[var(--color-muted)] hover:bg-[var(--color-surface-alt)] rounded">
                Holdings
              </Link>
            </nav>
          </div>
          <div className="mb-6 pl-2 flex flex-col gap-2">
            <DarkModeToggle />
            <button className="link-action">Log out</button>
          </div>
        </aside>
        <main className="flex-1 flex flex-col gap-8 mt-8 mr-8">
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/snapshot" element={<SnapshotPage />} />
            <Route path="/balance-sheet" element={<BalanceSheetPage />} />
            <Route path="/accounts" element={<AccountsPage />} />
            <Route path="/investment-allocation" element={<InvestmentAllocationPage />} />
            <Route path="/holdings" element={<HoldingsPage />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}
