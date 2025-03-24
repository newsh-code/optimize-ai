# OpenAI API Integration

This document outlines the changes made to integrate the extension with OpenAI's API.

## Overview of Changes

1. Replaced mock API responses with real OpenAI API calls
2. Added robust error handling for API requests
3. Implemented status updates to keep users informed
4. Added response parsing to convert OpenAI's responses to the extension's format

## Files Modified

- `extension/background/background.js` - Main integration code

## API Usage

The extension now uses the following OpenAI endpoints:

1. `https://api.openai.com/v1/chat/completions` - For both text-only and multimodal (vision) requests

## Configuration

The API configuration is stored in the `BACKEND_CONFIG` object in `background.js`:

```javascript
const BACKEND_CONFIG = {
  HYPOTHESIS_ENDPOINT: "https://api.openai.com/v1/chat/completions",
  MULTIMODAL_ENDPOINT: "https://api.openai.com/v1/chat/completions",
  API_KEY: "your-api-key-here",
  USE_MOCK_API: false  // Set to true for testing without API calls
};
```

## Functions Added

1. `callOpenAI(endpoint, requestData)` - Helper function to make API requests with proper error handling
2. `parseMultimodalResponse(apiResponse, ...)` - Parses vision API responses
3. `parseTextResponse(apiResponse, hypothesis)` - Parses text-only API responses
4. `sendStatusUpdate(tabId, status, error)` - Sends status updates to the popup UI

## Response Format

The extension expects responses in the following format:

For multimodal responses:
```javascript
{
  beforeScreenshot: string,  // Screenshot data URL
  hypothesis: string,        // User hypothesis if provided
  summary: string,           // Summary of the analysis
  annotations: Array<{text: string}>,  // Analysis observations
  suggestions: Array<{element: string, change: string}>,  // Suggested changes
  isInitialAnalysis: boolean  // Whether this is the initial page analysis
}
```

For text-only responses:
```javascript
{
  hypothesis: string,  // User hypothesis
  summary: string,     // Summary of the interpretation
  suggestions: Array<{element: string, change: string}>  // Suggested changes
}
```

## Error Handling

Specific error handling has been implemented for:
- Invalid API keys (401)
- Rate limiting (429) 
- Context length issues (400)
- Network connectivity problems

## User Experience Improvements

- Added status updates during API calls
- Detailed error messages for troubleshooting
- Loading indicators with descriptive status messages

## Testing

To test the API integration:
1. Ensure `BACKEND_CONFIG.USE_MOCK_API` is set to `false`
2. Make sure a valid OpenAI API key is provided
3. Test basic functionality (initial analysis, hypothesis testing)
4. Test error scenarios (invalid API key, network issues) 