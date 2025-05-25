import React, { useState } from 'react';
import { usePlaid } from '../../contexts/PlaidDataContext';
import { useCombinedFinanceData } from '../../hooks/useCombinedFinanceData';
import { useDeleteManualAccount } from '../../hooks/useFinanceData';
import Card from '../ui/Card';
import Button from '../ui/Button';
import ManualAccountModal from '../ui/ManualAccountModal';
import EditManualAccountModal from '../ui/EditManualAccountModal';
import { AccountsSkeleton } from '../ui/Skeleton';
import PageTransition from '../ui/PageTransition';
import {
  BanknotesIcon,
  CreditCardIcon,
  BuildingLibraryIcon,
  ChartBarIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';

export default function Accounts() {
  const { user } = usePlaid();
  const { 
    manualAccounts, 
    ynabAccounts, 
    accounts: allAccounts,
    isLoading, 
    isError, 
    error,
    ynabConnected,
    refetch
  } = useCombinedFinanceData(user?.uid);
  
  const deleteManualAccount = useDeleteManualAccount();
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [showAllYnab, setShowAllYnab] = useState(false);


  const handleEditAccount = (account) => {
    setEditingAccount(account);
    setShowEditModal(true);
  };


  const handleDeleteAccount = async (accountId) => {
    if (deleteConfirm === accountId) {
      try {
        await deleteManualAccount.mutateAsync({ accountId, userId: user.uid });
        setDeleteConfirm(null);
      } catch (error) {
        console.error('Failed to delete account:', error);
        // Error is handled by the mutation
      }
    } else {
      setDeleteConfirm(accountId);
      setTimeout(() => setDeleteConfirm(null), 3000);
    }
  };

  const getAccountTypeIcon = (type) => {
    switch (type) {
      case 'credit':
        return <CreditCardIcon className="h-5 w-5" />;
      case 'loan':
      case 'mortgage':
        return <BuildingLibraryIcon className="h-5 w-5" />;
      case 'investment':
        return <ChartBarIcon className="h-5 w-5" />;
      default:
        return <BanknotesIcon className="h-5 w-5" />;
    }
  };

  const getAccountTypeColor = (type) => {
    switch (type) {
      case 'credit':
        return 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/20';
      case 'loan':
      case 'mortgage':
        return 'text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/20';
      case 'investment':
        return 'text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/20';
      default:
        return 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/20';
    }
  };

  // Calculate net worth
  const liabilityTypes = ['credit', 'loan', 'mortgage', 'credit_card', 'creditCard'];
  
  // Helper function to check if an account is a liability
  const isLiability = (account) => {
    const type = account.type?.toLowerCase();
    const subtype = account.subtype?.toLowerCase();
    const name = account.name?.toLowerCase();
    
    // Check for credit card indicators in various fields
    return (
      liabilityTypes.some(liability => type?.includes(liability)) ||
      liabilityTypes.some(liability => subtype?.includes(liability)) ||
      name?.includes('credit') ||
      name?.includes('card') ||
      type === 'credit' ||
      subtype === 'credit_card'
    );
  };
  
  const netWorth = allAccounts.reduce((sum, acc) => {
    const bal = acc.balances?.current ?? acc.balance ?? 0;
    return isLiability(acc) ? sum - Math.abs(bal) : sum + bal;
  }, 0);

  if (isLoading) {
    return (
      <PageTransition>
        <AccountsSkeleton />
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="w-full max-w-none space-y-4 sm:space-y-6 lg:space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <CreditCardIcon className="h-8 w-8 text-blue-600 dark:text-blue-400" />
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">Accounts</h1>
              <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-1">
                Manage all your connected accounts
              </p>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
            <Button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2"
            >
              <PlusIcon className="h-4 w-4" />
              Add Manual Account
            </Button>
          </div>
        </div>

        {/* Error Display */}
        {isError && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 p-4 rounded-lg">
            <div className="flex items-center">
              <ExclamationTriangleIcon className="h-5 w-5 mr-2" />
              <p>{error?.message || 'Unknown error occurred'}</p>
            </div>
          </div>
        )}

        {/* Net Worth Summary */}
        <Card className="text-center">
          <div className="flex items-center justify-center mb-4">
            <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-r from-green-500 to-blue-600 rounded-full flex items-center justify-center">
              <BanknotesIcon className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
            </div>
          </div>
          <h2 className="text-base sm:text-lg font-medium text-gray-600 dark:text-gray-400 mb-2">Net Worth</h2>
          <p className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-4">
            ${netWorth.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </p>
          <div className="grid grid-cols-2 gap-4 text-center">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Manual</p>
              <p className="text-lg font-semibold text-green-600 dark:text-green-400">{manualAccounts.length}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">YNAB</p>
              <p className="text-lg font-semibold text-purple-600 dark:text-purple-400">{ynabAccounts.length}</p>
            </div>
          </div>
        </Card>


        {/* Manual Accounts */}
        <Card>
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Manual Accounts</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Accounts you've added manually - editable and removable
            </p>
          </div>
          
          {manualAccounts.length > 0 ? (
            <div className="space-y-3">
              {manualAccounts.map((account) => (
                <div
                  key={account.id}
                  className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg transition-all duration-300 ease-in-out transform hover:scale-[1.01] animate-in fade-in-0 slide-in-from-left-4"
                >
                  <div className="flex items-center">
                    <div className={`p-2 rounded-lg mr-3 ${getAccountTypeColor(account.type)}`}>
                      {getAccountTypeIcon(account.type)}
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900 dark:text-white">{account.name}</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400 capitalize">
                        {account.type} • Manual
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <div className="text-right mr-3">
                      <p className="font-semibold text-gray-900 dark:text-white">
                        ${(account.balance || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </p>
                    </div>
                    
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEditAccount(account)}
                        className="p-2 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                        title="Edit account"
                      >
                        <PencilIcon className="h-4 w-4" />
                      </button>
                      
                      <button
                        onClick={() => handleDeleteAccount(account.id)}
                        className={`p-2 rounded-lg transition-colors ${
                          deleteConfirm === account.id
                            ? 'text-white bg-red-600 hover:bg-red-700'
                            : 'text-red-600 hover:bg-red-100 dark:hover:bg-red-900/20'
                        }`}
                        title={deleteConfirm === account.id ? 'Click again to confirm' : 'Delete account'}
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <BanknotesIcon className="mx-auto h-12 w-12 mb-4" />
              <p>No manual accounts added yet</p>
              <p className="text-sm mt-1">Click "Add Manual Account" to get started</p>
            </div>
          )}
        </Card>

        {/* YNAB Accounts */}
        {ynabConnected && ynabAccounts.length > 0 && (
          <Card>
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">YNAB Accounts</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Synced from your You Need A Budget
              </p>
            </div>
            
            <div className="space-y-3">
              {(showAllYnab ? ynabAccounts : ynabAccounts.slice(0, 5)).map((account) => (
                <div
                  key={account.account_id}
                  className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg transition-all duration-300 ease-in-out transform hover:scale-[1.01] animate-in fade-in-0 slide-in-from-left-4"
                >
                  <div className="flex items-center">
                    <div className={`p-2 rounded-lg mr-3 ${getAccountTypeColor(account.type)}`}>
                      {getAccountTypeIcon(account.type)}
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900 dark:text-white">{account.name}</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400 capitalize">
                        {account.type} • YNAB • {account.closed ? 'Closed' : 'Active'}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <div className="text-right mr-3">
                      <p className="font-semibold text-gray-900 dark:text-white">
                        ${(account.balance || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-500">Read-only</p>
                    </div>
                    
                  </div>
                </div>
              ))}
              
              {ynabAccounts.length > 5 && (
                <div className="text-center py-4">
                  <Button
                    variant="outline"
                    onClick={() => setShowAllYnab(!showAllYnab)}
                    className="text-sm"
                  >
                    {showAllYnab 
                      ? 'Show Less' 
                      : `Show All ${ynabAccounts.length} YNAB Accounts (${ynabAccounts.length - 5} more)`
                    }
                  </Button>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Modals */}
        <ManualAccountModal
          user={user}
          show={showAddModal}
          onClose={() => setShowAddModal(false)}
          onAccountAdded={() => {
            setShowAddModal(false);
            refetch();
          }}
        />

        {editingAccount && (
          <EditManualAccountModal
            user={user}
            account={editingAccount}
            show={showEditModal}
            onClose={() => {
              setShowEditModal(false);
              setEditingAccount(null);
            }}
            onAccountUpdated={() => {
              setShowEditModal(false);
              setEditingAccount(null);
              refetch();
            }}
          />
        )}

      </div>
    </PageTransition>
  );
}