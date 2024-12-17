// Prevent multiple injections
if (window.hasConsoleLogger) {
  console.log('[Console Logger] Already injected, skipping.');
} else {
  window.hasConsoleLogger = true;
  console.log('[Console Logger] Content script loaded');

  // Save original console methods
  const originalConsole = {
    error: console.error,
    warn: console.warn,
    info: console.info,
    log: console.log,
    debug: console.debug
  };

  // Override console methods to capture logs
  Object.keys(originalConsole).forEach(level => {
    console[level] = (...args) => {
      // Call original method
      originalConsole[level].apply(console, args);
      
      // Send log to background script
      try {
        const message = args.map(arg => {
          try {
            return typeof arg === 'object' ? JSON.stringify(arg) : String(arg);
          } catch (e) {
            return '[Object]';
          }
        }).join(' ');
        
        console.log('[Console Logger] Sending message to background:', level, message);
        
        chrome.runtime.sendMessage({
          action: 'consoleLog',
          level: level,
          message: message
        }, response => {
          if (chrome.runtime.lastError) {
            console.log('[Console Logger] Error sending message:', chrome.runtime.lastError);
          } else {
            console.log('[Console Logger] Message sent successfully');
          }
        });
      } catch (e) {
        console.log('[Console Logger] Error in console override:', e);
      }
    };
  });
}
