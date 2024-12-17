# Network & Console Logger Extension

A Microsoft Edge extension that captures and logs network requests and console output for debugging purposes.

## Features

- Captures all network requests made by web pages
- Logs all console output (log, info, warn, error, debug)
- Exports network logs in HAR format for compatibility with standard tools
- Exports console logs in JSON format for easy analysis
- Real-time logging with Chrome Debugger API integration
- Clean user interface showing recording time and log counts

## Recent Updates

### Version 1.2.0 (December 2024)
- Switched to Chrome Debugger API for more accurate network and console capture
- Implemented HAR format export for network logs
- Added JSON format export for console logs
- Improved save functionality with proper file download dialogs
- Enhanced error handling and stability
- Simplified UI by removing clear logs button
- Added proper cleanup of debugger connections

### Version 1.1.0 (December 2024)
- Implemented rolling log buffer system (keeps last 10,000 entries)
- Removed auto-restart functionality in favor of more stable log management
- Added robust error handling for runtime API access
- Improved message batching system with memory optimization
- Enhanced crash resistance and browser stability
- Updated UI to show formatted log counts with thousands separators

### Version 1.3.0 (Latest)
- Enhanced error logging to capture full stack traces and detailed error information
- Added automatic save dialog when stopping the recording (no need to click save button)
- Fixed tab handling for more reliable recording sessions

## Installation

1. Clone this repository or download the source code
2. Open Microsoft Edge and navigate to `edge://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the extension directory

## Usage

1. Click the extension icon in your browser toolbar
2. Click "Start Recording" to begin capturing logs
3. Navigate to web pages you want to monitor
4. View the captured network requests and console logs in real-time
5. Click "Stop Recording" when finished
6. Choose "Save" in the dialog to download your logs:
   - Network logs will be saved as a .har file
   - Console logs will be saved as a .json file

## Technical Details

The extension uses:
- Chrome Debugger API for accurate network and console capture
- Chrome Extension APIs (runtime, tabs, downloads)
- HAR format for network log export
- JSON format for console log export
- Proper cleanup of debugger connections

## Known Limitations

- Cannot capture logs from browser internal pages (chrome://, edge://, etc.)
- Extension must be manually loaded in developer mode
- Requires page refresh for capturing existing tabs when starting recording

## Troubleshooting

If you encounter issues:
1. Check that the extension has required permissions
2. Ensure developer mode is enabled
3. Try restarting the recording
4. Reload the extension if necessary

## Contributing

Feel free to submit issues and enhancement requests!

## License

[MIT License](LICENSE)
