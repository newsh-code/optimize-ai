# AI Webpage Experimenter Chrome Extension

A Chrome extension that allows users to input a hypothesis about webpage improvements, which the AI will interpret to generate variations of the webpage content in real-time.

## Features

### Hypothesis Input & Interpretation
- Enter your hypothesis about how a webpage could be improved
- AI interprets your hypothesis and suggests specific changes

### AI-Generated Page Variations
- Dynamically modifies webpage elements based on AI recommendations
- Applies conversion rate optimization (CRO) best practices

## Installation Instructions

### Development Mode
1. Clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top-right corner
4. Click "Load unpacked" and select the `extension` folder from this repository
5. The extension should now appear in your Chrome toolbar

## Usage

1. Navigate to the webpage you want to experiment with
2. Click the extension icon to open the popup
3. Enter your hypothesis in the input field (e.g., "Making the CTA button more prominent will increase conversions")
4. Click "Analyze"
5. Review the suggested changes
6. Click "Apply Changes" to implement the modifications on the current page

## Development

The extension consists of the following components:

- `manifest.json` - Configuration file for the Chrome extension
- `popup/` - User interface for the extension popup
- `background/` - Background scripts for API communication
- `content.js` - Content script that runs on webpages to apply changes

### Backend Setup

The extension communicates with a backend service that handles API requests to OpenAI. To set up your own backend:

1. Deploy a backend service that can handle requests from the extension
2. Update the `HYPOTHESIS_ENDPOINT` in `background/background.js` to point to your backend
3. Ensure your backend properly handles the hypothesis and returns the expected response format

## Future Features

- Page analysis with multimodal AI processing
- Export and documentation of changes
- Competitor alert feature

## License

This project is licensed under the MIT License. 