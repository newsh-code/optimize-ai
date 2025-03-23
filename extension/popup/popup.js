// DOM elements
const initialView = document.getElementById('initial-view');
const analysisView = document.getElementById('analysis-view');
const hypothesisInput = document.getElementById('hypothesis-input');
const hypothesisSection = document.getElementById('hypothesis-section');
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

// Store the current state
let currentSuggestions = [];
let currentScreenshot = null;
let currentResults = null;
let afterScreenshot = null;
let changesApplied = false;
let pageAnalyzed = false;

// Helper for logging
function log(...args) {
  console.log("[AI Webpage Experimenter]", ...args);
}

// Initialize the popup
document.addEventListener('DOMContentLoaded', async () => {
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
  
  // Check for saved state
  await checkAndRestorePopupState();
  
  // Log that popup is initialized
  log("Popup initialized with new workflow. DOM state:", document.body.innerHTML.length, "bytes");
});

// Display error message in the UI
function displayError(message) {
  // Show error in the current view
  suggestionsContainer.innerHTML = `
    <div class="error-message">
      <p>${message}</p>
      <p class="error-help">Please try again or check the console for more details.</p>
    </div>
  `;
  
  // Update popup state
  document.body.setAttribute('data-popup-state', 'error');
}

// Display a success message
function displaySuccessMessage(message, additionalInfo) {
  // Remove any existing success message
  const existingSuccessMsg = document.getElementById('success-message');
  if (existingSuccessMsg) {
    existingSuccessMsg.remove();
  }
  
  // Create the success message container
  const successMsgContainer = document.createElement('div');
  successMsgContainer.id = 'success-message';
  successMsgContainer.className = 'success-message';
  successMsgContainer.textContent = message;
  
  // If additional info is provided, add it below the success message
  if (additionalInfo) {
    const additionalInfoEl = document.createElement('div');
    additionalInfoEl.className = 'additional-info';
    additionalInfoEl.innerHTML = additionalInfo;
    successMsgContainer.appendChild(additionalInfoEl);
  }
  
  // Insert the success message before the results section
  if (resultsSection && resultsSection.parentNode) {
    resultsSection.parentNode.insertBefore(successMsgContainer, resultsSection);
  } else {
    log("Error: Could not find results section to append success message");
    // Fallback to appending to the body
    document.body.appendChild(successMsgContainer);
  }
  
  // Mark the body with changes-applied state
  document.body.setAttribute('data-popup-state', 'changes-applied');
}

// Show loading state
function showLoading(message) {
  loadingMsg.textContent = message || "Processing...";
  loadingEl.classList.remove('hidden');
  
  // Disable all action buttons
  if (analyzeBtn) analyzeBtn.disabled = true;
  if (submitBtn) submitBtn.disabled = true;
  if (applyBtn) applyBtn.disabled = true;
  if (reviewBtn) reviewBtn.disabled = true;
}

// Hide loading state
function hideLoading() {
  loadingEl.classList.add('hidden');
  
  // Enable appropriate buttons based on state
  if (analyzeBtn) analyzeBtn.disabled = false;
  if (submitBtn && pageAnalyzed) submitBtn.disabled = false;
  if (applyBtn) applyBtn.disabled = !currentSuggestions.length;
  
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

// Analyze Page - This is now the first step in the workflow
analyzeBtn.addEventListener('click', async () => {
  try {
    // Update UI state
    initialView.classList.add('hidden');
    document.body.setAttribute('data-popup-state', 'analyzing');
    
    // Get the current tab
    const tab = await getCurrentTab();
    
    // Show loading state
    showLoading("Capturing screenshot and analyzing webpage...");
    
    log("Analyzing webpage");
    
    // Send message to background script to analyze webpage
    const response = await new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        { 
          action: 'analyzeWebpage', 
          tabId: tab.id,
          initialAnalysis: true // Flag to indicate this is the initial analysis without hypothesis
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
    
    // Store the analysis results
    currentResults = {
      type: 'analysis',
      title: response.title || "Page Analysis",
      description: response.description || "",
      annotations: response.annotations || [],
      beforeScreenshot: response.screenshotUrl,
      afterScreenshot: null,
      url: tab.url,
      timestamp: new Date().toISOString()
    };
    
    // Display the analysis results
    displayAnalysisResults(response);
    
    // Show the hypothesis input section
    analysisView.classList.remove('hidden');
    
    // Focus on the hypothesis input
    hypothesisInput.focus();
    
    // Set the pageAnalyzed flag
    pageAnalyzed = true;
    
    // Update popup state
    document.body.setAttribute('data-popup-state', 'analyzed');
    
    // Save state to storage
    await savePopupState();
    
  } catch (error) {
    log("Error analyzing webpage:", error);
    displayError(error.message);
    
    // Show initial view again if there was an error
    initialView.classList.remove('hidden');
  } finally {
    // Always hide loading indicator when done
    hideLoading();
  }
});

// Create Variation - This is the second step in the workflow
submitBtn.addEventListener('click', async () => {
  const hypothesis = hypothesisInput.value.trim();
  
  if (!hypothesis) {
    alert('Please enter a hypothesis');
    return;
  }
  
  // Update UI
  resultsSection.classList.add('hidden');
  document.body.setAttribute('data-popup-state', 'processing');
  changesApplied = false;
  
  // Show loading state
  showLoading("Creating variation based on your hypothesis...");
  
  try {
    log("Processing hypothesis:", hypothesis);
    
    // Get the current tab
    const tab = await getCurrentTab();
    
    // Send message to background script to create variation
    const response = await new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        { 
          action: 'createVariation', 
          tabId: tab.id,
          hypothesis: hypothesis,
          baseAnalysis: currentResults
        },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          
          log("Received variation response:", response);
          resolve(response);
        }
      );
    });
    
    if (response && response.error) {
      log("Error creating variation:", response.error);
      throw new Error(response.error);
    }
    
    // Update the current results with variation data
    if (currentResults) {
      currentResults.hypothesis = hypothesis;
      currentResults.suggestedChanges = response.suggested_changes || [];
      
      // Update annotations if we have new ones
      if (response.annotations && response.annotations.length > 0) {
        currentResults.annotations = response.annotations;
        // Update the annotations display
        displayAnnotations(response.annotations);
        annotationsContainer.classList.remove('hidden');
      }
    }
    
    // Store current suggestions
    currentSuggestions = response.suggested_changes || [];
    
    // Display the variation results
    displayVariationResults(response);
    
    // Enable apply button if we have suggestions
    applyBtn.disabled = !currentSuggestions.length;
    
    // Save state to storage
    await savePopupState();
    
  } catch (error) {
    log("Error creating variation:", error);
    displayError(error.message);
  } finally {
    // Always hide loading indicator when done
    hideLoading();
  }
});

// Display full analysis results including annotations
function displayAnalysisResults(results) {
  // Show header with title and description
  analysisTitle.textContent = results.title || "Page Analysis";
  analysisDescription.textContent = results.description || "";
  
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
}

// Display variation results with suggestions
function displayVariationResults(results) {
  // Display suggestions
  if (results.suggested_changes && results.suggested_changes.length > 0) {
    displaySuggestions(results.suggested_changes);
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

// Apply Changes - This sends the changes to the content script
applyBtn.addEventListener('click', async (e) => {
  // Log the current popup state
  log("Apply button clicked, current popup state:", document.body.getAttribute('data-popup-state'));
  
  // Prevent default button behavior to avoid issues
  e.preventDefault();
  
  // Capture important DOM elements to keep references even if popup is recreated
  const domElements = {
    initial: initialView,
    analysis: analysisView,
    hypothesisInput: hypothesisInput,
    loadingEl: loadingEl,
    loadingMsg: loadingMsg,
    resultsSection: resultsSection,
    analysisHeader: analysisHeader,
    annotationsContainer: annotationsContainer,
    annotationsList: annotationsList,
    suggestionsContainer: suggestionsContainer,
    reviewContainer: reviewContainer,
    reviewBtn: reviewBtn,
    applyBtn: applyBtn,
    resetBtn: resetBtn
  };
  
  try {
    // Mark the body to show processing state
    document.body.setAttribute('data-popup-state', 'processing');
    
    // Get the active tab
    const tab = await getCurrentTab();
    
    // Show loading 
    showLoading("Applying changes to webpage...");
    
    // Remove any existing success message
    const existingSuccessMsg = document.getElementById('success-message');
    if (existingSuccessMsg) {
      existingSuccessMsg.remove();
    }
    
    // Create a lightweight copy for storage (without screenshots)
    const storedHypothesis = hypothesisInput.value.trim();
    let storedResults = null;
    
    if (currentResults) {
      storedResults = JSON.parse(JSON.stringify(currentResults));
      delete storedResults.beforeScreenshot;
      delete storedResults.afterScreenshot;
    }
    
    const storedSuggestions = JSON.parse(JSON.stringify(currentSuggestions || []));
    
    // Save state to storage in case popup reloads
    try {
      await chrome.storage.local.set({
        popupState: {
          hypothesis: storedHypothesis,
          results: storedResults,
          suggestions: storedSuggestions,
          timestamp: Date.now(),
          hasChangesApplied: true,
          pageAnalyzed: true
        },
        // Also store suggestions separately for the toggle functionality
        suggestions: storedSuggestions
      });
      log("Saved popup state and suggestions to storage");
    } catch (storageError) {
      log("Error saving popup state:", storageError);
    }
    
    // Send changes to content script
    await new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(
        tab.id,
        { 
          action: 'applyChanges', 
          changes: currentSuggestions,
          preventPopupClose: true // Signal to keep popup open
        },
        (response) => {
          log("Received response from content script", response);
          
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
    
    // Log that we've passed the content script communication
    log("After content script communication - popup still open");
    
    // Add a small delay to ensure changes are rendered on the page
    await new Promise(resolve => setTimeout(resolve, 800));
    
    // Try to keep focus on the popup during the process
    window.focus();
    
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
    
    // Hide loading
    hideLoading();
    
    // Check if popup is still open after apply
    if (document.body) {
      // Update UI state to show changes are applied
      document.body.setAttribute('data-popup-state', 'changes-applied');
      
      // Enable the review button
      if (reviewBtn) {
        reviewBtn.disabled = false;
      }
      
      // Disable the apply button to prevent double-application
      if (applyBtn) {
        applyBtn.disabled = true;
      }
      
      // Add success message with info about the toggle button
      displaySuccessMessage(
        "Changes applied successfully!",
        "A toggle button has been added to the page. <strong>Click it</strong> to switch between the original and modified versions."
      );
      
      // Show the review container
      if (reviewContainer) {
        reviewContainer.classList.remove('hidden');
      }
    }
    
    log("Changes applied successfully");
  } catch (error) {
    log("Error applying changes:", error);
    
    // Hide loading
    hideLoading();
    
    // Show error state
    document.body.setAttribute('data-popup-state', 'error');
    
    // Display error message
    displayError(error.message);
  }
});

// Reset the form and results
resetBtn.addEventListener('click', () => {
  // Clear the hypothesis input if present
  if (hypothesisInput) {
    hypothesisInput.value = '';
  }
  
  // Reset all results
  resetResults();
  
  // Reset to initial view
  initialView.classList.remove('hidden');
  analysisView.classList.add('hidden');
  resultsSection.classList.add('hidden');
  
  // Clear state flags
  pageAnalyzed = false;
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
  
  // Reset popup state
  document.body.setAttribute('data-popup-state', 'initial');
  
  // Clear stored state
  chrome.storage.local.remove('popupState');
});

// Open the Review Changes tab
reviewBtn.addEventListener('click', async () => {
  if (!currentResults || !changesApplied) {
    alert('Please apply changes before reviewing');
    return;
  }
  
  try {
    log("Opening review tab");
    
    // Make sure we have the review ID
    const reviewId = currentResults.id || Date.now().toString();
    
    // Ensure we have URLs for the review page to reference
    await chrome.storage.local.get('reviewId', async (data) => {
      if (!data.reviewId) {
        // If no review ID is stored yet, we need to save the data
        await saveReviewData(currentResults);
      }
      
      // Create a new tab with review.html
      chrome.tabs.create({ 
        url: chrome.runtime.getURL(`review/review.html?id=${reviewId}`)
      });
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
    
    // Store screenshots separately to avoid exceeding quota
    const beforeScreenshot = data.beforeScreenshot;
    const afterScreenshot = data.afterScreenshot;
    
    // Remove screenshots from the main data object
    const reviewData = { ...data };
    delete reviewData.beforeScreenshot;
    delete reviewData.afterScreenshot;
    
    // Store the review data without screenshots
    await chrome.storage.local.set({ 
      currentReview: reviewData,
      reviewId: reviewId
    });
    
    // Store screenshots separately with smaller keys
    if (beforeScreenshot) {
      await chrome.storage.local.set({
        [`screenshot_before_${reviewId}`]: beforeScreenshot
      });
    }
    
    if (afterScreenshot) {
      await chrome.storage.local.set({
        [`screenshot_after_${reviewId}`]: afterScreenshot
      });
    }
    
    log("Review data saved to storage with ID:", reviewId);
    return reviewId;
  } catch (error) {
    log("Error saving review data:", error);
    throw error;
  }
}

// Save current popup state to chrome.storage.local
async function savePopupState() {
  try {
    // Create a lightweight copy of the results without screenshots
    let lightResults = null;
    
    if (currentResults) {
      lightResults = JSON.parse(JSON.stringify(currentResults));
      // Remove screenshot data to reduce storage size
      delete lightResults.beforeScreenshot;
      delete lightResults.afterScreenshot;
    }
    
    const stateToSave = {
      hypothesis: hypothesisInput ? hypothesisInput.value.trim() : "",
      results: lightResults,
      suggestions: currentSuggestions,
      timestamp: Date.now(),
      hasChangesApplied: changesApplied,
      pageAnalyzed: pageAnalyzed
    };
    
    await chrome.storage.local.set({
      popupState: stateToSave
    });
    
    log("Saved popup state to storage");
  } catch (error) {
    log("Error saving popup state:", error);
  }
}

// Reset all results sections
function resetResults() {
  // Hide all results containers
  resultsSection.classList.add('hidden');
  analysisView.classList.add('hidden');
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
  pageAnalyzed = false;
  
  // Disable the buttons
  applyBtn.disabled = true;
  reviewBtn.disabled = true;
  
  // Hide the review container
  if (reviewContainer) {
    reviewContainer.classList.add('hidden');
  }
  
  // Show initial view
  initialView.classList.remove('hidden');
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

// Check and restore popup state if needed
async function checkAndRestorePopupState() {
  try {
    const data = await chrome.storage.local.get('popupState');
    if (data.popupState) {
      const state = data.popupState;
      const stateAge = Date.now() - (state.timestamp || 0);
      
      // Only restore state if it's fresh (less than 30 seconds old)
      if (stateAge < 30000) {
        log("Restoring popup state from storage, age:", Math.round(stateAge/1000), "seconds");
        
        // If page was analyzed, show analysis view
        if (state.pageAnalyzed) {
          initialView.classList.add('hidden');
          analysisView.classList.remove('hidden');
          pageAnalyzed = true;
          
          // Restore hypothesis input
          if (state.hypothesis && hypothesisInput) {
            hypothesisInput.value = state.hypothesis;
          }
          
          // Restore results
          if (state.results) {
            currentResults = state.results;
            
            // Display analysis results
            if (state.results.title) {
              analysisTitle.textContent = state.results.title;
              analysisDescription.textContent = state.results.description || "";
              
              // Try to reload the screenshot if we have a review ID
              if (state.results.id) {
                try {
                  const screenshotData = await chrome.storage.local.get(`screenshot_before_${state.results.id}`);
                  if (screenshotData && screenshotData[`screenshot_before_${state.results.id}`]) {
                    currentResults.beforeScreenshot = screenshotData[`screenshot_before_${state.results.id}`];
                    displayScreenshot(currentResults.beforeScreenshot);
                  }
                } catch (err) {
                  log("Error loading screenshot:", err);
                  // Continue without the screenshot
                }
              }
              
              // Display annotations if available
              if (state.results.annotations && state.results.annotations.length > 0) {
                displayAnnotations(state.results.annotations);
                annotationsContainer.classList.remove('hidden');
              }
            }
            
            // If suggestions exist, show them
            if (state.suggestions && state.suggestions.length > 0) {
              currentSuggestions = state.suggestions;
              displaySuggestions(currentSuggestions);
              resultsSection.classList.remove('hidden');
            }
          }
          
          // If changes were applied, update UI accordingly
          if (state.hasChangesApplied) {
            changesApplied = true;
            
            // Show success message
            displaySuccessMessage('Changes were applied! Click "Review Changes" to see the before & after comparison.');
            
            // Show review button
            if (reviewContainer) {
              reviewContainer.classList.remove('hidden');
            }
            reviewBtn.disabled = false;
            
            // Update popup state
            document.body.setAttribute('data-popup-state', 'changes-applied');
          } else {
            // Update popup state
            document.body.setAttribute('data-popup-state', 'analyzed');
          }
        }
        
        // Keep the state in storage for a short while in case of another refresh
        // but update the timestamp to track age
        const updatedState = {
          ...state,
          timestamp: Date.now() 
        };
        
        chrome.storage.local.set({ popupState: updatedState });
        
        // Schedule removal after 30 seconds
        setTimeout(() => {
          chrome.storage.local.remove('popupState');
        }, 30000);
      }
    }
  } catch (error) {
    log("Error restoring popup state:", error);
  }
} 