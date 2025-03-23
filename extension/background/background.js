// Background script for the AI Webpage Experimenter extension
// Handles API calls and communication between content script and popup

// Configuration for API calls
const BACKEND_CONFIG = {
  // OpenAI API endpoint
  HYPOTHESIS_ENDPOINT: "https://api.openai.com/v1/chat/completions",
  // OpenAI Multimodal API endpoint
  MULTIMODAL_ENDPOINT: "https://api.openai.com/v1/chat/completions",
  // API Key
  API_KEY: "your-api-key-here", // Replace with your actual API key when deploying
  // For development/testing, set to false to use real API
  USE_MOCK_API: true

};

// Enable logging for debugging
const DEBUG = true;

// Helper function for logging
function log(...args) {
  if (DEBUG) {
    console.log("[AI Webpage Experimenter]", ...args);
  }
}

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "interpretHypothesis") {
    log("Received hypothesis:", message.hypothesis);
    interpretHypothesis(message.hypothesis)
      .then(response => {
        log("API response success:", response);
        sendResponse(response);
      })
      .catch(error => {
        log("API response error:", error.message);
        sendResponse({ error: error.message });
      });
    return true; // Required for async sendResponse
  } else if (message.action === "analyzeWebpage") {
    log("Received request to analyze webpage");
    analyzeWebpage(message.tabId, message.hypothesis, message.initialAnalysis)
      .then(response => {
        log("Webpage analysis success:", response);
        sendResponse(response);
      })
      .catch(error => {
        log("Webpage analysis error:", error.message);
        sendResponse({ error: error.message });
      });
    return true; // Required for async sendResponse
  } else if (message.action === "createVariation") {
    log("Received request to create variation based on hypothesis");
    createVariation(message.tabId, message.hypothesis, message.baseAnalysis)
      .then(response => {
        log("Variation creation success:", response);
        sendResponse(response);
      })
      .catch(error => {
        log("Variation creation error:", error.message);
        sendResponse({ error: error.message });
      });
    return true; // Required for async sendResponse
  } else if (message.action === "captureScreenshot") {
    log("Received request to capture screenshot");
    captureVisibleTab(message.tabId)
      .then(screenshotUrl => {
        log("Screenshot capture success, returning to popup");
        sendResponse({ screenshotUrl });
      })
      .catch(error => {
        log("Screenshot capture error:", error.message);
        sendResponse({ error: error.message });
      });
    return true; // Required for async sendResponse
  } else if (message.action === "getSuggestions") {
    log("Received request to get stored suggestions");
    chrome.storage.local.get(['suggestions'], (result) => {
      log("Retrieved suggestions from storage:", result.suggestions ? `${result.suggestions.length} items` : "none");
      sendResponse({ suggestions: result.suggestions || [] });
    });
    return true; // Required for async sendResponse
  }
});

// Ensure content script is loaded in the tab
async function ensureContentScriptLoaded(tabId) {
  try {
    log(`Ensuring content script is loaded in tab ${tabId}`);
    
    // Try to ping the content script to see if it's loaded
    return new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(tabId, { action: "ping" }, response => {
        if (chrome.runtime.lastError) {
          log("Content script not loaded, injecting now");
          
          // Script isn't loaded, inject it
          chrome.scripting.executeScript({
            target: { tabId: tabId },
            files: ["content.js"]
          })
          .then(() => {
            log("Content script injected successfully");
            // Give the script a moment to initialize
            setTimeout(resolve, 200);
          })
          .catch(error => {
            log("Failed to inject content script:", error);
            reject(new Error("Failed to inject content script: " + error.message));
          });
        } else {
          log("Content script is already loaded");
          resolve();
        }
      });
    });
  } catch (error) {
    log("Error ensuring content script is loaded:", error);
    throw error;
  }
}

// Capture screenshot of the active tab
async function captureVisibleTab(tabId) {
  try {
    log(`Capturing screenshot of tab ${tabId}`);
    
    // Ensure we have permissions to capture
    const permissions = await chrome.permissions.contains({
      permissions: ['activeTab'],
      origins: ['<all_urls>']
    });
    
    if (!permissions) {
      log("Missing required permissions for screenshot capture");
      throw new Error("Missing permissions for screenshot capture");
    }
    
    // Capture the screenshot
    const screenshotUrl = await chrome.tabs.captureVisibleTab(null, {
      format: "png",
      quality: 100
    });
    
    // Validate screenshot data
    if (!screenshotUrl || !screenshotUrl.startsWith('data:image/')) {
      log("Invalid screenshot data returned:", screenshotUrl ? screenshotUrl.substring(0, 50) + "..." : "null");
      throw new Error("Failed to capture valid screenshot");
    }
    
    log("Screenshot captured successfully", screenshotUrl.substring(0, 50) + "...");
    return screenshotUrl;
  } catch (error) {
    log("Error capturing screenshot:", error);
    throw new Error(`Failed to capture screenshot: ${error.message}`);
  }
}

// Extract base64 data from a data URL
function extractBase64FromDataUrl(dataUrl) {
  if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.includes(',')) {
    log("Invalid data URL format:", dataUrl ? dataUrl.substring(0, 50) + "..." : "null");
    return null;
  }
  return dataUrl.split(",")[1];
}

// Get visible DOM elements from the page
async function getVisibleDOM(tabId) {
  try {
    // First ensure content script is loaded
    await ensureContentScriptLoaded(tabId);
    
    return new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(tabId, { action: "getVisibleDOM" }, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(`Failed to get visible DOM: ${chrome.runtime.lastError.message}`));
          return;
        }
        
        if (!response || !response.visibleDOM) {
          reject(new Error("No DOM data received from content script"));
          return;
        }
        
        resolve(response.visibleDOM);
      });
    });
  } catch (error) {
    log("Error getting visible DOM:", error);
    throw error;
  }
}

// Mock API implementation for testing
function mockApiResponse(hypothesis) {
  log("Using mock API response for hypothesis:", hypothesis);
  
  // Simulate network delay
  return new Promise(resolve => {
    setTimeout(() => {
      // Generate mock suggestions based on the hypothesis
      let suggestions = [];
      
      if (hypothesis.toLowerCase().includes("cta") || 
          hypothesis.toLowerCase().includes("button")) {
        suggestions.push({
          element: ".cta-button, button.primary",
          action: "increase_size",
          value: {
            transform: "scale(1.2)",
            padding: "12px 24px"
          }
        });
        
        suggestions.push({
          element: ".cta-button, button.primary",
          action: "change_color",
          value: "#ff6b00"
        });
      }
      
      if (hypothesis.toLowerCase().includes("headline") || 
          hypothesis.toLowerCase().includes("title")) {
        suggestions.push({
          element: "h1, .headline, .title",
          action: "change_style",
          value: {
            fontSize: "32px",
            fontWeight: "bold",
            color: "#333333"
          }
        });
      }
      
      if (hypothesis.toLowerCase().includes("text") || 
          hypothesis.toLowerCase().includes("content")) {
        suggestions.push({
          element: "p, .content",
          action: "change_style",
          value: {
            lineHeight: "1.6",
            fontSize: "16px"
          }
        });
      }
      
      // If no specific elements were identified, suggest general improvements
      if (suggestions.length === 0) {
        suggestions = [
          {
            element: "a.cta, button.primary",
            action: "change_color",
            value: "#ff6b00"
          },
          {
            element: "h1, .headline",
            action: "change_style",
            value: {
              fontSize: "28px",
              marginBottom: "20px"
            }
          }
        ];
      }
      
      resolve({
        suggested_changes: suggestions
      });
    }, 800); // Simulate network delay
  });
}

// Mock analysis API response for testing
async function mockMultimodalApiResponse(screenshot, visibleDOM, hypothesis = null, isInitialAnalysis = false) {
  log("Using mock multimodal API response", isInitialAnalysis ? "for initial analysis" : "with hypothesis:", hypothesis);
  
  // Simulate network delay
  return new Promise(resolve => {
    setTimeout(() => {
      // Extract some DOM stats for the mock response
      const elementTypes = {};
      visibleDOM.forEach(el => {
        const type = el.tagName.toLowerCase();
        elementTypes[type] = (elementTypes[type] || 0) + 1;
      });
      
      // Generate a readable summary of the DOM
      const elementSummary = Object.entries(elementTypes)
        .map(([type, count]) => `${count} ${type} elements`)
        .join(", ");
      
      // Create mock annotations
      const annotations = [
        {
          title: "Visual Hierarchy Issues",
          problem: "The page lacks clear visual hierarchy, making it difficult for users to identify primary actions.",
          suggestion: "Enhance the contrast between primary and secondary elements to guide user attention."
        },
        {
          title: "Call-to-Action Visibility",
          problem: "The main call-to-action buttons blend in with the surrounding content.",
          suggestion: "Increase button size and use a contrasting color to make CTAs stand out."
        },
        {
          title: "Content Readability",
          problem: "Text content is dense and lacks proper spacing, reducing readability.",
          suggestion: "Increase line height and paragraph spacing to improve content scanability."
        }
      ];
      
      // Create response structure based on whether this is initial analysis or not
      if (isInitialAnalysis) {
        // For initial analysis (without hypothesis), provide analysis without suggestions
        resolve({
          title: "Initial Page Analysis",
          description: `This page contains ${visibleDOM.length} visible elements, including ${elementSummary}. The layout could be improved for better conversion rates.`,
          annotations: annotations.slice(0, 2), // Just first two annotations
          screenshotUrl: screenshot
        });
      } else {
        // For analysis with hypothesis, provide suggestions too
        let suggested_changes = [];
        
        // Generate mock suggestions based on the hypothesis
        if (hypothesis.toLowerCase().includes("cta") || 
            hypothesis.toLowerCase().includes("button")) {
          suggested_changes.push({
            element: "button, .btn, .cta",
            action: "increase_size",
            value: {
              transform: "scale(1.15)",
              padding: "12px 24px"
            }
          });
          
          suggested_changes.push({
            element: "button, .btn, .cta",
            action: "change_color",
            value: "#ff6b00"
          });
        }
        
        if (hypothesis.toLowerCase().includes("headline") || 
            hypothesis.toLowerCase().includes("title")) {
          suggested_changes.push({
            element: "h1, h2, .title",
            action: "change_style",
            value: {
              fontSize: "32px",
              fontWeight: "bold",
              color: "#333333"
            }
          });
        }
        
        // Default suggestions if none matched
        if (suggested_changes.length === 0) {
          suggested_changes = [
            {
              element: "button.primary, .cta-button",
              action: "change_color",
              value: "#ff6b00"
            },
            {
              element: "h1, .main-title",
              action: "change_style",
              value: {
                fontSize: "32px",
                fontWeight: "bold"
              }
            },
            {
              element: "p, .content",
              action: "change_style",
              value: {
                lineHeight: "1.6"
              }
            }
          ];
        }
        
        resolve({
          title: "Hypothesis-Based Analysis",
          description: `Based on your hypothesis "${hypothesis}", we've analyzed the page and identified several opportunities for improvement.`,
          annotations: annotations,
          suggested_changes: suggested_changes,
          screenshotUrl: screenshot
        });
      }
    }, 1500); // Longer delay for multimodal processing
  });
}

// Analyze webpage with multimodal processing
async function analyzeWebpage(tabId, hypothesis, initialAnalysis = false) {
  try {
    log(`Analyzing webpage for tab ${tabId}`, initialAnalysis ? "as initial analysis" : "with hypothesis:", hypothesis);
    
    // Get screenshot of the current tab
    const screenshotUrl = await captureVisibleTab(tabId);
    
    // Get visible DOM elements
    const visibleDOM = await getVisibleDOM(tabId);
    
    log(`Successfully captured screenshot and DOM (${visibleDOM.length} elements)`);
    
    // Extract base64 image data for API call
    const base64Screenshot = extractBase64FromDataUrl(screenshotUrl);
    
    if (!base64Screenshot) {
      throw new Error("Failed to extract image data from screenshot");
    }
    
    // If using mock API for testing
    if (BACKEND_CONFIG.USE_MOCK_API) {
      return mockMultimodalApiResponse(screenshotUrl, visibleDOM, hypothesis, initialAnalysis);
    }
    
    // TODO: Real API implementation
    // This would call the actual OpenAI API or your backend service
    // Prepare the payload for multimodal model
    const requestData = {
      model: "gpt-4-vision-preview",
      messages: [
        {
          role: "system",
          content: "You are a webpage optimization expert with deep knowledge of conversion rate optimization (CRO) best practices. Analyze the provided screenshot and webpage structure to identify opportunities for improvement."
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: initialAnalysis 
                ? "Please analyze this webpage and identify opportunities for improvement. Focus on visual hierarchy, readability, and call-to-action elements."
                : `Please analyze this webpage based on the hypothesis: "${hypothesis}". Suggest specific changes to improve conversion rates.`
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/png;base64,${base64Screenshot}`
              }
            }
          ]
        }
      ],
      max_tokens: 1000
    };
    
    // For full implementation, this would make a real API call
    // For now, return mock data
    return mockMultimodalApiResponse(screenshotUrl, visibleDOM, hypothesis, initialAnalysis);
  } catch (error) {
    log("Error in analyzeWebpage:", error);
    throw error;
  }
}

// Create variation based on hypothesis and previous analysis
async function createVariation(tabId, hypothesis, baseAnalysis) {
  try {
    log(`Creating variation for tab ${tabId} with hypothesis: ${hypothesis}`);
    
    // Use the existing screenshot from base analysis if available
    const screenshotUrl = baseAnalysis && baseAnalysis.beforeScreenshot 
      ? baseAnalysis.beforeScreenshot 
      : await captureVisibleTab(tabId);
    
    // Get visible DOM elements
    const visibleDOM = await getVisibleDOM(tabId);
    
    log(`Creating variation using ${visibleDOM.length} DOM elements`);
    
    // If using mock API for testing
    if (BACKEND_CONFIG.USE_MOCK_API) {
      return mockMultimodalApiResponse(screenshotUrl, visibleDOM, hypothesis, false);
    }
    
    // TODO: Real API implementation for variation creation
    // This would use the actual OpenAI API or your backend service
    
    // For now, return mock data
    return mockMultimodalApiResponse(screenshotUrl, visibleDOM, hypothesis, false);
  } catch (error) {
    log("Error in createVariation:", error);
    throw error;
  }
}

// Interpret hypothesis without page analysis
async function interpretHypothesis(hypothesis) {
  try {
    log("Interpreting hypothesis:", hypothesis);
    
    // If using mock API for testing
    if (BACKEND_CONFIG.USE_MOCK_API) {
      return mockApiResponse(hypothesis);
    }
    
    // For a real implementation, this would call the API
    const requestData = {
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are a conversion rate optimization expert. Generate specific webpage modifications based on the user's hypothesis."
        },
        {
          role: "user",
          content: `Generate specific webpage element modifications based on this hypothesis: "${hypothesis}"`
        }
      ],
      max_tokens: 500
    };
    
    // TODO: Make real API call
    // For now, return mock data
    return mockApiResponse(hypothesis);
  } catch (error) {
    log("Error in interpretHypothesis:", error);
    throw error;
  }
} 