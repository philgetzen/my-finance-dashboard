import React from 'react';

const BalanceDisplay = ({ balance }) => {
  if (!tokens || tokens.length === 0) {
    return <div>No tokens available</div>;
  }

  return (
    <div style={{ color: balance < 0 ? 'green' : 'black' }}>
      {balance}
    </div>
  );
};

export default BalanceDisplay;
