let isRecording = false;
let recordingStartTime = null;
let networkLogs = [];
let consoleLogs = [];
let autoRestartInterval = null;
let isAutoRestartEnabled = true;

const AUTO_RESTART_INTERVAL = 10 * 60 * 1000; // 10 minutes

// Initialize settings
chrome.storage.local.get(['isRecording', 'recordingStartTime'], (result) => {
  isRecording = result.isRecording || false;
  recordingStartTime = result.recordingStartTime || null;
  
  if (isRecording) {
    injectContentScriptToAllTabs();
  }
});

// Inject content script when a new tab is created
chrome.tabs.onCreated.addListener((tab) => {
  if (isRecording && tab.id) {
    injectContentScript(tab.id);
  }
});

// Inject content script when a tab is updated
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (isRecording && changeInfo.status === 'complete') {
    injectContentScript(tabId);
  }
});

async function injectContentScript(tabId) {
  try {
    // Check if we can access the tab
    const tab = await chrome.tabs.get(tabId);
    console.log('[Background] Attempting to inject into tab:', tab.url);
    
    // Allow http, https, and file protocols
    if (tab.url && (tab.url.startsWith('http://') || 
                    tab.url.startsWith('https://') || 
                    tab.url.startsWith('file://'))) {
      console.log('[Background] Injecting content script into tab:', tabId);
      await chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ['console-logger.js']
      });
      console.log('[Background] Content script injection successful');
    } else {
      console.log('[Background] Skipping injection for tab with URL:', tab.url);
    }
  } catch (e) {
    console.error('[Background] Error injecting content script:', e);
  }
}

async function injectContentScriptToAllTabs() {
  console.log('[Background] Injecting content script to all tabs');
  const tabs = await chrome.tabs.query({
    url: ['http://*/*', 'https://*/*', 'file://*/*']
  });
  console.log('[Background] Found tabs:', tabs.length);
  for (const tab of tabs) {
    if (tab.id) {
      await injectContentScript(tab.id);
    }
  }
}

chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    if (isRecording && details.type) {
      networkLogs.push({
        timestamp: new Date().toISOString(),
        url: details.url,
        type: details.type
      });
      updatePopupCounts();
    }
  },
  { urls: ["<all_urls>"] }
);

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[Background] Received message:', request.action, request);
  
  if (request.action === 'startRecording') {
    startRecording();
    sendResponse({ success: true });
  } else if (request.action === 'stopRecording') {
    stopRecording(false);
    sendResponse({ success: true });
  } else if (request.action === 'getState') {
    sendResponse({
      isRecording,
      recordingStartTime,
      networkCount: networkLogs.length,
      consoleCount: consoleLogs.length
    });
  } else if (request.action === 'clearLogs') {
    clearLogs();
    sendResponse({ success: true });
  } else if (request.action === 'consoleLog' && isRecording) {
    console.log('[Background] Received console log:', request.level, request.message);
    consoleLogs.push({
      timestamp: Date.now(),
      level: request.level,
      message: request.message,
      url: sender.tab ? sender.tab.url : 'unknown'
    });
    console.log('[Background] Total console logs:', consoleLogs.length);
    updatePopupCounts();
    sendResponse({ success: true });
  } else if (request.action === 'updateAutoRestart') {
    isAutoRestartEnabled = request.enabled;
    chrome.storage.local.set({ isAutoRestartEnabled });
    if (isRecording) {
      if (isAutoRestartEnabled) {
        setupAutoRestart();
      } else {
        clearAutoRestart();
      }
    }
    sendResponse({ success: true });
  } else if (request.action === 'saveLogs') {
    saveCurrentLogs();
    sendResponse({ success: true });
  }
  return true;
});

function startRecording() {
  if (!isRecording) {
    console.log('[Background] Starting recording');
    isRecording = true;
    recordingStartTime = Date.now();
    
    networkLogs = [];
    consoleLogs = [];
    
    chrome.storage.local.set({ 
      isRecording: isRecording,
      recordingStartTime: recordingStartTime 
    });
    
    injectContentScriptToAllTabs().then(() => {
      console.log('[Background] Content scripts injected to all tabs');
    });
    
    tryNotifyPopup({
      action: 'updateState',
      isRecording: isRecording,
      recordingStartTime: recordingStartTime
    });
    
    setupAutoRestart();
    tryNotifyPopup({
      action: 'updateCounts',
      networkCount: networkLogs.length,
      consoleCount: consoleLogs.length
    });
  }
}

async function stopRecording(isAutoRestart = false) {
  if (isRecording) {
    isRecording = false;
    recordingStartTime = null;
    
    chrome.storage.local.set({ 
      isRecording: isRecording,
      recordingStartTime: null 
    });
    
    tryNotifyPopup({
      action: 'updateState',
      isRecording: isRecording,
      recordingStartTime: null
    });
    
    clearAutoRestart();
    
    if (!isAutoRestart && (networkLogs.length > 0 || consoleLogs.length > 0)) {
      try {
        await saveCurrentLogs();
      } catch (error) {
        tryNotifyPopup({ 
          type: 'notification',
          message: 'Error saving logs: ' + error.message
        });
      }
    }
    
    networkLogs = [];
    consoleLogs = [];
    tryNotifyPopup({
      action: 'updateCounts',
      networkCount: 0,
      consoleCount: 0
    });
  }
}

function clearLogs() {
  networkLogs = [];
  consoleLogs = [];
  tryNotifyPopup({
    action: 'updateCounts',
    networkCount: 0,
    consoleCount: 0
  });
}

function updatePopupCounts() {
  tryNotifyPopup({
    action: 'updateCounts',
    networkCount: networkLogs.length,
    consoleCount: consoleLogs.length
  });
}

function tryNotifyPopup(message) {
  chrome.runtime.sendMessage(message).catch(() => {});
}

function setupAutoRestart() {
  clearAutoRestart();
  
  if (isRecording && isAutoRestartEnabled) {
    const startTime = Date.now();
    
    function checkAutoRestart() {
      if (!isRecording || !isAutoRestartEnabled) {
        clearAutoRestart();
        return;
      }
      
      const elapsed = Date.now() - startTime;
      if (elapsed >= AUTO_RESTART_INTERVAL) {
        handleAutoRestart();
      }
    }
    
    autoRestartInterval = setInterval(checkAutoRestart, 1000);
  }
}

function clearAutoRestart() {
  if (autoRestartInterval) {
    clearInterval(autoRestartInterval);
    autoRestartInterval = null;
  }
}

function handleAutoRestart() {
  if (isRecording && isAutoRestartEnabled) {
    stopRecording(true).then(() => {
      if (isAutoRestartEnabled) {
        startRecording();
      }
    });
  }
}

async function saveCurrentLogs() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  
  // Save network logs as HAR
  if (networkLogs.length > 0) {
    const harData = {
      log: {
        version: '1.2',
        creator: {
          name: 'Network & Console Logger',
          version: '1.0'
        },
        browser: {
          name: 'Microsoft Edge',
          version: '1.0'
        },
        pages: [{
          startedDateTime: new Date(recordingStartTime).toISOString(),
          id: 'page_1',
          title: 'Network Log Recording',
          pageTimings: {
            onContentLoad: -1,
            onLoad: -1
          }
        }],
        entries: networkLogs.map(log => ({
          startedDateTime: log.timestamp,
          time: 0,
          request: {
            method: 'GET',
            url: log.url,
            httpVersion: 'HTTP/1.1',
            headers: [],
            queryString: [],
            cookies: [],
            headersSize: -1,
            bodySize: -1
          },
          response: {
            status: 200,
            statusText: 'OK',
            httpVersion: 'HTTP/1.1',
            headers: [],
            cookies: [],
            content: {
              size: 0,
              mimeType: 'application/json'
            },
            redirectURL: '',
            headersSize: -1,
            bodySize: -1,
            _transferSize: 0
          },
          cache: {},
          timings: {
            blocked: 0,
            dns: -1,
            ssl: -1,
            connect: -1,
            send: 0,
            wait: 0,
            receive: 0
          },
          serverIPAddress: '',
          _resourceType: log.type
        }))
      }
    };

    const harContent = JSON.stringify(harData, null, 2);
    const harDataUrl = 'data:application/har+json;base64,' + btoa(unescape(encodeURIComponent(harContent)));
    
    await chrome.downloads.download({
      url: harDataUrl,
      filename: `network_logs_${timestamp}.har`,
      saveAs: true
    });
  }
  
  // Save console logs separately
  if (consoleLogs.length > 0) {
    const logContent = consoleLogs.map(log => 
      `[${new Date(log.timestamp).toISOString()}] [${log.level.toUpperCase()}] ${log.message}`
    ).join('\n');
    
    const logDataUrl = 'data:text/plain;base64,' + btoa(unescape(encodeURIComponent(logContent)));
    
    await chrome.downloads.download({
      url: logDataUrl,
      filename: `console_logs_${timestamp}.log`,
      saveAs: true
    });
  }
}
