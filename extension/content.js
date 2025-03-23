// This content script will run on all webpages
// It will handle DOM manipulation based on AI suggestions

// Store information about visible elements
let visibleElements = new Set();

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

// Function to apply changes to the DOM
function applyChangesToDOM(changes) {
  log("Applying", changes.length, "changes to DOM");
  
  if (!changes || !Array.isArray(changes) || changes.length === 0) {
    log("No changes to apply");
    return;
  }
  
  changes.forEach(change => {
    try {
      const elements = document.querySelectorAll(change.element);
      log(`Found ${elements.length} elements matching selector: ${change.element}`);
      
      if (elements.length === 0) {
        log(`No elements found for selector: ${change.element}`);
        return;
      }
      
      elements.forEach(element => {
        applyChangeToElement(element, change);
      });
    } catch (error) {
      log(`Error applying change to ${change.element}:`, error);
    }
  });
  
  log("All changes applied successfully");
}

// Apply a single change to an element
function applyChangeToElement(element, change) {
  const { action, value } = change;
  
  switch (action) {
    case 'change_text':
      log(`Changing text of ${element.tagName} to: ${value}`);
      element.textContent = value;
      break;
    
    case 'change_style':
      log(`Changing style of ${element.tagName}`);
      if (typeof value === 'object') {
        Object.keys(value).forEach(prop => {
          element.style[prop] = value[prop];
        });
      }
      break;
    
    case 'change_attribute':
      log(`Changing attribute ${value.name} of ${element.tagName} to: ${value.value}`);
      if (value && value.name) {
        element.setAttribute(value.name, value.value);
      }
      break;
    
    case 'increase_size':
      log(`Increasing size of ${element.tagName}`);
      if (typeof value === 'object') {
        Object.keys(value).forEach(prop => {
          element.style[prop] = value[prop];
        });
      } else {
        // Default size increase
        element.style.transform = 'scale(1.2)';
        element.style.transformOrigin = 'center';
      }
      break;
    
    case 'change_color':
      log(`Changing color of ${element.tagName} to: ${value}`);
      element.style.color = value;
      break;
    
    default:
      log(`Unknown action: ${action} for ${element.tagName}`);
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
      applyChangesToDOM(changes);
      log("Changes applied successfully");
      sendResponse({ success: true });
    } catch (error) {
      log("Error applying changes:", error.message);
      sendResponse({ success: false, error: error.message });
    }
  } else if (message.action === "ping") {
    // Respond to ping to confirm content script is loaded
    log("Responding to ping");
    sendResponse({ status: "content_script_ready" });
  }
  
  log("Message handled:", message.action);
  return true; // Required for async sendResponse
}); 