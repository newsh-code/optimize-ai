// DOM elements
const hypothesisInput = document.getElementById('hypothesis-input');
const submitBtn = document.getElementById('submit-btn');
const analyzeBtn = document.getElementById('analyze-btn');
const loadingEl = document.getElementById('loading');
const loadingMsg = document.getElementById('loading-message');
const resultsSection = document.getElementById('results-section');
const analysisHeader = document.getElementById('analysis-header');
const analysisTitle = document.getElementById('analysis-title');
const analysisDescription = document.getElementById('analysis-description');
const annotationsContainer = document.getElementById('annotations-container');
const annotationsList = document.getElementById('annotations-list');
const suggestionsContainer = document.getElementById('suggestions-container');
const screenshotContainer = document.getElementById('screenshot-container');
const applyBtn = document.getElementById('apply-btn');
const resetBtn = document.getElementById('reset-btn');
const reviewBtn = document.getElementById('review-btn');
const reviewContainer = document.getElementById('review-container');

// Store the current suggestions
let currentSuggestions = [];
let currentScreenshot = null;
let currentResults = null;
let afterScreenshot = null;
let changesApplied = false;

// Helper for logging
function log(...args) {
  console.log("[AI Webpage Experimenter]", ...args);
}

// Initialize the popup
document.addEventListener('DOMContentLoaded', () => {
  // Focus the hypothesis input
  hypothesisInput.focus();
  
  // Ensure loading indicator is hidden initially
  loadingEl.classList.add('hidden');
  
  // Create screenshot container if it doesn't exist
  if (!screenshotContainer) {
    log("Creating screenshot container element");
    screenshotContainer = document.createElement('div');
    screenshotContainer.id = 'screenshot-container';
    screenshotContainer.className = 'screenshot-container hidden';
    
    // Insert after analysis header
    if (analysisHeader && analysisHeader.parentNode) {
      analysisHeader.parentNode.insertBefore(screenshotContainer, analysisHeader.nextSibling);
    } else {
      // Fallback: add to results section
      resultsSection.appendChild(screenshotContainer);
    }
  }
  
  // Ensure review container is hidden initially
  if (reviewContainer) {
    reviewContainer.classList.add('hidden');
  }
  
  // Initialize review button as disabled
  if (reviewBtn) {
    reviewBtn.disabled = true;
  }
});

// Display error message in the UI
function displayError(message) {
  // Show results section with error
  resultsSection.classList.remove('hidden');
  suggestionsContainer.innerHTML = `
    <div class="error-message">
      <p>${message}</p>
      <p class="error-help">Please try again or check the console for more details.</p>
    </div>
  `;
}

// Display success message in the UI
function displaySuccessMessage(message) {
  // Create or update success message
  let successEl = document.getElementById('success-message');
  if (!successEl) {
    successEl = document.createElement('div');
    successEl.id = 'success-message';
    successEl.className = 'success-message';
    
    // Insert before the button row
    const buttonRow = applyBtn.closest('.button-row');
    if (buttonRow && buttonRow.parentNode) {
      buttonRow.parentNode.insertBefore(successEl, buttonRow);
    } else {
      // Fallback
      suggestionsContainer.after(successEl);
    }
  }
  
  successEl.textContent = message;
}

// Show loading state
function showLoading(message) {
  loadingMsg.textContent = message || "Processing hypothesis...";
  loadingEl.classList.remove('hidden');
  submitBtn.disabled = true;
  analyzeBtn.disabled = true;
  applyBtn.disabled = true;
  reviewBtn.disabled = true;
  resultsSection.classList.add('hidden');
}

// Hide loading state
function hideLoading() {
  loadingEl.classList.add('hidden');
  submitBtn.disabled = false;
  analyzeBtn.disabled = false;
  applyBtn.disabled = !currentSuggestions.length;
  
  // Only enable review button if changes have been applied
  if (changesApplied && reviewContainer) {
    reviewContainer.classList.remove('hidden');
    reviewBtn.disabled = false;
  } else {
    if (reviewContainer) {
      reviewContainer.classList.add('hidden');
    }
    reviewBtn.disabled = true;
  }
}

// Get the current active tab
async function getCurrentTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0];
}

// Capture a screenshot of the current tab
async function captureScreenshot(tabId) {
  try {
    log("Requesting screenshot capture for tab", tabId);
    
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        { action: 'captureScreenshot', tabId },
        (response) => {
          if (chrome.runtime.lastError) {
            log("Error capturing screenshot:", chrome.runtime.lastError);
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          
          if (response.error) {
            log("Screenshot capture failed:", response.error);
            reject(new Error(response.error));
            return;
          }
          
          if (!response.screenshotUrl) {
            log("No screenshot URL returned");
            reject(new Error("No screenshot URL returned"));
            return;
          }
          
          log("Screenshot captured successfully");
          resolve(response.screenshotUrl);
        }
      );
    });
  } catch (error) {
    log("Error in captureScreenshot function:", error);
    throw error;
  }
}

// Display the screenshot in the UI
function displayScreenshot(screenshotUrl) {
  if (!screenshotUrl) {
    log("No screenshot URL provided to display");
    screenshotContainer.classList.add('hidden');
    return;
  }
  
  log("Displaying screenshot in UI");
  
  // Store the current screenshot
  currentScreenshot = screenshotUrl;
  
  // Create screenshot element
  screenshotContainer.innerHTML = `
    <div class="screenshot-header">
      <h3>Webpage Screenshot</h3>
      <p class="screenshot-info">Screenshot used for visual analysis</p>
    </div>
    <div class="screenshot-image">
      <img src="${screenshotUrl}" alt="Webpage screenshot" />
    </div>
    <div class="screenshot-actions">
      <button id="toggle-screenshot-btn" class="secondary-btn">Hide Screenshot</button>
    </div>
  `;
  
  // Show the screenshot container
  screenshotContainer.classList.remove('hidden');
  
  // Add toggle functionality
  const toggleBtn = document.getElementById('toggle-screenshot-btn');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const imgContainer = screenshotContainer.querySelector('.screenshot-image');
      if (imgContainer.style.display === 'none') {
        imgContainer.style.display = 'block';
        toggleBtn.textContent = 'Hide Screenshot';
      } else {
        imgContainer.style.display = 'none';
        toggleBtn.textContent = 'Show Screenshot';
      }
    });
  }
}

// Submit hypothesis for basic suggestion generation (no page analysis)
submitBtn.addEventListener('click', async () => {
  const hypothesis = hypothesisInput.value.trim();
  
  if (!hypothesis) {
    alert('Please enter a hypothesis');
    return;
  }
  
  // Reset UI and state
  resetResults();
  changesApplied = false;
  
  // Show loading state
  showLoading("Generating ideas for your hypothesis...");
  
  try {
    log("Submitting hypothesis:", hypothesis);
    
    // Send message to background script to interpret hypothesis
    const response = await new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        { action: 'interpretHypothesis', hypothesis },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          
          log("Received response from background script:", response);
          resolve(response);
        }
      );
    });
    
    if (response && response.error) {
      log("Error from background script:", response.error);
      throw new Error(response.error);
    }
    
    // Check if the response has the expected format
    if (!response || !response.suggested_changes || !Array.isArray(response.suggested_changes)) {
      log("Invalid response format:", response);
      throw new Error("The server response did not contain valid suggestions. Please check the API endpoint.");
    }
    
    // Store current suggestions
    currentSuggestions = response.suggested_changes;
    
    // Set current results with basic structure
    currentResults = {
      type: 'hypothesis',
      hypothesis: hypothesis,
      suggestedChanges: currentSuggestions,
      timestamp: new Date().toISOString()
    };
    
    // Display the suggestions
    displaySuggestions(currentSuggestions);
    
    // Show results section
    resultsSection.classList.remove('hidden');
    
    // Enable apply button if we have suggestions
    applyBtn.disabled = !currentSuggestions.length;
  } catch (error) {
    log("Error processing hypothesis:", error);
    displayError(error.message);
  } finally {
    // Always hide loading indicator and enable buttons when done
    hideLoading();
  }
});

// Analyze webpage with hypothesis
analyzeBtn.addEventListener('click', async () => {
  const hypothesis = hypothesisInput.value.trim();
  
  if (!hypothesis) {
    alert('Please enter a hypothesis');
    return;
  }
  
  // Reset UI and state
  resetResults();
  changesApplied = false;
  
  try {
    // Get the current tab
    const tab = await getCurrentTab();
    
    // Show loading state
    showLoading("Capturing screenshot and analyzing webpage...");
    
    log("Analyzing webpage with hypothesis:", hypothesis);
    
    // Send message to background script to analyze webpage
    const response = await new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        { 
          action: 'analyzeWebpage', 
          tabId: tab.id,
          hypothesis: hypothesis
        },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          
          log("Received analysis response:", response);
          resolve(response);
        }
      );
    });
    
    if (response && response.error) {
      log("Error analyzing webpage:", response.error);
      throw new Error(response.error);
    }
    
    // Store the complete analysis results
    currentResults = {
      type: 'analysis',
      hypothesis: hypothesis,
      title: response.title || "Webpage Analysis",
      description: response.description || "",
      annotations: response.annotations || [],
      suggestedChanges: response.suggested_changes || [],
      beforeScreenshot: response.screenshotUrl,
      afterScreenshot: null,
      url: tab.url,
      timestamp: new Date().toISOString()
    };
    
    // Display the analysis results
    displayAnalysisResults(response);
    
    // Enable apply button if we have suggestions
    applyBtn.disabled = !currentSuggestions.length;
  } catch (error) {
    log("Error analyzing webpage:", error);
    displayError(error.message);
  } finally {
    // Always hide loading indicator and enable buttons when done
    hideLoading();
  }
});

// Display full analysis results including annotations and suggestions
function displayAnalysisResults(results) {
  // Show header with title and description
  analysisTitle.textContent = results.title || "Webpage Analysis";
  analysisDescription.textContent = results.description || "";
  analysisHeader.classList.remove('hidden');
  
  // Display screenshot if available
  if (results.screenshotUrl) {
    log("Screenshot URL found in results, displaying it");
    displayScreenshot(results.screenshotUrl);
  } else {
    log("No screenshot URL in results");
    screenshotContainer.classList.add('hidden');
  }
  
  // Display annotations if available
  if (results.annotations && results.annotations.length > 0) {
    displayAnnotations(results.annotations);
    annotationsContainer.classList.remove('hidden');
  }
  
  // Display suggestions
  if (results.suggested_changes && results.suggested_changes.length > 0) {
    currentSuggestions = results.suggested_changes;
    displaySuggestions(currentSuggestions);
  } else {
    suggestionsContainer.innerHTML = '<p>No specific changes suggested.</p>';
  }
  
  // Show the results section
  resultsSection.classList.remove('hidden');
}

// Display annotations in the UI
function displayAnnotations(annotations) {
  annotationsList.innerHTML = '';
  
  annotations.forEach(annotation => {
    const item = document.createElement('div');
    item.className = 'annotation-item';
    
    const title = document.createElement('div');
    title.className = 'annotation-title';
    title.textContent = annotation.title;
    
    const problem = document.createElement('div');
    problem.className = 'annotation-problem';
    problem.textContent = `Problem: ${annotation.problem}`;
    
    const suggestion = document.createElement('div');
    suggestion.className = 'annotation-suggestion';
    suggestion.textContent = `Solution: ${annotation.suggestion}`;
    
    item.appendChild(title);
    item.appendChild(problem);
    item.appendChild(suggestion);
    
    annotationsList.appendChild(item);
  });
}

// Apply changes to the DOM
applyBtn.addEventListener('click', async () => {
  if (!currentSuggestions.length) {
    alert('No suggestions to apply');
    return;
  }
  
  try {
    // Get the active tab
    const tab = await getCurrentTab();
    
    // Show loading 
    showLoading("Applying changes to webpage...");
    
    // Remove any existing success message
    const existingSuccessMsg = document.getElementById('success-message');
    if (existingSuccessMsg) {
      existingSuccessMsg.remove();
    }
    
    // Send changes to content script
    await new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(
        tab.id,
        { action: 'applyChanges', changes: currentSuggestions },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          
          if (response && response.success) {
            resolve(response);
          } else if (response && response.error) {
            reject(new Error(response.error));
          } else {
            reject(new Error("Unknown error applying changes"));
          }
        }
      );
    });
    
    // Add a small delay to ensure changes are rendered
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Capture the "after" screenshot
    afterScreenshot = await captureScreenshot(tab.id);
    log("Captured after-changes screenshot");
    
    // Update the current results with the after screenshot
    if (currentResults) {
      currentResults.afterScreenshot = afterScreenshot;
      
      // Save the complete review data to storage
      await saveReviewData(currentResults);
    }
    
    // Set changesApplied flag to true
    changesApplied = true;
    
    // Display success message
    displaySuccessMessage('Changes applied successfully! Click "Review Changes" to see the before & after comparison.');
    
    // Update UI to show review button
    if (reviewContainer) {
      reviewContainer.classList.remove('hidden');
    }
    reviewBtn.disabled = false;
  } catch (error) {
    log("Error applying changes:", error);
    
    // Show error message
    displayError(`Error applying changes: ${error.message}`);
    
    // Reset changesApplied flag
    changesApplied = false;
    
    // Hide review button
    if (reviewContainer) {
      reviewContainer.classList.add('hidden');
    }
    reviewBtn.disabled = true;
  } finally {
    // Hide loading
    hideLoading();
  }
});

// Reset the form and results
resetBtn.addEventListener('click', () => {
  hypothesisInput.value = '';
  resetResults();
  hypothesisInput.focus();
  changesApplied = false;
  
  // Hide the review container
  if (reviewContainer) {
    reviewContainer.classList.add('hidden');
  }
  
  // Remove any success message
  const successMsg = document.getElementById('success-message');
  if (successMsg) {
    successMsg.remove();
  }
});

// Open the Review Changes tab
reviewBtn.addEventListener('click', async () => {
  if (!currentResults || !changesApplied) {
    alert('Please apply changes before reviewing');
    return;
  }
  
  try {
    log("Opening review tab");
    
    // Create a new tab with review.html
    chrome.tabs.create({ 
      url: chrome.runtime.getURL("review/review.html")
    });
    
  } catch (error) {
    log("Error opening review tab:", error);
    alert(`Error opening review tab: ${error.message}`);
  }
});

// Save review data to chrome.storage.local
async function saveReviewData(data) {
  try {
    // Add a unique ID for this review session
    const reviewId = Date.now().toString();
    data.id = reviewId;
    
    await chrome.storage.local.set({ 
      currentReview: data,
      reviewId: reviewId
    });
    
    log("Review data saved to storage with ID:", reviewId);
    return reviewId;
  } catch (error) {
    log("Error saving review data:", error);
    throw error;
  }
}

// Reset all results sections
function resetResults() {
  // Hide all results containers
  resultsSection.classList.add('hidden');
  analysisHeader.classList.add('hidden');
  annotationsContainer.classList.add('hidden');
  if (screenshotContainer) {
    screenshotContainer.classList.add('hidden');
  }
  
  // Clear the containers
  annotationsList.innerHTML = '';
  suggestionsContainer.innerHTML = '';
  if (screenshotContainer) {
    screenshotContainer.innerHTML = '';
  }
  
  // Reset current data
  currentSuggestions = [];
  currentScreenshot = null;
  currentResults = null;
  afterScreenshot = null;
  changesApplied = false;
  
  // Disable the buttons
  applyBtn.disabled = true;
  reviewBtn.disabled = true;
  
  // Hide the review container
  if (reviewContainer) {
    reviewContainer.classList.add('hidden');
  }
}

// Display suggestions in the UI
function displaySuggestions(suggestions) {
  suggestionsContainer.innerHTML = '';
  
  if (!suggestions.length) {
    suggestionsContainer.innerHTML = '<p>No suggestions generated.</p>';
    return;
  }
  
  suggestions.forEach(suggestion => {
    const suggestionEl = document.createElement('div');
    suggestionEl.className = 'suggestion-item';
    
    const titleEl = document.createElement('div');
    titleEl.className = 'suggestion-title';
    titleEl.textContent = getSuggestionTitle(suggestion.action);
    
    const elementEl = document.createElement('div');
    elementEl.className = 'suggestion-element';
    elementEl.textContent = suggestion.element;
    
    const actionEl = document.createElement('div');
    actionEl.className = 'suggestion-action';
    actionEl.textContent = getSuggestionDescription(suggestion);
    
    suggestionEl.appendChild(titleEl);
    suggestionEl.appendChild(elementEl);
    suggestionEl.appendChild(actionEl);
    
    suggestionsContainer.appendChild(suggestionEl);
  });
}

// Get a human-readable title for a suggestion action
function getSuggestionTitle(action) {
  const titles = {
    'change_text': 'Change Text',
    'change_style': 'Modify Style',
    'change_attribute': 'Update Attribute',
    'increase_size': 'Increase Size',
    'change_color': 'Change Color',
    'add_emphasis': 'Add Emphasis',
    'reposition': 'Reposition Element'
  };
  
  return titles[action] || 'Modify Element';
}

// Get a human-readable description for a suggestion
function getSuggestionDescription(suggestion) {
  const { action, value } = suggestion;
  
  switch (action) {
    case 'change_text':
      return `Change text to: "${value}"`;
    case 'change_style':
      return `Apply styles: ${JSON.stringify(value)}`;
    case 'change_attribute':
      return `Set ${value.name} to "${value.value}"`;
    case 'increase_size':
      return 'Make element more prominent';
    case 'change_color':
      return `Change color to ${value}`;
    default:
      return JSON.stringify(value);
  }
} 