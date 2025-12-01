import React from 'react';
import { formatCurrency, isEffectivelyZero } from '../../utils/formatters';

const PrivacyCurrency = ({
  amount,
  isPrivacyMode,
  className = '',
  prefix = '$',
  zeroClassName = 'text-gray-500 dark:text-gray-400',
  useZeroStyle = true,
  ...props
}) => {
  // Check if the amount is effectively zero (would display as 0.00 or -0.00)
  const isZero = isEffectivelyZero(amount);

  // Always format normally, never pass isPrivacyMode to formatCurrency
  // The privacy effect is handled purely through CSS blur
  const formattedAmount = formatCurrency(Math.abs(amount || 0), false);

  // If effectively zero and useZeroStyle is true, override the className with gray styling
  const finalClassName = isZero && useZeroStyle
    ? `${zeroClassName} ${isPrivacyMode ? 'privacy-blur' : ''}`
    : `${className} ${isPrivacyMode ? 'privacy-blur' : ''}`;

  // For zero values, always use '$' prefix (not '-$')
  const finalPrefix = isZero ? '$' : prefix;

  return (
    <span className={`tabular-nums ${finalClassName}`} {...props}>
      {finalPrefix}{formattedAmount}
    </span>
  );
};

export default PrivacyCurrency;