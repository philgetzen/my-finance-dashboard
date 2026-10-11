import { getAccountBalance, normalizeYNABAccountType } from './ynabHelpers';
import { isLiability } from './formatters';
import { isDebtAccount } from './calculations/cashflow';

/**
 * An account that still counts toward balances. Matches the Accounts page,
 * which skips closed accounts; deleted accounts never count.
 */
export function isAccountOpen(account) {
  return !(account?.closed === true || account?.deleted === true || account?.closed_on);
}

/**
 * Net worth, asset and liability totals plus the largest holdings, over open accounts only.
 * @param {Array} accounts - YNAB accounts followed by manual accounts
 */
export function calculateNetWorthTotals(accounts) {
  let assets = 0;
  let liabilities = 0;
  const assetAccounts = [];
  const liabilityAccounts = [];

  (accounts || []).filter(isAccountOpen).forEach(account => {
    const balance = getAccountBalance(account);
    const type = normalizeYNABAccountType(account.type);
    const name = account.name || account.nickname || 'Unknown Account';

    if (isLiability(account) || ['credit', 'loan', 'mortgage'].includes(type) || isDebtAccount(account)) {
      // YNAB liabilities are negative (a card carrying a credit is positive);
      // manual liabilities may be entered either way
      const owed = account.on_budget !== undefined ? -balance : Math.abs(balance);
      liabilities += owed;
      liabilityAccounts.push({ name, balance: owed });
    } else {
      assets += balance;
      if (balance > 0) {
        assetAccounts.push({ name, balance });
      }
    }
  });

  return {
    netWorth: assets - liabilities,
    totalAssets: assets,
    totalLiabilities: liabilities,
    topAssets: assetAccounts.sort((a, b) => b.balance - a.balance).slice(0, 3),
    topLiabilities: liabilityAccounts.sort((a, b) => b.balance - a.balance).slice(0, 3)
  };
}
