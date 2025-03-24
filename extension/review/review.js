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
  
  // Show export dialog
  showExportDialog();
}

// Show export dialog
function showExportDialog() {
  // Create dialog if it doesn't exist
  if (!document.querySelector('.export-dialog')) {
    const dialog = document.createElement('div');
    dialog.className = 'export-dialog';

    const content = document.createElement('div');
    content.className = 'export-content';
    
    const title = document.createElement('h2');
    title.className = 'text-xl font-bold mb-4 text-center';
    title.textContent = 'Export Options';
    
    const options = document.createElement('div');
    options.className = 'export-options';
    
    // HTML option
    const htmlBtn = document.createElement('button');
    htmlBtn.className = 'export-option-btn';
    htmlBtn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
      </svg>
      <span>HTML</span>
    `;
    htmlBtn.addEventListener('click', () => {
      exportAsHTML();
      hideExportDialog();
    });
    
    // Image option
    const imageBtn = document.createElement('button');
    imageBtn.className = 'export-option-btn';
    imageBtn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
        <circle cx="8.5" cy="8.5" r="1.5"></circle>
        <polyline points="21 15 16 10 5 21"></polyline>
      </svg>
      <span>Images</span>
    `;
    imageBtn.addEventListener('click', () => {
      exportAsImages();
      hideExportDialog();
    });
    
    // Code changes option
    const codeBtn = document.createElement('button');
    codeBtn.className = 'export-option-btn';
    codeBtn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="16 18 22 12 16 6"></polyline>
        <polyline points="8 6 2 12 8 18"></polyline>
      </svg>
      <span>Code</span>
    `;
    codeBtn.addEventListener('click', () => {
      exportAsCode();
      hideExportDialog();
    });
    
    // Cancel option
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'export-option-btn export-cancel';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', hideExportDialog);
    
    options.appendChild(htmlBtn);
    options.appendChild(imageBtn);
    options.appendChild(codeBtn);
    
    content.appendChild(title);
    content.appendChild(options);
    content.appendChild(cancelBtn);
    
    dialog.appendChild(content);
    document.body.appendChild(dialog);
    
    // Click outside to close
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) {
        hideExportDialog();
      }
    });
  }
  
  // Show dialog with animation
  const dialog = document.querySelector('.export-dialog');
  dialog.classList.add('show');
}

// Hide export dialog
function hideExportDialog() {
  const dialog = document.querySelector('.export-dialog');
  if (dialog) {
    dialog.classList.remove('show');
  }
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

// Export as HTML report
function exportAsHTML() {
  try {
    log("Exporting HTML report");
    
    // Get the current review data to ensure it's available
    chrome.storage.local.get('currentReview', function(result) {
      if (!result.currentReview) {
        showToast("No review data found to export", "error");
        return;
      }
      
      const reviewData = result.currentReview;
      
      // Generate HTML content with the reviewData
      const htmlContent = generateHTMLReport(reviewData);
      
      // Create a Blob with the HTML content
      const blob = new Blob([htmlContent], { type: 'text/html' });
      
      // Create a URL for the Blob
      const url = URL.createObjectURL(blob);
      
      // Generate filename
      const filename = `optimizeai-report-${new Date().toISOString().split('T')[0]}.html`;
      
      // Try to use the Chrome Downloads API first
      if (chrome.downloads && typeof chrome.downloads.download === 'function') {
        chrome.downloads.download({
          url: url,
          filename: filename,
          saveAs: true
        }, () => {
          // Revoke URL after download starts
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        });
        
        log("HTML report exported successfully via Chrome Downloads API");
        showToast("HTML report exported successfully", "success");
      } else {
        // Fallback to using a regular anchor download if Chrome Downloads API is not available
        log("Chrome Downloads API not available, using fallback download method");
        
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        
        // Append to document, click and remove
        document.body.appendChild(a);
        a.click();
        
        // Clean up
        setTimeout(() => {
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }, 1000);
        
        log("HTML report exported successfully via fallback method");
        showToast("HTML report exported successfully", "success");
      }
    });
  } catch (error) {
    log("Error exporting HTML report:", error);
    showToast("Error exporting HTML report: " + error.message, "error");
  }
}

// Export screenshots as images
function exportAsImages() {
  try {
    log("Exporting screenshots");
    
    // Get the current review data to ensure it's available
    chrome.storage.local.get('currentReview', function(result) {
      if (!result.currentReview) {
        showToast("No review data found to export", "error");
        return;
      }
      
      const reviewData = result.currentReview;
      const reviewId = reviewData.id;
      
      if (reviewId) {
        // Get the screenshots
        const screenshotKeys = [`screenshot_before_${reviewId}`, `screenshot_after_${reviewId}`];
        chrome.storage.local.get(screenshotKeys, function(screenshotResult) {
          const beforeScreenshot = screenshotResult[`screenshot_before_${reviewId}`];
          const afterScreenshot = screenshotResult[`screenshot_after_${reviewId}`];
          
          if (!beforeScreenshot && !afterScreenshot) {
            showToast("No screenshots available to export", "warning");
            return;
          }
          
          // Download the images
          if (beforeScreenshot) {
            downloadImage(beforeScreenshot, `optimizeai-before-${new Date().toISOString().split('T')[0]}.png`);
          }
          
          if (afterScreenshot) {
            // Slight delay for the second download to avoid browser blocking
            setTimeout(() => {
              downloadImage(afterScreenshot, `optimizeai-after-${new Date().toISOString().split('T')[0]}.png`);
            }, 500);
          }
          
          showToast("Screenshots exported successfully", "success");
        });
      } else {
        // Fallback to images in the DOM if available
        const beforeImg = document.getElementById('before-screenshot');
        const afterImg = document.getElementById('after-screenshot');
        
        if (!beforeImg.src && !afterImg.src) {
          showToast("No screenshots available to export", "warning");
          return;
        }
        
        if (beforeImg.src) {
          downloadImage(beforeImg.src, `optimizeai-before-${new Date().toISOString().split('T')[0]}.png`);
        }
        
        if (afterImg.src) {
          setTimeout(() => {
            downloadImage(afterImg.src, `optimizeai-after-${new Date().toISOString().split('T')[0]}.png`);
          }, 500);
        }
        
        showToast("Screenshots exported successfully", "success");
      }
    });
  } catch (error) {
    log("Error exporting screenshots:", error);
    showToast("Error exporting screenshots: " + error.message, "error");
  }
}

// Helper function to download an image
function downloadImage(dataUrl, filename) {
  if (chrome.downloads && typeof chrome.downloads.download === 'function') {
    chrome.downloads.download({
      url: dataUrl,
      filename: filename,
      saveAs: false
    }, (downloadId) => {
      if (chrome.runtime.lastError) {
        log("Error downloading image:", chrome.runtime.lastError);
        // Try fallback method
        downloadImageFallback(dataUrl, filename);
      } else {
        log(`Image downloaded successfully with ID: ${downloadId}`);
      }
    });
  } else {
    // Fallback to using a regular anchor download
    downloadImageFallback(dataUrl, filename);
  }
}

// Fallback download method
function downloadImageFallback(dataUrl, filename) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
  }, 500);
}

// Export code changes
function exportAsCode() {
  try {
    log("Exporting code changes");
    
    // Get the current review data
    chrome.storage.local.get('currentReview', function(result) {
      if (!result.currentReview) {
        showToast("No review data found to export", "error");
        return;
      }
      
      const reviewData = result.currentReview;
      
      // Check if we have suggested changes
      if (!reviewData.suggestedChanges || reviewData.suggestedChanges.length === 0) {
        showToast("No code changes to export", "warning");
        return;
      }
      
      // Generate modified code representation
      const codeChanges = generateCodeChanges(reviewData.suggestedChanges);
      
      // Try to copy to clipboard
      navigator.clipboard.writeText(codeChanges)
        .then(() => {
          showToast("Code changes copied to clipboard", "success");
          log("Code changes copied to clipboard");
        })
        .catch((error) => {
          log("Clipboard API failed, trying fallback method", error);
          
          // Fallback method - create a temporary textarea
          const textarea = document.createElement('textarea');
          textarea.value = codeChanges;
          textarea.style.position = 'fixed';
          textarea.style.opacity = '0';
          document.body.appendChild(textarea);
          textarea.select();
          
          try {
            const successful = document.execCommand('copy');
            if (successful) {
              showToast("Code changes copied to clipboard", "success");
            } else {
              throw new Error("execCommand copy failed");
            }
          } catch (err) {
            log("Fallback clipboard method failed", err);
            
            // If all else fails, offer download
            const blob = new Blob([codeChanges], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const filename = `optimizeai-code-changes-${new Date().toISOString().split('T')[0]}.txt`;
            
            if (chrome.downloads && typeof chrome.downloads.download === 'function') {
              chrome.downloads.download({
                url: url,
                filename: filename,
                saveAs: true
              }, () => {
                setTimeout(() => URL.revokeObjectURL(url), 1000);
              });
            } else {
              const a = document.createElement('a');
              a.href = url;
              a.download = filename;
              document.body.appendChild(a);
              a.click();
              setTimeout(() => {
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
              }, 1000);
            }
            
            showToast("Code changes saved as file", "info");
          } finally {
            document.body.removeChild(textarea);
          }
        });
    });
  } catch (error) {
    log("Error exporting code changes:", error);
    showToast("Error exporting code changes: " + error.message, "error");
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
  
  // Create HTML structure with modern DaisyUI-like styling
  return `<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - OptimizeAI Report</title>
  <style>
    /* Base styles that mimic DaisyUI */
    :root {
      --primary: #570df8;
      --primary-focus: #4406cb;
      --primary-content: #ffffff;
      --secondary: #f000b8;
      --secondary-focus: #bd0091;
      --secondary-content: #ffffff;
      --accent: #37cdbe;
      --accent-focus: #2aa79b;
      --accent-content: #ffffff;
      --neutral: #3d4451;
      --neutral-focus: #2a2e37;
      --neutral-content: #ffffff;
      --base-100: #ffffff;
      --base-200: #f2f2f2;
      --base-300: #e5e6e6;
      --base-content: #1f2937;
      --success: #36d399;
      --success-content: #ffffff;
      --warning: #fbbd23;
      --warning-content: #ffffff;
      --error: #f87272;
      --error-content: #ffffff;
      --info: #3abff8;
      --info-content: #ffffff;
    }
    
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      line-height: 1.6;
      color: var(--base-content);
      background-color: var(--base-200);
      padding: 0;
      margin: 0;
    }
    
    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 2rem;
    }
    
    /* Header styling */
    header {
      text-align: center;
      padding: 2rem 1rem;
      background-color: var(--primary);
      color: var(--primary-content);
      margin-bottom: 2rem;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
    }
    
    header h1 {
      margin: 0;
      font-size: 2rem;
    }
    
    header p {
      margin: 0.75rem 0 0;
      opacity: 0.9;
      font-size: 1.125rem;
    }
    
    header .meta {
      margin-top: 1.25rem;
      font-size: 0.875rem;
      opacity: 0.8;
    }
    
    /* Card styling */
    .card {
      background-color: var(--base-100);
      border-radius: 0.5rem;
      padding: 1.5rem;
      margin-bottom: 1.5rem;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
    }
    
    .card h2 {
      margin-top: 0;
      margin-bottom: 1.25rem;
      color: var(--primary);
      font-size: 1.5rem;
    }
    
    .card h3 {
      margin-top: 1.5rem;
      margin-bottom: 1rem;
      font-size: 1.25rem;
      color: var(--neutral);
    }
    
    /* Meta info and badges */
    .meta-info {
      display: flex;
      flex-wrap: wrap;
      gap: 1rem;
      margin: 1rem 0;
    }
    
    .badge {
      background-color: var(--base-200);
      padding: 0.625rem 1rem;
      border-radius: 0.375rem;
      font-size: 0.875rem;
    }
    
    .badge-primary {
      background-color: var(--primary);
      color: var(--primary-content);
    }
    
    .badge-accent {
      background-color: var(--accent);
      color: var(--accent-content);
    }
    
    /* Hypothesis box */
    .alert {
      padding: 1rem;
      margin: 1rem 0;
      border-radius: 0.375rem;
    }
    
    .alert-warning {
      background-color: rgba(251, 189, 35, 0.1);
      border-left: 4px solid var(--warning);
    }
    
    /* Comparison styling */
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 1.5rem;
      margin-top: 1.25rem;
    }
    
    .image-wrapper {
      border: 1px solid var(--base-300);
      border-radius: 0.375rem;
      overflow: hidden;
      background-color: var(--base-100);
    }
    
    .image-wrapper img {
      width: 100%;
      height: auto;
      display: block;
    }
    
    .image-placeholder {
      padding: 2rem;
      text-align: center;
      background-color: var(--base-200);
      color: var(--base-content);
      font-style: italic;
    }
    
    /* Annotations and changes */
    .annotation-item, .change-item {
      padding: 1rem;
      margin-bottom: 1rem;
      border-radius: 0.375rem;
      border: 1px solid var(--base-300);
      background-color: var(--base-100);
    }
    
    .annotation-item {
      border-left: 4px solid var(--primary);
    }
    
    .change-item {
      border-left: 4px solid var(--secondary);
    }
    
    .item-title {
      font-weight: bold;
      margin-bottom: 0.5rem;
      color: var(--primary);
    }
    
    .item-label {
      font-weight: bold;
      color: var(--neutral);
    }
    
    .code-block {
      font-family: monospace;
      background-color: var(--base-200);
      padding: 1rem;
      border-radius: 0.375rem;
      margin: 1rem 0;
      white-space: pre-wrap;
      overflow-x: auto;
    }
    
    /* Footer styling */
    .footer {
      text-align: center;
      margin-top: 2.5rem;
      padding: 1.25rem;
      color: var(--base-content);
      opacity: 0.7;
      font-size: 0.875rem;
      border-top: 1px solid var(--base-300);
    }
    
    /* Responsive adjustments */
    @media (max-width: 768px) {
      .container {
        padding: 1rem;
      }
      
      .grid {
        grid-template-columns: 1fr;
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
    <div class="card">
      <h2>Analysis Information</h2>
      <div class="meta-info">
        <div class="badge badge-primary">URL: ${url}</div>
        <div class="badge badge-accent">Analysis Date: ${timestamp}</div>
      </div>
      
      <h3>Hypothesis</h3>
      <div class="alert alert-warning">
        ${hypothesis}
      </div>
    </div>
    
    <div class="card">
      <h2>Before & After Comparison</h2>
      <div class="grid">
        <div>
          <h3>Before Changes</h3>
          <div class="image-wrapper">
            ${beforeImage ? `<img src="${beforeImage}" alt="Before changes" />` : 
            '<div class="image-placeholder">No before screenshot available</div>'}
          </div>
        </div>
        
        <div>
          <h3>After Changes</h3>
          <div class="image-wrapper">
            ${afterImage ? `<img src="${afterImage}" alt="After changes" />` : 
            '<div class="image-placeholder">No after screenshot available</div>'}
          </div>
        </div>
      </div>
    </div>
    
    ${annotations && annotations.length > 0 ? `
    <div class="card">
      <h2>Identified Issues</h2>
      ${annotations.map(annotation => `
        <div class="annotation-item">
          <div class="item-title">${annotation.title || 'Issue'}</div>
          <div><span class="item-label">Problem:</span> ${annotation.problem || ''}</div>
          <div><span class="item-label">Solution:</span> ${annotation.suggestion || ''}</div>
        </div>
      `).join('')}
    </div>
    ` : ''}
    
    ${suggestedChanges && suggestedChanges.length > 0 ? `
    <div class="card">
      <h2>Applied Changes</h2>
      ${suggestedChanges.map(change => `
        <div class="change-item">
          <div class="item-title">${getSuggestionTitle(change.action)}</div>
          <div class="code-block">${change.element || ''}</div>
          <div>${getSuggestionDescription(change)}</div>
        </div>
      `).join('')}
      
      <h3>Generated Code</h3>
      <div class="code-block">${generateCodeChanges(suggestedChanges)}</div>
    </div>
    ` : ''}
    
    <div class="footer">
      <p>Generated by OptimizeAI - AI-powered webpage optimization tool</p>
    </div>
  </div>
</body>
</html>`;
} 