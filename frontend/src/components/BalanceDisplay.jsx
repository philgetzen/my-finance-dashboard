import React from 'react';

const BalanceDisplay = ({ balance }) => {
  return (
    <div style={{ color: balance < 0 ? 'green' : 'black' }}>
      {balance}
    </div>
  );
};

export default BalanceDisplay;
