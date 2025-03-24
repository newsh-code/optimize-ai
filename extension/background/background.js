// Background script for the AI Webpage Experimenter extension
// Handles API calls and communication between content script and popup

// Configuration for API calls
const BACKEND_CONFIG = {
  // OpenAI API endpoint
  HYPOTHESIS_ENDPOINT: "https://api.openai.com/v1/chat/completions",
  // OpenAI Multimodal API endpoint
  MULTIMODAL_ENDPOINT: "https://api.openai.com/v1/chat/completions",
  // API Key
  API_KEY: "your-openai-api-key", // Replace with your actual API key when deploying
  // For development/testing, set to false to use real API
  USE_MOCK_API: true // Set to false to use the real API
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
  if (!dataUrl) return null;
  const matches = dataUrl.match(/^data:image\/\w+;base64,(.+)$/);
  return matches ? matches[1] : null;
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

// Helper function to make API calls to OpenAI
async function callOpenAI(endpoint, requestData) {
  try {
    log("Calling OpenAI API with:", endpoint);
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${BACKEND_CONFIG.API_KEY}`
      },
      body: JSON.stringify(requestData)
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      const errorMessage = errorData?.error?.message || response.statusText;
      const statusCode = response.status;
      
      // Log detailed error information
      log(`API Error (${statusCode}):`, errorMessage);
      
      // Handle specific error cases
      if (statusCode === 401) {
        throw new Error("API key is invalid or expired. Please check your API key.");
      } else if (statusCode === 429) {
        throw new Error("Rate limit exceeded. Please try again later.");
      } else if (statusCode === 400 && errorMessage.includes("maximum context length")) {
        throw new Error("The input is too large for the model to process. Try with a smaller image or less text.");
      } else {
        throw new Error(`OpenAI API error (${statusCode}): ${errorMessage}`);
      }
    }
    
    return await response.json();
  } catch (error) {
    log("Error calling OpenAI API:", error);
    
    // Enhance network errors with more user-friendly messages
    if (error.message === "Failed to fetch" || error.name === "TypeError") {
      throw new Error("Network error when connecting to OpenAI. Please check your internet connection.");
    }
    
    throw error;
  }
}

// Parse OpenAI multimodal response into our expected format
function parseMultimodalResponse(apiResponse, screenshotUrl, hypothesis, initialAnalysis) {
  try {
    const responseContent = apiResponse.choices[0].message.content;
    log("Raw API response content:", responseContent);
    
    // Try to extract structured data from the response
    let parsedResponse;
    try {
      // Look for JSON in the response
      const jsonMatch = responseContent.match(/```json\n([\s\S]*?)\n```/) || 
                        responseContent.match(/```([\s\S]*?)```/);
      
      if (jsonMatch && jsonMatch[1]) {
        parsedResponse = JSON.parse(jsonMatch[1]);
      } else {
        // If no JSON found, parse the text into our format
        parsedResponse = {
          summary: responseContent.split('\n\n')[0] || "Analysis completed",
          annotations: [],
          suggestions: []
        };
        
        // Extract annotations (usually in bullet points)
        const annotationMatch = responseContent.match(/Annotations:([\s\S]*?)(?=Suggestions:|$)/i);
        if (annotationMatch) {
          const annotationText = annotationMatch[1];
          parsedResponse.annotations = annotationText
            .split(/\n-|\n\d+\./)
            .filter(item => item.trim().length > 0)
            .map(item => ({ text: item.trim() }));
        }
        
        // Extract suggestions
        const suggestionsMatch = responseContent.match(/Suggestions:([\s\S]*?)(?=$)/i);
        if (suggestionsMatch) {
          const suggestionsText = suggestionsMatch[1];
          parsedResponse.suggestions = suggestionsText
            .split(/\n-|\n\d+\./)
            .filter(item => item.trim().length > 0)
            .map(item => {
              const parts = item.split(/:(.+)/);
              return {
                element: parts[0]?.trim() || "Page element",
                change: parts[1]?.trim() || item.trim()
              };
            });
        }
      }
    } catch (parseError) {
      log("Error parsing API response:", parseError);
      // Fallback to simple format
      parsedResponse = {
        summary: "Analysis completed with parsing issues",
        annotations: [{ text: responseContent }],
        suggestions: []
      };
    }
    
    // Ensure the response has the expected format
    return {
      beforeScreenshot: screenshotUrl,
      hypothesis: hypothesis || "",
      summary: parsedResponse.summary || "Analysis completed",
      annotations: parsedResponse.annotations || [],
      suggestions: parsedResponse.suggestions || [],
      isInitialAnalysis: !!initialAnalysis
    };
  } catch (error) {
    log("Error parsing multimodal response:", error);
    throw error;
  }
}

// Parse OpenAI text-only response
function parseTextResponse(apiResponse, hypothesis) {
  try {
    const responseContent = apiResponse.choices[0].message.content;
    log("Raw API text response:", responseContent);
    
    // Try to extract structured data from the response
    let parsedResponse;
    try {
      // Look for JSON in the response
      const jsonMatch = responseContent.match(/```json\n([\s\S]*?)\n```/) || 
                        responseContent.match(/```([\s\S]*?)```/);
      
      if (jsonMatch && jsonMatch[1]) {
        parsedResponse = JSON.parse(jsonMatch[1]);
      } else {
        // If no JSON found, parse the text into our format
        parsedResponse = {
          summary: responseContent.split('\n\n')[0] || "Analysis completed",
          suggestions: []
        };
        
        // Extract suggestions
        const lines = responseContent.split('\n');
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          if (line.match(/^\d+\.|^-/)) {
            const parts = line.replace(/^\d+\.|-/, '').trim().split(/:(.+)/);
            if (parts.length >= 2) {
              parsedResponse.suggestions.push({
                element: parts[0].trim(),
                change: parts[1].trim()
              });
            } else {
              parsedResponse.suggestions.push({
                element: "Page element",
                change: parts[0].trim()
              });
            }
          }
        }
      }
    } catch (parseError) {
      log("Error parsing text API response:", parseError);
      // Fallback to simple format
      parsedResponse = {
        summary: "Interpretation completed with parsing issues",
        suggestions: [{ 
          element: "General", 
          change: responseContent 
        }]
      };
    }
    
    return {
      hypothesis: hypothesis,
      summary: parsedResponse.summary || "Interpretation completed",
      suggestions: parsedResponse.suggestions || []
    };
  } catch (error) {
    log("Error parsing text response:", error);
    throw error;
  }
}

// Send a status update to the popup
function sendStatusUpdate(tabId, status, error = null) {
  try {
    chrome.runtime.sendMessage({
      type: "STATUS_UPDATE",
      tabId: tabId,
      status: status,
      error: error
    }).catch(err => {
      // This is normal if the popup isn't open - don't log as an error
      if (DEBUG && !err.message.includes("receiving end does not exist")) {
        log("Error sending status update:", err);
      }
    });
  } catch (err) {
    // Catch any other errors that might occur
    if (DEBUG) {
      log("Error in sendStatusUpdate:", err);
    }
  }
}

// Analyze a webpage with the provided hypothesis
async function analyzeWebpage(tabId, hypothesis = null, initialAnalysis = false) {
  try {
    log(`Analyzing webpage for tab ${tabId} with hypothesis: ${hypothesis}`);
    
    // Inform the user we're starting analysis
    sendStatusUpdate(tabId, "Capturing screenshot...");
    
    // Capture a screenshot of the visible tab area
    const screenshotUrl = await captureVisibleTab(tabId);
    
    // Update status
    sendStatusUpdate(tabId, "Processing page elements...");
    
    // Get visible DOM elements
    const visibleDOM = await getVisibleDOM(tabId);
    
    log(`Found ${visibleDOM.length} visible DOM elements`);
    
    // Extract the base64 data from the data URL
    const base64Screenshot = extractBase64FromDataUrl(screenshotUrl);
    
    if (!base64Screenshot) {
      throw new Error("Failed to extract image data from screenshot");
    }
    
    // If using mock API for testing
    if (BACKEND_CONFIG.USE_MOCK_API) {
      // Update status for mock API
      sendStatusUpdate(tabId, "Using mock data (testing mode)...");
      return mockMultimodalApiResponse(screenshotUrl, visibleDOM, hypothesis, initialAnalysis);
    }
    
    // Update status for real API call
    sendStatusUpdate(tabId, initialAnalysis 
      ? "Analyzing page with AI..." 
      : "Analyzing page based on hypothesis...");
    
    // Prepare the payload for multimodal model
    const requestData = {
      model: "gpt-4-vision-preview",
      messages: [
        {
          role: "system",
          content: "You are a webpage optimization expert with deep knowledge of conversion rate optimization (CRO) best practices. Analyze the provided screenshot and webpage structure to identify opportunities for improvement. Provide your response in a structured format with Summary, Annotations, and Suggestions sections. For suggestions, specify both the target element and the recommended change."
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
    
    // Make the real API call
    const apiResponse = await callOpenAI(BACKEND_CONFIG.MULTIMODAL_ENDPOINT, requestData);
    
    // Update status for processing the response
    sendStatusUpdate(tabId, "Processing AI response...");
    
    // Parse the response
    return parseMultimodalResponse(apiResponse, screenshotUrl, hypothesis, initialAnalysis);
  } catch (error) {
    log("Error in analyzeWebpage:", error);
    // Send error status to the popup
    sendStatusUpdate(tabId, "error", error.message);
    throw error;
  }
}

// Create variation based on hypothesis and previous analysis
async function createVariation(tabId, hypothesis, baseAnalysis) {
  try {
    log(`Creating variation for tab ${tabId} with hypothesis: ${hypothesis}`);
    
    // Inform the user we're starting the variation process
    sendStatusUpdate(tabId, "Preparing to create variation...");
    
    // Use the existing screenshot from base analysis if available
    const screenshotUrl = baseAnalysis && baseAnalysis.beforeScreenshot 
      ? baseAnalysis.beforeScreenshot 
      : await captureVisibleTab(tabId);
    
    // Update status
    sendStatusUpdate(tabId, "Analyzing page elements...");
    
    // Get visible DOM elements
    const visibleDOM = await getVisibleDOM(tabId);
    
    log(`Creating variation using ${visibleDOM.length} DOM elements`);
    
    // If using mock API for testing
    if (BACKEND_CONFIG.USE_MOCK_API) {
      // Update status for mock API
      sendStatusUpdate(tabId, "Using mock data (testing mode)...");
      return mockMultimodalApiResponse(screenshotUrl, visibleDOM, hypothesis, false);
    }
    
    // Extract the base64 data from the data URL
    const base64Screenshot = extractBase64FromDataUrl(screenshotUrl);
    
    if (!base64Screenshot) {
      throw new Error("Failed to extract image data from screenshot");
    }
    
    // Update status for real API call
    sendStatusUpdate(tabId, "Creating variation with AI...");
    
    // Prepare the request data
    const requestData = {
      model: "gpt-4-vision-preview",
      messages: [
        {
          role: "system",
          content: "You are a conversion rate optimization expert. Generate specific webpage modifications based on the user's hypothesis and the current webpage screenshot. Provide your response in a structured format with Summary and Suggestions sections. For each suggestion, specify both the target element and the recommended change."
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Generate specific webpage element modifications based on this hypothesis: "${hypothesis}". Look at the current page and suggest practical changes that could be implemented.`
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
    
    // Make the real API call
    const apiResponse = await callOpenAI(BACKEND_CONFIG.MULTIMODAL_ENDPOINT, requestData);
    
    // Update status for processing the response
    sendStatusUpdate(tabId, "Processing AI suggestions...");
    
    // Parse the response
    return parseMultimodalResponse(apiResponse, screenshotUrl, hypothesis, false);
  } catch (error) {
    log("Error in createVariation:", error);
    // Send error status to the popup
    sendStatusUpdate(tabId, "error", error.message);
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
    
    // Prepare the request data
    const requestData = {
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are a conversion rate optimization expert. Generate specific webpage modifications based on the user's hypothesis. Provide your response in a structured format with Summary and Suggestions sections. For each suggestion, specify both the target element and the recommended change."
        },
        {
          role: "user",
          content: `Generate specific webpage element modifications based on this hypothesis: "${hypothesis}"`
        }
      ],
      max_tokens: 500
    };
    
    // Make the real API call
    const apiResponse = await callOpenAI(BACKEND_CONFIG.HYPOTHESIS_ENDPOINT, requestData);
    
    // Parse the response
    return parseTextResponse(apiResponse, hypothesis);
  } catch (error) {
    log("Error in interpretHypothesis:", error);
    throw error;
  }
} 