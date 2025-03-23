// This content script will run on all webpages
// It will handle DOM manipulation based on AI suggestions

// Store information about visible elements
let visibleElements = new Set();

// Store original element states to allow toggling
let originalElementStates = new Map();
let toggleState = 'modified';

// Flag to track if changes are currently applied
let changesApplied = false;

// Store the last applied changes
let lastAppliedChanges = [];

// Initialize the IntersectionObserver to track visible elements
function initVisibilityObserver() {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          visibleElements.add(entry.target);
        } else {
          visibleElements.delete(entry.target);
        }
      });
    },
    { threshold: 0.1 } // Element is considered visible when 10% is in viewport
  );
  
  // Observe important elements (exclude script, style, meta, etc.)
  const elementsToObserve = document.querySelectorAll(
    'body, div, section, article, aside, header, footer, nav, main, p, h1, h2, h3, h4, h5, h6, ' +
    'a, button, input, select, textarea, img, form, ul, ol, li, table, tr, td, th'
  );
  
  elementsToObserve.forEach((element) => {
    observer.observe(element);
  });
  
  return observer;
}

// Get DOM structure of visible elements only
function getVisibleDOM() {
  // Create a simplified DOM representation for visible elements
  const simplifiedDOM = [];
  
  visibleElements.forEach((element) => {
    // Skip text nodes and non-element nodes
    if (element.nodeType !== Node.ELEMENT_NODE) return;
    
    // Get computed styles for the element
    const styles = window.getComputedStyle(element);
    
    // Create a simplified element representation
    const elementInfo = {
      tagName: element.tagName.toLowerCase(),
      id: element.id || null,
      classes: Array.from(element.classList),
      attributes: getElementAttributes(element),
      innerText: element.innerText.substring(0, 100), // Limit text length
      styles: {
        color: styles.color,
        backgroundColor: styles.backgroundColor,
        fontSize: styles.fontSize,
        position: styles.position,
        display: styles.display,
        width: styles.width,
        height: styles.height,
        margin: `${styles.marginTop} ${styles.marginRight} ${styles.marginBottom} ${styles.marginLeft}`,
        padding: `${styles.paddingTop} ${styles.paddingRight} ${styles.paddingBottom} ${styles.paddingLeft}`,
      },
      boundingRect: element.getBoundingClientRect().toJSON(),
      xpath: getXPath(element)
    };
    
    simplifiedDOM.push(elementInfo);
  });
  
  return simplifiedDOM;
}

// Helper function to get element attributes
function getElementAttributes(element) {
  const attributes = {};
  for (const attr of element.attributes) {
    attributes[attr.name] = attr.value;
  }
  return attributes;
}

// Helper function to get XPath for an element
function getXPath(element) {
  if (!element) return '';
  
  const paths = [];
  for (; element && element.nodeType === Node.ELEMENT_NODE; element = element.parentNode) {
    let index = 0;
    for (let sibling = element.previousSibling; sibling; sibling = sibling.previousSibling) {
      if (sibling.nodeType === Node.ELEMENT_NODE && sibling.tagName === element.tagName) {
        index++;
      }
    }
    
    const tagName = element.tagName.toLowerCase();
    const pathIndex = (index ? `[${index + 1}]` : '');
    paths.unshift(tagName + pathIndex);
  }
  
  return paths.length ? '/' + paths.join('/') : '';
}

// Initialize the observer when the script runs
const observer = initVisibilityObserver();

// Helper function for logging
function log(...args) {
  console.log("[AI Webpage Experimenter - Content]", ...args);
}

// Store the original state of an element before modification
function storeOriginalState(element) {
  const elementId = getElementUniqueIdentifier(element);
  
  if (!originalElementStates.has(elementId)) {
    const originalState = {
      textContent: element.textContent,
      style: {},
      attributes: {}
    };
    
    // Store original styles
    const computedStyle = window.getComputedStyle(element);
    const importantStyles = [
      'color', 'backgroundColor', 'fontSize', 'fontWeight', 'margin', 'padding',
      'display', 'position', 'width', 'height', 'transform', 'border',
      'borderRadius', 'boxShadow', 'textAlign', 'lineHeight'
    ];
    
    importantStyles.forEach(style => {
      originalState.style[style] = element.style[style] || computedStyle[style];
    });
    
    // Store original attributes
    for (const attr of element.attributes) {
      originalState.attributes[attr.name] = attr.value;
    }
    
    originalElementStates.set(elementId, originalState);
    log(`Stored original state for ${element.tagName}${elementId}`);
  }
}

// Generate a unique identifier for an element
function getElementUniqueIdentifier(element) {
  return `#${element.id || ''}.${Array.from(element.classList).join('.')}:${getXPath(element)}`;
}

// Function to apply changes to the DOM
function applyChangesToDOM(suggestions) {
  log(`Applying ${suggestions.length} changes to DOM`);
  
  // Clear existing modifications if there are any
  if (toggleState === 'original') {
    toggleState = 'modified';
    const toggleButton = document.getElementById('ai-toggle-button');
    if (toggleButton) {
      toggleButton.textContent = 'View Original';
    }
  }
  
  let changesMade = 0;
  
  try {
    for (const suggestion of suggestions) {
      if (!suggestion.elementInfo || !suggestion.elementInfo.xpath) {
        log('Missing elementInfo or xpath in suggestion', suggestion);
        continue;
      }
      
      const element = getElementByXPath(suggestion.elementInfo.xpath);
      if (!element) {
        log(`Element not found for xpath: ${suggestion.elementInfo.xpath}`);
        continue;
      }
      
      saveOriginalState(element, suggestion.action);
      
      if (suggestion.action === 'change_text' && suggestion.newText) {
        log(`Changing text for element ${suggestion.elementInfo.xpath}`);
        element.textContent = suggestion.newText;
        changesMade++;
      } else if (suggestion.action === 'change_style' && suggestion.styleChanges) {
        log(`Changing style for element ${suggestion.elementInfo.xpath}`);
        Object.keys(suggestion.styleChanges).forEach(property => {
          element.style[property] = suggestion.styleChanges[property];
        });
        changesMade++;
      } else if (suggestion.action === 'change_attribute' && suggestion.attributeChanges) {
        log(`Changing attributes for element ${suggestion.elementInfo.xpath}`);
        Object.keys(suggestion.attributeChanges).forEach(attribute => {
          element.setAttribute(attribute, suggestion.attributeChanges[attribute]);
        });
        changesMade++;
      } else if (suggestion.action === 'change_size' && suggestion.sizeChanges) {
        log(`Changing size for element ${suggestion.elementInfo.xpath}`);
        if (suggestion.sizeChanges.width) {
          element.style.width = suggestion.sizeChanges.width;
        }
        if (suggestion.sizeChanges.height) {
          element.style.height = suggestion.sizeChanges.height;
        }
        changesMade++;
      } else if (suggestion.action === 'change_color' && suggestion.colorChanges) {
        log(`Changing color for element ${suggestion.elementInfo.xpath}`);
        if (suggestion.colorChanges.textColor) {
          element.style.color = suggestion.colorChanges.textColor;
        }
        if (suggestion.colorChanges.backgroundColor) {
          element.style.backgroundColor = suggestion.colorChanges.backgroundColor;
        }
        changesMade++;
      }
    }
    
    // Create toggle button after changes are applied
    if (changesMade > 0) {
      createToggleButton();
    }
    
    log(`Successfully applied ${changesMade} changes to DOM`);
    return { success: true, changesMade };
  } catch (error) {
    log(`Error applying changes to DOM: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// Helper function to get element by XPath
function getElementByXPath(xpath) {
  return document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
}

// Create toggle button function
function createToggleButton() {
  const existingButton = document.getElementById('ai-toggle-button');
  if (existingButton) {
    return existingButton;
  }

  const toggleButton = document.createElement('button');
  toggleButton.id = 'ai-toggle-button';
  toggleButton.textContent = 'View Original';
  toggleButton.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    z-index: 10000;
    padding: 8px 12px;
    background-color: #3367d6;
    color: white;
    border: none;
    border-radius: 4px;
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    font-size: 14px;
    cursor: pointer;
    box-shadow: 0 2px 5px rgba(0,0,0,0.2);
    transition: background-color 0.2s;
  `;

  toggleButton.addEventListener('mouseover', () => {
    toggleButton.style.backgroundColor = '#4285f4';
  });

  toggleButton.addEventListener('mouseout', () => {
    toggleButton.style.backgroundColor = '#3367d6';
  });

  toggleButton.addEventListener('click', togglePageVersion);
  
  document.body.appendChild(toggleButton);
  return toggleButton;
}

// Toggle between original and modified states
function togglePageVersion() {
  const toggleButton = document.getElementById('ai-toggle-button');
  
  if (toggleState === 'modified') {
    // Switch to original
    originalElementStates.forEach((originalState, elementId) => {
      const element = document.getElementById(elementId);
      if (element) {
        if (originalState.text !== undefined) element.textContent = originalState.text;
        if (originalState.style) Object.assign(element.style, originalState.style);
        if (originalState.className) element.className = originalState.className;
        if (originalState.attributes) {
          for (const [attr, value] of Object.entries(originalState.attributes)) {
            element.setAttribute(attr, value);
          }
        }
      }
    });
    toggleState = 'original';
    toggleButton.textContent = 'View Modified';
  } else {
    // Switch back to modified
    chrome.runtime.sendMessage({ action: 'getSuggestions' }, (response) => {
      if (response && response.suggestions) {
        applyChangesToDOM(response.suggestions);
      }
    });
    toggleState = 'modified';
    toggleButton.textContent = 'View Original';
  }
}

// Save original element state before modifying
function saveOriginalState(element, changeType) {
  if (!originalElementStates.has(element.id)) {
    // Generate a unique ID if the element doesn't have one
    if (!element.id) {
      element.id = 'ai-modified-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
    }
    
    const originalState = {
      text: element.textContent,
      style: {},
      className: element.className,
      attributes: {}
    };

    // Store original styles if we're changing styles
    if (changeType.includes('style')) {
      const computedStyle = window.getComputedStyle(element);
      originalState.style = {
        color: computedStyle.color,
        backgroundColor: computedStyle.backgroundColor,
        fontFamily: computedStyle.fontFamily,
        fontSize: computedStyle.fontSize,
        fontWeight: computedStyle.fontWeight,
        padding: computedStyle.padding,
        margin: computedStyle.margin,
        border: computedStyle.border,
        width: computedStyle.width,
        height: computedStyle.height
      };
    }

    // Store attributes
    for (const attr of element.getAttributeNames()) {
      originalState.attributes[attr] = element.getAttribute(attr);
    }

    originalElementStates.set(element.id, originalState);
  }
}

// Listen for messages from the popup or background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  log("Received message:", message.action);
  
  if (message.action === "getDOM") {
    // Get the current DOM structure
    const domString = document.documentElement.outerHTML;
    log("Sending DOM structure, length:", domString.length);
    sendResponse({ dom: domString });
  } else if (message.action === "getVisibleDOM") {
    // Get the visible DOM information
    const visibleDOM = getVisibleDOM();
    log("Sending visible DOM info, elements:", visibleDOM.length);
    sendResponse({ visibleDOM });
  } else if (message.action === "applyChanges") {
    // Apply suggested changes to the DOM
    const changes = message.changes;
    log("Applying changes to DOM, count:", changes.length);
    
    try {
      // Reset state for new changes
      if (changesApplied) {
        restoreOriginalState();
        originalElementStates.clear();
      }
      
      applyChangesToDOM(changes);
      log("Changes applied successfully");
      sendResponse({ success: true });
    } catch (error) {
      log("Error applying changes:", error.message);
      sendResponse({ success: false, error: error.message });
    }
  } else if (message.action === "toggleChanges") {
    // Toggle between original and modified versions
    toggleChanges();
    sendResponse({ 
      success: true, 
      changesApplied: changesApplied 
    });
  } else if (message.action === "removeToggleButton") {
    // Remove the toggle button from the page
    const toggleButton = document.getElementById('ai-experimenter-toggle');
    if (toggleButton) {
      toggleButton.remove();
      log("Toggle button removed");
    }
    sendResponse({ success: true });
  } else if (message.action === "ping") {
    // Respond to ping to confirm content script is loaded
    log("Responding to ping");
    sendResponse({ status: "content_script_ready" });
  } else if (message.action === 'getSuggestions') {
    chrome.storage.local.get(['suggestions'], (result) => {
      sendResponse({ suggestions: result.suggestions || [] });
    });
    return true; // Keep the message channel open for async response
  }
  
  log("Message handled:", message.action);
  return true; // Required for async sendResponse
}); 