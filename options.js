document.addEventListener('DOMContentLoaded', () => {
  const maxRecordingTimeInput = document.getElementById('maxRecordingTime');
  const captureNetworkCheckbox = document.getElementById('captureNetwork');
  const captureConsoleCheckbox = document.getElementById('captureConsole');
  const saveButton = document.getElementById('saveBtn');
  const status = document.getElementById('status');

  // Load current settings
  chrome.storage.local.get(
    {
      maxRecordingTime: 3600,
      captureNetwork: true,
      captureConsole: true
    },
    (items) => {
      maxRecordingTimeInput.value = items.maxRecordingTime;
      captureNetworkCheckbox.checked = items.captureNetwork;
      captureConsoleCheckbox.checked = items.captureConsole;
    }
  );

  // Save settings
  saveButton.addEventListener('click', () => {
    const maxRecordingTime = parseInt(maxRecordingTimeInput.value);
    
    if (maxRecordingTime < 1 || maxRecordingTime > 86400) {
      showStatus('Recording time must be between 1 and 86400 seconds', false);
      return;
    }

    chrome.storage.local.set(
      {
        maxRecordingTime: maxRecordingTime,
        captureNetwork: captureNetworkCheckbox.checked,
        captureConsole: captureConsoleCheckbox.checked
      },
      () => {
        showStatus('Settings saved successfully!', true);
      }
    );
  });

  function showStatus(message, success) {
    status.textContent = message;
    status.style.display = 'block';
    status.className = 'status ' + (success ? 'success' : 'error');
    
    setTimeout(() => {
      status.style.display = 'none';
    }, 3000);
  }
});
