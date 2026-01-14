import { useMemo } from 'react';
import { getTransactionAmount } from '../utils/ynabHelpers';

// Define income categories based on YNAB report structure
export const YNAB_INCOME_CATEGORIES = [
  "Inflow: Ready to Assign",
  "Ready to Assign",
  "To be Budgeted",
  "Deferred Income SubCategory"
];

export const DEBT_PAYMENT_CATEGORIES = ["8331 Mortgage", "2563 Mortgage", "Kia Loan"];

/**
 * Custom hook for processing transaction data
 * Centralizes all transaction processing logic to avoid duplication
 */
export function useTransactionProcessor(transactions, accounts, investmentAccountIds) {
  return useMemo(() => {
    if (!transactions?.length) {
      return {
        processedTransactions: [],
        monthlyData: {},
        totals: { income: 0, expenses: 0, net: 0 }
      };
    }

    const monthlyData = {};
    let totalIncome = 0;
    let totalExpenses = 0;
    
    // Process each transaction
    const processTransaction = (txn, accountId) => {
      // Skip investment account transactions
      if (investmentAccountIds?.has(accountId)) return null;
      
      // Skip transfers unless they're categorized debt payments
      const isPayeeTransfer = txn.payee_name?.toLowerCase().startsWith("transfer : ");
      const isCategorizedDebtPayment = DEBT_PAYMENT_CATEGORIES.includes(txn.category_name);
      
      if (txn.transfer_account_id || (isPayeeTransfer && !isCategorizedDebtPayment)) {
        return null;
      }
      
      // Skip reconciliation transactions
      if (txn.payee_name === 'Reconciliation Balance Adjustment' || 
          txn.payee_name === 'Starting Balance') {
        return null;
      }

      const amount = getTransactionAmount(txn);
      const date = new Date(txn.date);
      const monthKey = date.toISOString().slice(0, 7);
      
      // Initialize month data if needed
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { income: 0, expenses: 0, net: 0 };
      }
      
      // Categorize as income or expense
      const isIncome = YNAB_INCOME_CATEGORIES.includes(txn.category_name);
      
      if (isIncome) {
        monthlyData[monthKey].income += amount;
        totalIncome += amount;
      } else if (amount < 0) {
        // Only count actual expenses (negative amounts = outflows)
        // Positive amounts in non-income categories (refunds) are ignored
        monthlyData[monthKey].expenses += Math.abs(amount);
        totalExpenses += Math.abs(amount);
      }
      
      return {
        ...txn,
        processedAmount: amount,
        isIncome,
        monthKey
      };
    };
    
    // Process all transactions including subtransactions
    const processedTransactions = [];
    
    transactions.forEach(transaction => {
      if (transaction.subtransactions?.length > 0) {
        transaction.subtransactions.forEach(subTxn => {
          const processed = processTransaction({
            ...subTxn,
            payee_name: subTxn.payee_name || transaction.payee_name,
            date: transaction.date,
            category_id: subTxn.category_id || transaction.category_id,
            category_name: subTxn.category_name || transaction.category_name,
            transfer_account_id: subTxn.transfer_account_id || transaction.transfer_account_id
          }, transaction.account_id);
          
          if (processed) processedTransactions.push(processed);
        });
      } else {
        const processed = processTransaction(transaction, transaction.account_id);
        if (processed) processedTransactions.push(processed);
      }
    });
    
    // Calculate net for each month
    Object.keys(monthlyData).forEach(monthKey => {
      monthlyData[monthKey].net = monthlyData[monthKey].income - monthlyData[monthKey].expenses;
    });
    
    return {
      processedTransactions,
      monthlyData,
      totals: {
        income: totalIncome,
        expenses: totalExpenses,
        net: totalIncome - totalExpenses
      }
    };
  }, [transactions, accounts, investmentAccountIds]);
}

/**
 * Get monthly summary data for a specific time range
 */
export function getMonthlyRangeData(monthlyData, months = 6) {
  const result = [];
  const today = new Date();
  
  for (let i = months - 1; i >= 0; i--) {
    const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const monthKey = date.toISOString().slice(0, 7);
    const monthName = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    
    result.push({
      monthKey,
      monthName,
      ...(monthlyData[monthKey] || { income: 0, expenses: 0, net: 0 })
    });
  }
  
  return result;
}
