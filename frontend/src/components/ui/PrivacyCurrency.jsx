import React from 'react';
import { formatCurrency } from '../../utils/formatters';

const PrivacyCurrency = ({ amount, isPrivacyMode, className = '', prefix = '$', ...props }) => {
  // Always format normally, never pass isPrivacyMode to formatCurrency
  // The privacy effect is handled purely through CSS blur
  const formattedAmount = formatCurrency(Math.abs(amount || 0), false);
  
  return (
    <span className={className} {...props}>
      {prefix}
      <span className={isPrivacyMode ? 'privacy-blur' : ''}>
        {formattedAmount}
      </span>
    </span>
  );
};

export default PrivacyCurrency;