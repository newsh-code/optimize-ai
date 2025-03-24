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
  log("Export button clicked");
  
  // Get the current review data
  const reviewResult = await chrome.storage.local.get('currentReview');
  const reviewData = reviewResult.currentReview;
  
  if (!reviewData) {
    showError("No review data found to export");
    return;
  }
  
  // Load screenshots if they're not already loaded
  const reviewId = reviewData.id;
  if (reviewId) {
    const screenshotKeys = [`screenshot_before_${reviewId}`, `screenshot_after_${reviewId}`];
    const screenshotResult = await chrome.storage.local.get(screenshotKeys);
    
    if (screenshotResult[`screenshot_before_${reviewId}`]) {
      reviewData.beforeScreenshot = screenshotResult[`screenshot_before_${reviewId}`];
    }
    
    if (screenshotResult[`screenshot_after_${reviewId}`]) {
      reviewData.afterScreenshot = screenshotResult[`screenshot_after_${reviewId}`];
    }
  }
  
  // Create export dialog
  const exportDialog = document.createElement('div');
  exportDialog.id = 'export-dialog';
  exportDialog.className = 'export-dialog';
  exportDialog.innerHTML = `
    <div class="export-content">
      <h2>Export Options</h2>
      <div class="export-options">
        <button id="export-html-btn" class="export-option-btn">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
            <path d="M12 16L6 10H18L12 16Z" fill="currentColor" />
          </svg>
          <span>Export HTML Report</span>
        </button>
        <button id="export-code-btn" class="export-option-btn">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
            <path d="M8 3V5H6V3H8M3 3V5H1V3H3M13 3V5H11V3H13M18 3V5H16V3H18M23 3V5H21V3H23M8 8V10H6V8H8M3 8V10H1V8H3M13 8V10H11V8H13M18 8V10H16V8H18M23 8V10H21V8H23M8 13V15H6V13H8M3 13V15H1V13H3M13 13V15H11V13H13M18 13V15H16V13H18M23 13V15H21V13H23M8 18V20H6V18H8M3 18V20H1V18H3M13 18V20H11V18H13M18 18V20H16V18H18M23 18V20H21V18H23Z" fill="currentColor" />
          </svg>
          <span>Copy Modified Code</span>
        </button>
        <button id="export-cancel-btn" class="export-option-btn export-cancel">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41Z" fill="currentColor" />
          </svg>
          <span>Cancel</span>
        </button>
      </div>
    </div>
  `;
  
  // Add the dialog to the document
  document.body.appendChild(exportDialog);
  
  // Add event listeners to the buttons
  document.getElementById('export-html-btn').addEventListener('click', () => {
    exportHtmlReport(reviewData);
    closeExportDialog();
  });
  
  document.getElementById('export-code-btn').addEventListener('click', () => {
    copyModifiedCode(reviewData);
    closeExportDialog();
  });
  
  document.getElementById('export-cancel-btn').addEventListener('click', closeExportDialog);
  
  // Function to close the export dialog
  function closeExportDialog() {
    if (exportDialog && exportDialog.parentNode) {
      exportDialog.parentNode.removeChild(exportDialog);
    }
  }
  
  // Close dialog when clicking outside
  exportDialog.addEventListener('click', (event) => {
    if (event.target === exportDialog) {
      closeExportDialog();
    }
  });
}

// Export HTML report
async function exportHtmlReport(data) {
  try {
    log("Exporting HTML report");
    
    // Generate HTML content
    const htmlContent = generateHTMLReport(data);
    
    // Create a Blob with the HTML content
    const blob = new Blob([htmlContent], { type: 'text/html' });
    
    // Create a URL for the Blob
    const url = URL.createObjectURL(blob);
    
    // Generate filename
    const filename = `optimizeai-report-${new Date().toISOString().split('T')[0]}.html`;
    
    // Download the file
    await chrome.downloads.download({
      url: url,
      filename: filename,
      saveAs: true
    });
    
    // Show success message
    showToast("HTML report exported successfully", "success");
    
    log("HTML report exported successfully");
  } catch (error) {
    log("Error exporting HTML report:", error);
    showToast("Error exporting HTML report: " + error.message, "error");
  }
}

// Copy modified code to clipboard
async function copyModifiedCode(data) {
  try {
    log("Copying modified code");
    
    // Check if we have suggested changes
    if (!data.suggestedChanges || data.suggestedChanges.length === 0) {
      showToast("No code changes to copy", "warning");
      return;
    }
    
    // Generate modified code representation
    const codeChanges = generateCodeChanges(data.suggestedChanges);
    
    // Copy to clipboard
    await navigator.clipboard.writeText(codeChanges);
    
    // Show success message
    showToast("Modified code copied to clipboard", "success");
    
    log("Modified code copied to clipboard");
  } catch (error) {
    log("Error copying modified code:", error);
    showToast("Error copying code: " + error.message, "error");
  }
}

// Generate CSS and HTML code changes
function generateCodeChanges(changes) {
  // Separate CSS and HTML changes
  const cssChanges = [];
  const htmlChanges = [];
  
  changes.forEach(change => {
    if (change.element) {
      if (change.action === 'change_style' || change.action === 'change_color' || 
          change.action === 'change_size' || change.action === 'increase_size') {
        // CSS change
        const styleValue = change.styleChanges || change.value || {};
        
        let cssProperties = '';
        if (typeof styleValue === 'object') {
          for (const [prop, value] of Object.entries(styleValue)) {
            cssProperties += `  ${prop}: ${value};\n`;
          }
        } else if (change.action === 'change_color') {
          cssProperties += `  color: ${styleValue};\n`;
        }
        
        cssChanges.push(`${change.element} {\n${cssProperties}}`);
      } else if (change.action === 'change_text') {
        // HTML change
        const newText = change.newText || change.value || '';
        htmlChanges.push(`<!-- Find elements matching: ${change.element} -->\n<!-- Change content to: -->\n${newText}`);
      } else if (change.action === 'change_attribute') {
        // HTML attribute change
        const attributeValue = change.attributeChanges || 
                             (change.value && typeof change.value === 'object' ? 
                              { [change.value.name]: change.value.value } : {});
        
        let attributes = '';
        for (const [attr, value] of Object.entries(attributeValue)) {
          attributes += ` ${attr}="${value}"`;
        }
        
        htmlChanges.push(`<!-- Find elements matching: ${change.element} -->\n<!-- Add attributes: -->\n${attributes}`);
      }
    }
  });
  
  // Combine the changes
  let result = '';
  
  if (cssChanges.length > 0) {
    result += '/* CSS Changes */\n';
    result += '<style>\n';
    result += cssChanges.join('\n\n');
    result += '\n</style>\n\n';
  }
  
  if (htmlChanges.length > 0) {
    result += '<!-- HTML Changes -->\n';
    result += htmlChanges.join('\n\n');
    result += '\n';
  }
  
  return result;
}

// Generate HTML report for export
function generateHTMLReport(data) {
  const title = data.title || "Webpage Analysis";
  const description = data.description || "";
  const url = data.url || "Unknown URL";
  const timestamp = formatTimestamp(data.timestamp);
  const hypothesis = data.hypothesis || "No hypothesis provided";
  
  // Convert images to base64 if available
  const beforeImage = data.beforeScreenshot || data.beforeImageData || null;
  const afterImage = data.afterScreenshot || data.afterImageData || null;
  
  // Get annotations and changes
  const annotations = data.annotations || [];
  const suggestedChanges = data.suggestedChanges || [];
  
  // Create HTML structure
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - OptimizeAI Report</title>
  <style>
    :root {
      --primary-color: #4a6cf7;
      --primary-hover: #3a5cd6;
      --text-color: #333;
      --text-light: #666;
      --bg-color: #f8f9fa;
      --card-bg: #fff;
      --border-color: #e0e0e0;
      --success-color: #2ecc71;
      --warning-color: #f39c12;
    }
    
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      line-height: 1.6;
      color: var(--text-color);
      background-color: var(--bg-color);
      padding: 0;
      margin: 0;
    }
    
    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
    }
    
    header {
      text-align: center;
      padding: 30px 0;
      background-color: var(--primary-color);
      color: white;
      margin-bottom: 30px;
    }
    
    header h1 {
      margin: 0;
      font-size: 32px;
    }
    
    header p {
      margin: 10px 0 0;
      opacity: 0.9;
      font-size: 18px;
    }
    
    header .meta {
      margin-top: 20px;
      font-size: 14px;
      opacity: 0.8;
    }
    
    .section {
      background-color: var(--card-bg);
      border-radius: 8px;
      padding: 25px;
      margin-bottom: 30px;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
    }
    
    .section h2 {
      margin-top: 0;
      margin-bottom: 20px;
      color: var(--primary-color);
      font-size: 24px;
    }
    
    .section h3 {
      margin-top: 25px;
      margin-bottom: 15px;
      font-size: 20px;
      color: var(--text-color);
    }
    
    .meta-info {
      display: flex;
      flex-wrap: wrap;
      gap: 15px;
      margin: 15px 0;
    }
    
    .meta-item {
      background-color: rgba(74, 108, 247, 0.05);
      padding: 10px 15px;
      border-radius: 6px;
      font-size: 14px;
    }
    
    .meta-item strong {
      color: var(--primary-color);
    }
    
    .hypothesis-box {
      background-color: rgba(243, 156, 18, 0.05);
      border-left: 4px solid var(--warning-color);
      padding: 15px;
      margin: 20px 0;
      font-style: italic;
    }
    
    .comparison-container {
      display: flex;
      flex-wrap: wrap;
      gap: 20px;
      margin-top: 20px;
    }
    
    .screenshot-container {
      flex: 1;
      min-width: 300px;
    }
    
    .screenshot-container h3 {
      margin-top: 0;
      margin-bottom: 10px;
    }
    
    .screenshot {
      border: 1px solid var(--border-color);
      border-radius: 4px;
      overflow: hidden;
      box-shadow: 0 2px 5px rgba(0, 0, 0, 0.05);
    }
    
    .screenshot img {
      width: 100%;
      height: auto;
      display: block;
    }
    
    .no-screenshot {
      padding: 30px;
      text-align: center;
      background-color: #f5f5f5;
      color: var(--text-light);
      font-style: italic;
    }
    
    .annotation-item, .change-item {
      padding: 15px;
      margin-bottom: 15px;
      border-radius: 6px;
      border: 1px solid var(--border-color);
      background-color: rgba(74, 108, 247, 0.02);
    }
    
    .annotation-title, .change-title {
      font-weight: bold;
      margin-bottom: 5px;
      color: var(--primary-color);
    }
    
    .annotation-problem {
      margin-bottom: 8px;
    }
    
    .annotation-suggestion {
      color: var(--text-light);
    }
    
    .change-element {
      font-family: monospace;
      background-color: rgba(0, 0, 0, 0.03);
      padding: 5px 10px;
      border-radius: 4px;
      margin: 5px 0;
      word-break: break-all;
    }
    
    .change-action {
      margin-top: 5px;
      color: var(--text-light);
    }
    
    .code-changes {
      background-color: #f5f5f5;
      border: 1px solid var(--border-color);
      border-radius: 6px;
      padding: 15px;
      margin-top: 20px;
      font-family: monospace;
      white-space: pre-wrap;
      overflow-x: auto;
    }
    
    .footer {
      text-align: center;
      margin-top: 40px;
      padding: 20px;
      color: var(--text-light);
      font-size: 14px;
      border-top: 1px solid var(--border-color);
    }
    
    @media (max-width: 768px) {
      .comparison-container {
        flex-direction: column;
      }
      
      .meta-info {
        flex-direction: column;
      }
    }
  </style>
</head>
<body>
  <header>
    <h1>${title}</h1>
    <p>${description}</p>
    <div class="meta">Generated on ${new Date().toLocaleString()}</div>
  </header>

  <div class="container">
    <section class="section">
      <h2>Analysis Information</h2>
      <div class="meta-info">
        <div class="meta-item"><strong>URL:</strong> ${url}</div>
        <div class="meta-item"><strong>Analysis Date:</strong> ${timestamp}</div>
      </div>
      
      <h3>Hypothesis</h3>
      <div class="hypothesis-box">
        ${hypothesis}
      </div>
    </section>
    
    <section class="section">
      <h2>Before & After Comparison</h2>
      <div class="comparison-container">
        <div class="screenshot-container">
          <h3>Before Changes</h3>
          <div class="screenshot">
            ${beforeImage ? `<img src="${beforeImage}" alt="Before changes" />` : 
            '<div class="no-screenshot">No before screenshot available</div>'}
          </div>
        </div>
        
        <div class="screenshot-container">
          <h3>After Changes</h3>
          <div class="screenshot">
            ${afterImage ? `<img src="${afterImage}" alt="After changes" />` : 
            '<div class="no-screenshot">No after screenshot available</div>'}
          </div>
        </div>
      </div>
    </section>
    
    ${annotations && annotations.length > 0 ? `
    <section class="section">
      <h2>Identified Issues</h2>
      <div class="annotations-list">
        ${annotations.map(annotation => `
          <div class="annotation-item">
            <div class="annotation-title">${annotation.title || 'Issue'}</div>
            <div class="annotation-problem"><strong>Problem:</strong> ${annotation.problem || ''}</div>
            <div class="annotation-suggestion"><strong>Solution:</strong> ${annotation.suggestion || ''}</div>
          </div>
        `).join('')}
      </div>
    </section>
    ` : ''}
    
    ${suggestedChanges && suggestedChanges.length > 0 ? `
    <section class="section">
      <h2>Applied Changes</h2>
      <div class="changes-list">
        ${suggestedChanges.map(change => `
          <div class="change-item">
            <div class="change-title">${getSuggestionTitle(change.action)}</div>
            <div class="change-element">${change.element || ''}</div>
            <div class="change-action">${getSuggestionDescription(change)}</div>
          </div>
        `).join('')}
      </div>
      
      <h3>Generated Code</h3>
      <div class="code-changes">${generateCodeChanges(suggestedChanges)}</div>
    </section>
    ` : ''}
    
    <div class="footer">
      <p>Generated by OptimizeAI - AI-powered webpage optimization tool</p>
    </div>
  </div>
</body>
</html>`;
}

// Show a toast message
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  
  document.body.appendChild(toast);
  
  // Trigger animation
  setTimeout(() => {
    toast.classList.add('show');
  }, 10);
  
  // Remove after 3 seconds
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  }, 3000);
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