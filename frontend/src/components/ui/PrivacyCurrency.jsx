import React from 'react';
import { formatCurrency } from '../../utils/formatters';

const PrivacyCurrency = ({ amount, isPrivacyMode, className = '', prefix = '$', ...props }) => {
  // Always format normally, never pass isPrivacyMode to formatCurrency
  // The privacy effect is handled purely through CSS blur
  const formattedAmount = formatCurrency(Math.abs(amount || 0), false);
  
  return (
    <span className={`${className} ${isPrivacyMode ? 'privacy-blur' : ''}`} {...props}>
      {prefix}{formattedAmount}
    </span>
  );
};

export default PrivacyCurrency;