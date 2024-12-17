let isRecording = false;
let recordingStartTime = null;
let networkLogs = [];
let consoleLogs = [];
let networkCount = 0;
let consoleCount = 0;
let attachedTabs = new Set();
let currentTabUrl = '';
let currentTabId = null;

// Initialize extension
chrome.runtime.onInstalled.addListener(() => {
    console.log('Extension installed');
});

// Message handling
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Received message:', message);

    switch (message.action) {
        case 'startRecording':
            // Get current active tab first
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs[0]) {
                    if (!isRecording) {
                        startRecording(tabs[0].id);
                        sendResponse({ success: true });
                    } else {
                        sendResponse({ success: false, error: 'Already recording' });
                    }
                } else {
                    sendResponse({ success: false, error: 'No active tab found' });
                }
            });
            return true; // Keep the message channel open for async response

        case 'stopRecording':
            stopRecording();
            sendResponse({ success: true });
            break;

        case 'getState':
            sendResponse({
                isRecording,
                recordingStartTime,
                networkCount,
                consoleCount
            });
            break;

        case 'saveLogs':
            saveLogs();
            sendResponse({ success: true });
            break;

        case 'cancelSave':
            resetState();
            sendResponse({ success: true });
            break;
    }
    return true;
});

function startRecording(tabId) {
    if (isRecording) {
        console.log('Already recording');
        return;
    }

    console.log('Starting recording');
    resetState();
    isRecording = true;
    recordingStartTime = Date.now();

    chrome.debugger.attach({ tabId }, '1.2', () => {
        if (chrome.runtime.lastError) {
            console.error('Failed to attach debugger:', chrome.runtime.lastError);
            isRecording = false;
            return;
        }
        
        // Enable network tracking
        chrome.debugger.sendCommand({ tabId }, 'Network.enable');
        // Enable console tracking
        chrome.debugger.sendCommand({ tabId }, 'Console.enable');
        chrome.debugger.sendCommand({ tabId }, 'Runtime.enable');
        
        attachedTabs.add(tabId);
    });
}

function stopRecording() {
    if (!isRecording) return;

    console.log('Stopping recording');
    isRecording = false;
    recordingStartTime = null;

    // Detach debugger from all attached tabs
    attachedTabs.forEach(tabId => {
        chrome.debugger.detach({ tabId }).catch(() => {
            console.log('Failed to detach debugger from tab:', tabId);
        });
    });
    attachedTabs.clear();

    // Save logs immediately instead of showing dialog
    if (networkLogs.length > 0 || consoleLogs.length > 0) {
        saveLogs();
    }

    broadcastState();
}

function shouldAttachToTab(tab) {
    if (!tab.url) return false;
    const url = tab.url.toLowerCase();
    return !url.startsWith('chrome://') && 
           !url.startsWith('edge://') && 
           !url.startsWith('about:') &&
           !url.startsWith('chrome-extension://');
}

function attachDebugger(tabId) {
    chrome.debugger.attach({ tabId }, '1.2')
        .then(() => {
            console.log('Debugger attached to tab:', tabId);
            attachedTabs.add(tabId);
            
            // Get current tab URL
            chrome.tabs.get(tabId, (tab) => {
                currentTabUrl = tab.url;
                // Enable all required debugger domains
                return Promise.all([
                    chrome.debugger.sendCommand({ tabId }, "Network.enable"),
                    chrome.debugger.sendCommand({ tabId }, "Runtime.enable"),
                    chrome.debugger.sendCommand({ tabId }, "Debugger.enable"),
                    // Set pause on exceptions to capture stack traces
                    chrome.debugger.sendCommand({ tabId }, "Debugger.setPauseOnExceptions", { state: "none" }),
                    // Enable collecting stack traces for console methods
                    chrome.debugger.sendCommand({ tabId }, "Runtime.setAsyncCallStackDepth", { maxDepth: 32 })
                ]);
            });
        })
        .catch(error => {
            console.log('Failed to attach debugger:', error);
            isRecording = false;  // Reset recording state if debugger fails to attach
        });
}

// Tab event handlers
function onTabCreated(tab) {
    if (isRecording && shouldAttachToTab(tab)) {
        attachDebugger(tab.id);
    }
}

function onTabUpdated(tabId, changeInfo, tab) {
    if (isRecording && changeInfo.status === 'complete' && shouldAttachToTab(tab)) {
        attachDebugger(tabId);
    }
    if (isRecording && changeInfo.url) {
        currentTabUrl = changeInfo.url;
    }
}

// Debugger event handlers
chrome.debugger.onEvent.addListener((debuggeeId, method, params) => {
    if (!isRecording) return;

    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] Debug event:`, method, params);

    switch (method) {
        case 'Network.requestWillBeSent':
            networkCount++;
            networkLogs.push({
                timestamp,
                type: 'request',
                data: params
            });
            broadcastCounts();
            break;

        case 'Network.responseReceived':
            networkLogs.push({
                timestamp,
                type: 'response',
                data: params
            });
            break;

        case 'Runtime.consoleAPICalled':
            consoleCount++;
            consoleLogs.push({
                timestamp: new Date(params.timestamp / 1000).toISOString(),
                ...params
            });
            broadcastCounts();
            break;

        case 'Console.messageAdded':
            consoleCount++;
            const message = params.message;
            
            // Mirror the console message to extension's console
            switch (message.level) {
                case 'error':
                    // Only log the error, don't throw it
                    console.log('[Console Error]:', message.text);
                    break;
                case 'warning':
                    console.log('[Console Warning]:', message.text);
                    break;
                case 'info':
                    console.log('[Console Info]:', message.text);
                    break;
                default:
                    console.log('[Console Log]:', message.text);
            }

            consoleLogs.push({
                timestamp,
                level: message.level,
                text: message.text,
                source: message.source,
                url: message.url,
                line: message.line,
                column: message.column
            });
            broadcastCounts();
            break;
    }
});

async function saveLogs() {
    console.log('Saving logs...');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    try {
        // Save network logs as HAR
        if (networkLogs.length > 0) {
            const harLog = {
                version: '1.2',
                creator: {
                    name: 'Network & Console Logger',
                    version: '1.0'
                },
                entries: networkLogs.map(log => ({
                    startedDateTime: log.timestamp,
                    time: 0,
                    request: log.data.request || {},
                    response: log.data.response || {},
                    cache: {},
                    timings: {}
                }))
            };

            const harBlob = new Blob([JSON.stringify(harLog, null, 2)], { type: 'application/json' });
            const harData = await new Promise(resolve => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.readAsDataURL(harBlob);
            });

            await new Promise((resolve, reject) => {
                chrome.downloads.download({
                    url: harData,
                    filename: `network_log_${timestamp}.har`,
                    saveAs: true
                }, () => {
                    if (chrome.runtime.lastError) {
                        reject(chrome.runtime.lastError);
                    } else {
                        resolve();
                    }
                });
            });
        }

        // Save console logs
        if (consoleLogs.length > 0) {
            const consoleBlob = new Blob([JSON.stringify(consoleLogs, null, 2)], { type: 'application/json' });
            const consoleData = await new Promise(resolve => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.readAsDataURL(consoleBlob);
            });

            await new Promise((resolve, reject) => {
                chrome.downloads.download({
                    url: consoleData,
                    filename: `console_log_${timestamp}.json`,
                    saveAs: true
                }, () => {
                    if (chrome.runtime.lastError) {
                        reject(chrome.runtime.lastError);
                    } else {
                        resolve();
                    }
                });
            });
        }

        // Reset state after successful save
        resetState();
    } catch (error) {
        console.error('Error saving logs:', error);
    }
}

function broadcastState() {
    chrome.runtime.sendMessage({
        action: 'updateState',
        isRecording,
        recordingStartTime,
        networkCount,
        consoleCount
    }).catch(() => {});
}

function broadcastCounts() {
    chrome.runtime.sendMessage({
        action: 'updateCounts',
        networkCount,
        consoleCount
    }).catch(() => {});
}

function resetState() {
    networkLogs = [];
    consoleLogs = [];
    networkCount = 0;
    consoleCount = 0;
    broadcastCounts();
}
