document.addEventListener('DOMContentLoaded', () => {
    const startStopBtn = document.getElementById('startStopBtn');
    const saveOverlay = document.getElementById('saveOverlay');
    const saveLogs = document.getElementById('saveLogs');
    const cancelSave = document.getElementById('cancelSave');
    const networkCount = document.getElementById('networkCount');
    const consoleCount = document.getElementById('consoleCount');
    const timerDisplay = document.getElementById('timer');
    const saveMessage = document.getElementById('saveMessage');

    let isRecording = false;
    let startTime = null;
    let timerInterval = null;

    // Initialize state
    chrome.runtime.sendMessage({ action: 'getState' }, (response) => {
        if (chrome.runtime.lastError) {
            console.warn('Error getting initial state:', chrome.runtime.lastError);
            return;
        }
        if (response) {
            isRecording = response.isRecording;
            startTime = response.recordingStartTime;
            updateRecordingState();
            updateLogCounts(response.networkCount || 0, response.consoleCount || 0);
            if (isRecording && startTime) {
                startTimer();
            }
        }
    });

    // Listen for messages from background script
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === 'updateCounts') {
            updateLogCounts(message.networkCount, message.consoleCount);
        } else if (message.action === 'updateState') {
            isRecording = message.isRecording;
            startTime = message.recordingStartTime;
            updateRecordingState();
            if (isRecording && startTime) {
                startTimer();
            } else {
                stopTimer();
            }
        } else if (message.action === 'showSaveDialog') {
            saveMessage.textContent = `Save ${formatNumber(message.networkCount)} network requests and ${formatNumber(message.consoleCount)} console logs?`;
            saveOverlay.style.display = 'block';
        }
        sendResponse({ received: true });
    });

    // Start/Stop button
    startStopBtn.addEventListener('click', () => {
        startStopBtn.disabled = true;
        const action = isRecording ? 'stopRecording' : 'startRecording';
        
        chrome.runtime.sendMessage({ action }, (response) => {
            if (response && response.success) {
                isRecording = !isRecording;
                startTime = isRecording ? Date.now() : null;
                updateRecordingState();
                if (isRecording) {
                    startTimer();
                } else {
                    stopTimer();
                }
            }
            startStopBtn.disabled = false;
        });
    });

    // Save button
    saveLogs.addEventListener('click', () => {
        saveLogs.disabled = true;
        cancelSave.disabled = true;
        saveMessage.textContent = 'Saving logs...';
        
        chrome.runtime.sendMessage({ action: 'saveLogs' }, () => {
            saveOverlay.style.display = 'none';
            saveLogs.disabled = false;
            cancelSave.disabled = false;
            saveMessage.textContent = '';
        });
    });

    // Cancel button
    cancelSave.addEventListener('click', () => {
        saveOverlay.style.display = 'none';
        chrome.runtime.sendMessage({ action: 'cancelSave' });
    });

    function updateRecordingState() {
        startStopBtn.textContent = isRecording ? 'Stop Recording' : 'Start Recording';
        startStopBtn.className = isRecording ? 'stop' : 'start';
    }

    function startTimer() {
        stopTimer();
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

        updateDisplay();
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
        networkCount.textContent = formatNumber(networkCountValue);
        consoleCount.textContent = formatNumber(consoleCountValue);
    }

    function formatNumber(num) {
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    }
});
