// Debug logging function
function debugLog(message) {
  const timestamp = new Date().toISOString();
  console.log(`[Console Logger Debug ${timestamp}] ${message}`);
}

// Prevent multiple injections
if (window.hasConsoleLogger) {
  console.log('[Console Logger] Already injected, skipping.');
} else {
  window.hasConsoleLogger = true;
  console.log('[Console Logger] Content script loaded');

  // Save original console methods
  const originalConsole = {
    error: console.error.bind(console),
    warn: console.warn.bind(console),
    info: console.info.bind(console),
    log: console.log.bind(console),
    debug: console.debug.bind(console)
  };

  // Queue for batching messages
  let messageQueue = [];
  const MAX_QUEUE_SIZE = 100;
  const FLUSH_INTERVAL = 1000; // 1 second

  // Function to safely send messages to background script
  function sendToBackground(data) {
    try {
      if (chrome && chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage(data, response => {
          if (chrome.runtime.lastError) {
            originalConsole.warn('[Console Logger] Error sending message:', chrome.runtime.lastError);
          }
        });
      }
    } catch (e) {
      originalConsole.warn('[Console Logger] Error accessing runtime API:', e);
    }
  }

  // Function to send messages in batch
  function flushMessages() {
    if (messageQueue.length === 0) return;
    
    sendToBackground({
      action: 'consoleLog',
      batch: messageQueue.slice()
    });
    
    messageQueue = [];
  }

  // Set up periodic flush with error handling
  let flushIntervalId = null;
  try {
    flushIntervalId = setInterval(flushMessages, FLUSH_INTERVAL);
  } catch (e) {
    originalConsole.warn('[Console Logger] Error setting up flush interval:', e);
  }

  // Override console methods to capture logs
  Object.keys(originalConsole).forEach(level => {
    console[level] = function(...args) {
      // Call original method first
      originalConsole[level].apply(console, args);
      
      try {
        // Convert arguments to string, with size limits
        const message = args.map(arg => {
          try {
            if (typeof arg === 'object' && arg !== null) {
              if (arg instanceof Error) {
                return `${arg.name}: ${arg.message}\n${arg.stack || ''}`;
              }
              return JSON.stringify(arg, null, 2).substring(0, 1000); // Limit string length
            }
            return String(arg).substring(0, 1000);
          } catch (e) {
            return '[Object]';
          }
        }).join(' ');

        // Add to queue
        messageQueue.push({
          timestamp: Date.now(),
          level,
          message
        });

        // Flush if queue is full
        if (messageQueue.length >= MAX_QUEUE_SIZE) {
          flushMessages();
        }
      } catch (e) {
        // If our logging fails, make sure we don't lose the original console
        originalConsole.error('[Console Logger] Error in console override:', e);
      }
    };
  });

  // Clean up on page unload
  window.addEventListener('unload', () => {
    if (flushIntervalId) {
      clearInterval(flushIntervalId);
    }
    if (messageQueue.length > 0) {
      sendToBackground({
        action: 'consoleLog',
        batch: messageQueue
      });
    }
  });
}
