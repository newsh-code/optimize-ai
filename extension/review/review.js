// DOM elements
const loadingEl = document.getElementById('loading');
const contentEl = document.getElementById('content');
const errorContainerEl = document.getElementById('error-container');
const errorTextEl = document.getElementById('error-text');
const reloadBtn = document.getElementById('reload-btn');
const exportBtn = document.getElementById('export-btn');
const closeBtn = document.getElementById('close-btn');

// Elements for the analysis info
const analysisTitleEl = document.getElementById('analysis-title');
const analysisDescriptionEl = document.getElementById('analysis-description');
const pageUrlEl = document.getElementById('page-url');
const analysisTimeEl = document.getElementById('analysis-time');
const hypothesisTextEl = document.getElementById('hypothesis-text');

// Elements for the screenshots
const beforeScreenshotEl = document.getElementById('before-screenshot');
const afterScreenshotEl = document.getElementById('after-screenshot');

// Elements for annotations and changes
const annotationsListEl = document.getElementById('annotations-list');
const changesListEl = document.getElementById('changes-list');

// Sections that might be hidden based on data
const comparisonSectionEl = document.getElementById('comparison-section');
const annotationsSectionEl = document.getElementById('annotations-section');
const changesSectionEl = document.getElementById('changes-section');

// Helper for logging
function log(...args) {
  console.log("[AI Webpage Experimenter Review]", ...args);
}

// Format a timestamp as a readable date and time
function formatTimestamp(timestamp) {
  if (!timestamp) return 'Unknown';
  
  try {
    const date = new Date(timestamp);
    return date.toLocaleString();
  } catch (error) {
    log("Error formatting timestamp:", error);
    return timestamp;
  }
}

// Initialize the review page
document.addEventListener('DOMContentLoaded', async () => {
  log("Review page loaded");
  
  // Set up event listeners
  reloadBtn.addEventListener('click', () => {
    window.location.reload();
  });
  
  closeBtn.addEventListener('click', () => {
    window.close();
  });
  
  exportBtn.addEventListener('click', handleExport);
  
  // Try to load review data
  try {
    await loadReviewData();
  } catch (error) {
    log("Error loading review data:", error);
    showError(`Failed to load review data: ${error.message}`);
  }
});

// Load the review data from storage
async function loadReviewData() {
  try {
    showLoading();
    
    log("Loading review data from storage");
    
    // Check for review ID in URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const reviewIdFromUrl = urlParams.get('id');
    
    // Get the review ID from URL or storage
    let reviewId;
    if (reviewIdFromUrl) {
      reviewId = reviewIdFromUrl;
      log("Using review ID from URL:", reviewId);
    } else {
      // Fallback to getting the ID from storage
      const result = await chrome.storage.local.get('reviewId');
      reviewId = result.reviewId;
      log("Using review ID from storage:", reviewId);
    }
    
    if (!reviewId) {
      throw new Error("No review ID found");
    }
    
    // Get the review data using the ID
    const reviewResult = await chrome.storage.local.get('currentReview');
    const reviewData = reviewResult.currentReview;
    
    if (!reviewData) {
      throw new Error("No review data found in storage");
    }
    
    log("Loaded review data:", reviewData);
    
    // Load screenshots separately
    const screenshotKeys = [`screenshot_before_${reviewId}`, `screenshot_after_${reviewId}`];
    
    try {
      const screenshotResult = await chrome.storage.local.get(screenshotKeys);
      
      // Add screenshots back to the review data
      const fullReviewData = { ...reviewData };
      
      if (screenshotResult[`screenshot_before_${reviewId}`]) {
        fullReviewData.beforeScreenshot = screenshotResult[`screenshot_before_${reviewId}`];
        log("Loaded before screenshot, size:", Math.round(fullReviewData.beforeScreenshot.length / 1024), "KB");
      } else {
        log("Before screenshot not found in storage");
      }
      
      if (screenshotResult[`screenshot_after_${reviewId}`]) {
        fullReviewData.afterScreenshot = screenshotResult[`screenshot_after_${reviewId}`];
        log("Loaded after screenshot, size:", Math.round(fullReviewData.afterScreenshot.length / 1024), "KB");
      } else {
        log("After screenshot not found in storage");
      }
      
      // Display the review data
      displayReviewData(fullReviewData);
    } catch (storageError) {
      log("Error loading screenshots:", storageError);
      // Continue without screenshots
      displayReviewData(reviewData);
    }
    
    hideLoading();
    showContent();
  } catch (error) {
    log("Error in loadReviewData:", error);
    hideLoading();
    throw error;
  }
}

// Display the review data in the UI
function displayReviewData(data) {
  log("Displaying review data:", data);
  
  // Set the page title
  document.title = `OptimizeAI - Review of ${data.url || 'Webpage'}`;
  
  // Display the analysis info
  analysisTitleEl.textContent = data.title || "Webpage Analysis";
  analysisDescriptionEl.textContent = data.description || "";
  pageUrlEl.textContent = data.url || "Unknown";
  analysisTimeEl.textContent = formatTimestamp(data.timestamp);
  hypothesisTextEl.textContent = data.hypothesis || "No hypothesis provided";
  
  // Display the screenshots
  if (data.beforeScreenshot) {
    // Create a new Image to ensure proper loading
    const beforeImg = new Image();
    beforeImg.onload = () => {
      beforeScreenshotEl.src = data.beforeScreenshot;
      log("Before screenshot displayed successfully");
    };
    beforeImg.onerror = (e) => {
      log("Error loading before screenshot:", e);
      beforeScreenshotEl.parentElement.innerHTML = '<div class="no-screenshot">Error loading screenshot</div>';
    };
    beforeImg.src = data.beforeScreenshot;
  } else {
    log("No before screenshot available");
    beforeScreenshotEl.parentElement.innerHTML = '<div class="no-screenshot">No screenshot available</div>';
  }
  
  if (data.afterScreenshot) {
    // Create a new Image to ensure proper loading
    const afterImg = new Image();
    afterImg.onload = () => {
      afterScreenshotEl.src = data.afterScreenshot;
      log("After screenshot displayed successfully");
    };
    afterImg.onerror = (e) => {
      log("Error loading after screenshot:", e);
      afterScreenshotEl.parentElement.innerHTML = '<div class="no-screenshot">Error loading screenshot</div>';
    };
    afterImg.src = data.afterScreenshot;
  } else {
    log("No after screenshot available");
    afterScreenshotEl.parentElement.innerHTML = '<div class="no-screenshot">Changes not yet applied</div>';
  }
  
  // If no screenshots, hide the comparison section
  if (!data.beforeScreenshot && !data.afterScreenshot) {
    comparisonSectionEl.classList.add('hidden');
  }
  
  // Display annotations
  if (data.annotations && data.annotations.length > 0) {
    displayAnnotations(data.annotations);
  } else {
    annotationsSectionEl.classList.add('hidden');
  }
  
  // Display applied changes
  if (data.suggestedChanges && data.suggestedChanges.length > 0) {
    displayChanges(data.suggestedChanges);
  } else {
    changesSectionEl.classList.add('hidden');
  }
}

// Display the annotations in the UI
function displayAnnotations(annotations) {
  annotationsListEl.innerHTML = '';
  
  if (!annotations || annotations.length === 0) {
    annotationsListEl.innerHTML = '<p>No annotations available</p>';
    return;
  }
  
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
    
    annotationsListEl.appendChild(item);
  });
}

// Display the changes in the UI
function displayChanges(changes) {
  changesListEl.innerHTML = '';
  
  if (!changes || changes.length === 0) {
    changesListEl.innerHTML = '<p>No changes applied</p>';
    return;
  }
  
  changes.forEach(change => {
    const item = document.createElement('div');
    item.className = 'change-item';
    
    const title = document.createElement('div');
    title.className = 'change-title';
    title.textContent = getSuggestionTitle(change.action);
    
    const element = document.createElement('div');
    element.className = 'change-element';
    element.textContent = change.element;
    
    const action = document.createElement('div');
    action.className = 'change-action';
    action.textContent = getSuggestionDescription(change);
    
    item.appendChild(title);
    item.appendChild(element);
    item.appendChild(action);
    
    changesListEl.appendChild(item);
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

// Handle exporting the review data
async function handleExport() {
  try {
    log("Exporting review data");
    
    // Check for review ID in URL parameters first
    const urlParams = new URLSearchParams(window.location.search);
    const reviewIdFromUrl = urlParams.get('id');
    
    // Get the review ID either from URL or storage
    let reviewId;
    if (reviewIdFromUrl) {
      reviewId = reviewIdFromUrl;
    } else {
      const result = await chrome.storage.local.get('reviewId');
      reviewId = result.reviewId;
    }
    
    if (!reviewId) {
      throw new Error("No review ID found for export");
    }
    
    // Get the review data using the ID
    const reviewResult = await chrome.storage.local.get('currentReview');
    const reviewData = reviewResult.currentReview;
    
    if (!reviewData) {
      throw new Error("No review data found to export");
    }
    
    // Get screenshots separately
    const screenshotKeys = [`screenshot_before_${reviewId}`, `screenshot_after_${reviewId}`];
    const screenshotResult = await chrome.storage.local.get(screenshotKeys);
    
    // Create a complete data object for the report
    const exportData = { ...reviewData };
    
    // Add screenshots if available
    if (screenshotResult[`screenshot_before_${reviewId}`]) {
      exportData.beforeScreenshot = screenshotResult[`screenshot_before_${reviewId}`];
    }
    
    if (screenshotResult[`screenshot_after_${reviewId}`]) {
      exportData.afterScreenshot = screenshotResult[`screenshot_after_${reviewId}`];
    }
    
    // Create an HTML report
    const html = generateHTMLReport(exportData);
    
    // Create a blob with the HTML content
    const blob = new Blob([html], { type: 'text/html' });
    
    // Create a download link
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `optimizeai-report-${new Date().toISOString().slice(0, 10)}.html`;
    
    // Trigger the download
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    log("Report exported successfully");
  } catch (error) {
    log("Error exporting review data:", error);
    alert(`Failed to export report: ${error.message}`);
  }
}

// Generate an HTML report from the review data
function generateHTMLReport(data) {
  const title = data.title || "Webpage Analysis";
  const description = data.description || "";
  const url = data.url || "Unknown";
  const timestamp = formatTimestamp(data.timestamp);
  const hypothesis = data.hypothesis || "No hypothesis provided";
  
  // Start building the HTML
  let html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>OptimizeAI Report - ${title}</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 1200px;
          margin: 0 auto;
          padding: 20px;
        }
        header {
          border-bottom: 1px solid #eee;
          padding-bottom: 20px;
          margin-bottom: 20px;
        }
        h1 {
          color: #0066cc;
        }
        .meta {
          background: #f5f5f5;
          padding: 15px;
          border-radius: 5px;
          margin-bottom: 20px;
        }
        .meta p {
          margin: 5px 0;
        }
        .comparison {
          display: flex;
          gap: 20px;
          margin-bottom: 20px;
        }
        .screenshot {
          flex: 1;
          border: 1px solid #ddd;
          padding: 10px;
          border-radius: 5px;
        }
        .screenshot img {
          max-width: 100%;
          height: auto;
        }
        .annotations, .changes {
          margin-bottom: 20px;
        }
        .item {
          background: #f9f9f9;
          border-left: 3px solid #0066cc;
          padding: 10px 15px;
          margin-bottom: 10px;
          border-radius: 3px;
        }
        .problem {
          color: #cc0000;
        }
        .solution {
          color: #007700;
        }
        .element {
          font-family: monospace;
          background: #eee;
          padding: 3px 6px;
          border-radius: 3px;
        }
        footer {
          margin-top: 40px;
          border-top: 1px solid #eee;
          padding-top: 20px;
          text-align: center;
          font-size: 0.8em;
          color: #666;
        }
      </style>
    </head>
    <body>
      <header>
        <h1>OptimizeAI Webpage Analysis Report</h1>
      </header>
      
      <section class="meta">
        <h2>${title}</h2>
        <p>${description}</p>
        <p><strong>URL:</strong> ${url}</p>
        <p><strong>Analyzed:</strong> ${timestamp}</p>
        <p><strong>Hypothesis:</strong> ${hypothesis}</p>
      </section>
  `;
  
  // Add screenshots if available
  if (data.beforeScreenshot || data.afterScreenshot) {
    html += `
      <section>
        <h2>Before & After Comparison</h2>
        <div class="comparison">
    `;
    
    if (data.beforeScreenshot) {
      html += `
        <div class="screenshot">
          <h3>Before Changes</h3>
          <img src="${data.beforeScreenshot}" alt="Before changes">
        </div>
      `;
    }
    
    if (data.afterScreenshot) {
      html += `
        <div class="screenshot">
          <h3>After Changes</h3>
          <img src="${data.afterScreenshot}" alt="After changes">
        </div>
      `;
    }
    
    html += `
        </div>
      </section>
    `;
  }
  
  // Add annotations if available
  if (data.annotations && data.annotations.length > 0) {
    html += `
      <section class="annotations">
        <h2>Identified Issues</h2>
    `;
    
    data.annotations.forEach(annotation => {
      html += `
        <div class="item">
          <h3>${annotation.title}</h3>
          <p class="problem"><strong>Problem:</strong> ${annotation.problem}</p>
          <p class="solution"><strong>Solution:</strong> ${annotation.suggestion}</p>
        </div>
      `;
    });
    
    html += `
      </section>
    `;
  }
  
  // Add changes if available
  if (data.suggestedChanges && data.suggestedChanges.length > 0) {
    html += `
      <section class="changes">
        <h2>Applied Changes</h2>
    `;
    
    data.suggestedChanges.forEach(change => {
      const title = getSuggestionTitle(change.action);
      const description = getSuggestionDescription(change);
      
      html += `
        <div class="item">
          <h3>${title}</h3>
          <p class="element">${change.element}</p>
          <p>${description}</p>
        </div>
      `;
    });
    
    html += `
      </section>
    `;
  }
  
  // Close the HTML
  html += `
      <footer>
        <p>Generated by OptimizeAI Chrome Extension on ${new Date().toLocaleString()}</p>
      </footer>
    </body>
    </html>
  `;
  
  return html;
}

// Show loading state
function showLoading() {
  loadingEl.classList.remove('hidden');
  contentEl.classList.add('hidden');
  errorContainerEl.classList.add('hidden');
}

// Hide loading state
function hideLoading() {
  loadingEl.classList.add('hidden');
}

// Show content
function showContent() {
  contentEl.classList.remove('hidden');
}

// Show error message
function showError(message) {
  errorTextEl.textContent = message;
  errorContainerEl.classList.remove('hidden');
  contentEl.classList.add('hidden');
} 