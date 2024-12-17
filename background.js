let isRecording = false;
let recordingStartTime = null;
let networkLogs = [];
let consoleLogs = [];
let networkCount = 0;
let consoleCount = 0;
let attachedTabs = new Set();

// Initialize extension
chrome.runtime.onInstalled.addListener(() => {
    console.log('Extension installed');
});

// Message handling
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Received message:', message);

    switch (message.action) {
        case 'startRecording':
            startRecording();
            sendResponse({ success: true });
            break;

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

function startRecording() {
    if (isRecording) return;

    console.log('Starting recording');
    resetState();
    isRecording = true;
    recordingStartTime = Date.now();

    // Attach to all existing tabs
    chrome.tabs.query({}, (tabs) => {
        tabs.forEach(tab => {
            if (shouldAttachToTab(tab)) {
                attachDebugger(tab.id);
            }
        });
    });

    // Listen for new tabs
    chrome.tabs.onCreated.addListener(onTabCreated);
    chrome.tabs.onUpdated.addListener(onTabUpdated);

    broadcastState();
}

function stopRecording() {
    if (!isRecording) return;
    
    console.log('Stopping recording');
    isRecording = false;
    recordingStartTime = null;

    // Remove tab listeners
    chrome.tabs.onCreated.removeListener(onTabCreated);
    chrome.tabs.onUpdated.removeListener(onTabUpdated);

    // Detach debugger from all tabs
    for (const tabId of attachedTabs) {
        chrome.debugger.detach({ tabId }).catch(() => {
            console.log('Failed to detach debugger from tab:', tabId);
        });
    }
    attachedTabs.clear();

    // Show save dialog if there are logs to save
    if (networkLogs.length > 0 || consoleLogs.length > 0) {
        chrome.runtime.sendMessage({
            action: 'showSaveDialog',
            networkCount,
            consoleCount
        });
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
    if (attachedTabs.has(tabId)) return;

    chrome.debugger.attach({ tabId }, "1.2")
        .then(() => {
            console.log('Debugger attached to tab:', tabId);
            attachedTabs.add(tabId);
            
            // Enable network and console monitoring
            chrome.debugger.sendCommand({ tabId }, "Network.enable");
            chrome.debugger.sendCommand({ tabId }, "Console.enable");
        })
        .catch(error => {
            console.log('Failed to attach debugger:', error);
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
