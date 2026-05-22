import React from 'react';

const Logo = ({ size = 24, className = "" }) => {
  return (
    <img 
      src="/logo.png" 
      alt="Amadeus Logo" 
      className={className}
      style={{ 
        width: size, 
        height: size, 
        objectFit: 'contain' 
      }} 
    />
  );
};

export default Logo;
