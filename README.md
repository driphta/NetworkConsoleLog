# Edge Network & Console Logger Extension

A Microsoft Edge extension that captures and saves network requests and console logs in HAR format. Perfect for debugging and monitoring web applications.

## Features

- Record network requests in HAR format
- Capture console logs (info, warn, error, debug)
- Auto-restart capability to handle long recording sessions
- Simple popup interface for controlling recording
- Keyboard shortcuts for quick access
- Export logs in industry-standard formats (HAR for network, text for console)

## Installation

1. Clone this repository or download the source code
2. Open Microsoft Edge and navigate to `edge://extensions/`
3. Enable "Developer mode" in the bottom-left corner
4. Click "Load unpacked" and select the extension directory

## Usage

1. Click the extension icon in the toolbar to open the popup interface
2. Click "Start Recording" to begin capturing logs
3. Navigate websites as normal - all network requests and console logs will be captured
4. Click "Stop Recording" when finished
5. Click "Save Logs" to download:
   - Network logs as `.har` file
   - Console logs as `.log` file

### Keyboard Shortcuts

- `Ctrl+Shift+R`: Toggle recording
- `Ctrl+Shift+C`: Clear logs

## File Structure

- `manifest.json`: Extension configuration
- `popup.html/js`: User interface
- `background.js`: Core recording functionality
- `console-logger.js`: Console capture implementation
- `options.html/js`: Settings page
- `icons/`: Extension icons

## Permissions

The extension requires the following permissions:
- `webRequest`: To capture network requests
- `downloads`: To save log files
- `storage`: To persist settings
- `scripting`: To inject console logging
- `tabs`: To track tabs and inject scripts

## Development

To modify or enhance the extension:

1. Make your changes to the source files
2. Reload the extension in Edge
3. Test your changes
4. Submit a pull request if you'd like to contribute

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
