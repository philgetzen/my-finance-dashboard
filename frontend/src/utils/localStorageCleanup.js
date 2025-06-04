// Utility to clean up invalid localStorage values
export function cleanupLocalStorage() {
  const keysToCheck = ['darkMode', 'privacyMode'];
  
  keysToCheck.forEach(key => {
    try {
      const value = localStorage.getItem(key);
      
      // Remove invalid values
      if (value === 'undefined' || value === 'null' || value === '') {
        localStorage.removeItem(key);
        console.log(`Cleaned up invalid localStorage value for: ${key}`);
      } else if (value !== null) {
        // Try to parse to ensure it's valid JSON
        try {
          JSON.parse(value);
        } catch (e) {
          localStorage.removeItem(key);
          console.log(`Removed unparseable localStorage value for: ${key}`);
        }
      }
    } catch (e) {
      console.error(`Error cleaning up localStorage key ${key}:`, e);
    }
  });
}

// Run cleanup on app initialization
if (typeof window !== 'undefined') {
  cleanupLocalStorage();
}
