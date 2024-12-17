document.addEventListener('DOMContentLoaded', () => {
  const startStopBtn = document.getElementById('startStopBtn');
  const clearBtn = document.getElementById('clearBtn');
  const networkCount = document.getElementById('networkCount');
  const consoleCount = document.getElementById('consoleCount');
  const timerDisplay = document.getElementById('timer');
  const saveOverlay = document.getElementById('saveOverlay');
  const autoRestartCheckbox = document.getElementById('autoRestartCheckbox');
  
  let isRecording = false;
  let startTime = null;
  let timerInterval = null;
  
  function debugLog(message) {
    console.log(`[Popup Debug] ${message}`);
  }
  
  // First get the current state from the background script
  debugLog('Getting initial state');
  chrome.runtime.sendMessage({ action: 'getState' }, (response) => {
    if (response) {
      debugLog(`Got state: recording=${response.isRecording}, startTime=${response.recordingStartTime}`);
      isRecording = response.isRecording;
      startTime = response.recordingStartTime;
      
      // Immediately update counts
      networkCount.textContent = response.networkCount || '0';
      consoleCount.textContent = response.consoleCount || '0';
      
      updateRecordingState();
      if (isRecording && startTime) {
        startTimer();
      }
    } else {
      debugLog('No response received from getState');
    }
  });

  // Listen for messages from background script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    debugLog(`Received message: ${message.action || message.type}`);
    
    if (message.action === 'updateCounts') {
      updateLogCounts(message.networkCount, message.consoleCount);
      sendResponse();
    } else if (message.action === 'resetTimer') {
      startTime = message.startTime;
      startTimer();
      sendResponse();
    } else if (message.action === 'showSaveOverlay') {
      saveOverlay.style.display = 'flex';
      sendResponse();
    } else if (message.action === 'hideSaveOverlay') {
      saveOverlay.style.display = 'none';
      sendResponse();
    } else if (message.action === 'updateState') {
      debugLog(`State update: recording=${message.isRecording}, startTime=${message.recordingStartTime}`);
      isRecording = message.isRecording;
      startTime = message.recordingStartTime;
      updateRecordingState();
      if (isRecording && startTime) {
        startTimer();
      } else {
        stopTimer();
      }
      sendResponse();
    } else if (message.type === 'notification') {
      debugLog(`Notification: ${message.message}`);
      const notification = document.createElement('div');
      notification.className = 'notification';
      notification.textContent = message.message;
      document.body.appendChild(notification);
      
      // Use requestAnimationFrame for timing
      let start = performance.now();
      const duration = 5000; // 5 seconds
      
      function removeNotification(timestamp) {
        const elapsed = timestamp - start;
        if (elapsed >= duration) {
          notification.remove();
        } else {
          requestAnimationFrame(removeNotification);
        }
      }
      
      requestAnimationFrame(removeNotification);
      sendResponse();
    }
  });
  
  // Start/Stop button click handler
  startStopBtn.addEventListener('click', () => {
    debugLog(`Start/Stop clicked. Current state: recording=${isRecording}`);
    startStopBtn.disabled = true; // Prevent double-clicks
    
    if (isRecording) {
      debugLog('Sending stopRecording message');
      chrome.runtime.sendMessage({ action: 'stopRecording' }, () => {
        debugLog('Received stopRecording response');
        isRecording = false;
        startTime = null;
        stopTimer();
        updateRecordingState();
        startStopBtn.disabled = false;
      });
    } else {
      debugLog('Sending startRecording message');
      chrome.runtime.sendMessage({ action: 'startRecording' }, () => {
        debugLog('Received startRecording response');
        isRecording = true;
        startTime = Date.now();
        updateRecordingState();
        startTimer();
        startStopBtn.disabled = false;
      });
    }
  });
  
  // Clear button click handler
  clearBtn.addEventListener('click', () => {
    debugLog('Clear clicked');
    clearBtn.disabled = true;
    chrome.runtime.sendMessage({ action: 'clearLogs' }, () => {
      networkCount.textContent = '0';
      consoleCount.textContent = '0';
      clearBtn.disabled = false;
    });
  });
  
  // Auto-restart checkbox handler
  autoRestartCheckbox.addEventListener('change', () => {
    debugLog(`Auto-restart changed: ${autoRestartCheckbox.checked}`);
    chrome.runtime.sendMessage({
      action: 'updateAutoRestart',
      enabled: autoRestartCheckbox.checked
    });
  });
  
  function updateRecordingState() {
    debugLog(`Updating recording state: ${isRecording}`);
    startStopBtn.textContent = isRecording ? 'Stop Recording' : 'Start Recording';
    startStopBtn.className = isRecording ? 'stop' : 'start';
  }
  
  function startTimer() {
    stopTimer(); // Clear any existing timer
    
    if (!startTime) {
      timerDisplay.textContent = '00:00';
      return;
    }
    
    function updateDisplay() {
      if (!isRecording || !startTime) {
        stopTimer();
        return;
      }
      
      const now = Date.now();
      const elapsedTime = now - startTime;
      const elapsedSeconds = Math.floor(elapsedTime / 1000);
      
      timerDisplay.textContent = formatTime(elapsedSeconds);
    }
    
    updateDisplay(); // Initial update
    timerInterval = setInterval(updateDisplay, 1000);
  }
  
  function stopTimer() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }
  
  function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
  }
  
  function updateLogCounts(networkCountValue, consoleCountValue) {
    debugLog(`Updating counts: network=${networkCountValue}, console=${consoleCountValue}`);
    networkCount.textContent = networkCountValue;
    consoleCount.textContent = consoleCountValue;
  }
});
