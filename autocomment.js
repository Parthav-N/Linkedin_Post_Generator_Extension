// autocomment.js - Detects LinkedIn comment fields and fills them automatically

// Default API URL (can be configured)
const API_BASE_URLs = [
  'https://linkedin-post-generator-backend.onrender.com',
  'http://linkedin-post-generator-backend.onrender.com'
];

// Function to extract both post text and author
function extractPostInfo(postElement) {
  // Try to extract the main post text
  const mainTextElem = postElement.querySelector('[data-ad-preview="message"]') || 
                       postElement.querySelector('.feed-shared-update-v2__description');
  const postText = mainTextElem ? mainTextElem.innerText.trim() : '';

  // Try multiple selectors for author name
  let authorElem = postElement.querySelector('.feed-shared-actor__name') ||
                  postElement.querySelector('.update-components-actor__name') ||
                  postElement.querySelector('.feed-shared-actor__meta a') ||
                  postElement.querySelector('.update-components-actor__meta a');

  // Fallback: try first anchor or span in likely header containers
  if (!authorElem) {
    const header = postElement.querySelector('.feed-shared-actor, .update-components-actor');
    if (header) {
      authorElem = header.querySelector('a, span');
    }
  }

  const postAuthor = authorElem ? authorElem.innerText.trim() : '';
  console.log('[LinkedIn Assistant] Selected author:', postAuthor);
  return { postText, postAuthor };
}

// Function to call our Flask backend instead of direct Gemini API
async function generateComment(postText, postAuthor, refinement = '', currentComment = '') {
  console.log('Comment generation request:', { postText, postAuthor, refinement, currentComment });
  
  const requestBody = {
    post_text: postText,
    post_author: postAuthor,
    refinement: refinement,
    current_comment: currentComment
  };

  // Try each base URL until one works
  for (const baseUrl of API_BASE_URLs) {
    try {
      const response = await fetch(`${baseUrl}/generate_comment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (response.ok) {
        const data = await response.json();
        return data.comment;
      }
    } catch (error) {
      console.error(`Error with ${baseUrl}:`, error);
      // Continue to next URL
    }
  }

  return "Sorry, I couldn't generate a comment at this time. Please try again later.";
}

// SPA Navigation and Feed Observer
let currentFeed = null;
let feedObserver = null;
let lastUrl = location.href;

function observeFeed() {
  const feed = document.querySelector('main');
  if (feed !== currentFeed) {
    if (feedObserver) feedObserver.disconnect();
    currentFeed = feed;
    if (feed) {
      feedObserver = new MutationObserver(scanAndFill);
      feedObserver.observe(feed, { childList: true, subtree: true });
    }
  }
}

function onUrlChange() {
  if (location.href !== lastUrl) {
    lastUrl = location.href;
    scanAndFill();
    observeFeed();
  }
}

// Patch history methods to detect pushState/replaceState
(function () {
  const origPushState = history.pushState;
  const origReplaceState = history.replaceState;
  history.pushState = function (...args) {
    origPushState.apply(this, args);
    window.dispatchEvent(new Event('locationchange'));
  };
  history.replaceState = function (...args) {
    origReplaceState.apply(this, args);
    window.dispatchEvent(new Event('locationchange'));
  };
})();
window.addEventListener('popstate', () => window.dispatchEvent(new Event('locationchange')));
window.addEventListener('locationchange', onUrlChange);

// Throttling for performance
const lastFillTime = new WeakMap();

// Find the post element from a comment box
function findPostElementFromCommentBox(box) {
  return box.closest('.feed-shared-update-v2, .scaffold-finite-scroll__content, .update-components-update, article');
}

// Auto-fill comment boxes as they appear
async function fillCommentBox(box) {
  const filledAttr = 'data-assistant-filled';
  
  // Skip if already filled
  if (box.getAttribute(filledAttr)) return;
  
  // First, check if auto-comments are enabled
  // We need to await this check before proceeding
  try {
    const result = await new Promise(resolve => {
      chrome.storage.sync.get(['enableAutoComments'], function(data) {
        resolve(data);
      });
    });
    
    // Explicitly check for the setting - must be explicitly false to disable
    const autoCommentsEnabled = result.enableAutoComments !== false;
    console.log('[LinkedIn Assistant] Auto-comments enabled:', autoCommentsEnabled);
    
    if (!autoCommentsEnabled) {
      console.log('[LinkedIn Assistant] Auto-comments are disabled - skipping comment generation');
      return; // Exit early if disabled
    }
    
    const postElement = findPostElementFromCommentBox(box);
    if (!postElement) return;
    
    const { postText, postAuthor } = extractPostInfo(postElement);
    if (!postText || !postAuthor) return;
    
    // Remove any existing assistant elements (to prevent duplicates)
    const existingButtons = box.parentElement.querySelectorAll('.assistant-regenerate-btn, .assistant-refine-btn');
    existingButtons.forEach(el => el.remove());
    
    const suggestion = await generateComment(postText, postAuthor);
    if (!suggestion) return;
    
    // For contenteditable (divs)
    if (box.isContentEditable) {
      box.innerText = suggestion;
      box.dispatchEvent(new Event('input', { bubbles: true }));
    } else {
      box.value = suggestion;
      box.dispatchEvent(new Event('input', { bubbles: true }));
    }
    box.setAttribute(filledAttr, '1');

    // Add control buttons if not present
    if (!box.parentElement.querySelector('.assistant-regenerate-btn')) {
      const regenerateBtn = document.createElement('button');
      regenerateBtn.textContent = 'Regenerate';
      regenerateBtn.className = 'assistant-regenerate-btn';
      regenerateBtn.onclick = async () => {
        regenerateBtn.disabled = true;
        regenerateBtn.textContent = 'Generating...';
        const { postText, postAuthor } = extractPostInfo(postElement);
        const newSuggestion = await generateComment(postText, postAuthor);
        if (newSuggestion) {
          if (box.isContentEditable) {
            box.innerText = newSuggestion;
            box.dispatchEvent(new Event('input', { bubbles: true }));
          } else {
            box.value = newSuggestion;
            box.dispatchEvent(new Event('input', { bubbles: true }));
          }
        }
        regenerateBtn.disabled = false;
        regenerateBtn.textContent = 'Regenerate';
      };
      
      const refineBtn = document.createElement('button');
      refineBtn.textContent = 'Refine';
      refineBtn.className = 'assistant-refine-btn';
      refineBtn.onclick = async () => {
        refineBtn.disabled = true;
        refineBtn.textContent = 'Refining...';
        const instructions = prompt('How would you like to refine the comment?', 'Make it more specific to the content');
        if (instructions) {
          let currentComment = box.isContentEditable ? box.innerText : box.value;
          const { postText, postAuthor } = extractPostInfo(postElement);
          const newSuggestion = await generateComment(postText, postAuthor, instructions, currentComment);
          if (newSuggestion) {
            if (box.isContentEditable) {
              box.innerText = newSuggestion;
              box.dispatchEvent(new Event('input', { bubbles: true }));
            } else {
              box.value = newSuggestion;
              box.dispatchEvent(new Event('input', { bubbles: true }));
            }
          }
        }
        refineBtn.disabled = false;
        refineBtn.textContent = 'Refine';
      };

      // Insert after the comment box
      if (box.nextSibling) {
        box.parentElement.insertBefore(regenerateBtn, box.nextSibling);
        box.parentElement.insertBefore(refineBtn, regenerateBtn.nextSibling);
      } else {
        box.parentElement.appendChild(regenerateBtn);
        box.parentElement.appendChild(refineBtn);
      }
    }
  } catch (error) {
    console.error('[LinkedIn Assistant] Error in fillCommentBox:', error);
  }
}

// Function to scan for comments
function scanAndFill() {
  // Comment box selectors
  const COMMENT_SELECTORS = [
    '.comments-comment-box__editor',
    '.ql-editor[contenteditable="true"]',
    'textarea[aria-label="Add a comment…"]',
    'textarea[aria-label="Add a comment..."]',
    'textarea[name="comment"]',
  ];
  
  // Leading-edge throttle per comment box (1s)
  for (const sel of COMMENT_SELECTORS) {
    const boxes = document.querySelectorAll(sel);
    for (const box of boxes) {
      const now = Date.now();
      const last = lastFillTime.get(box) || 0;
      if (now - last >= 1000) {
        lastFillTime.set(box, now);
        fillCommentBox(box);
      }
    }
  }
}

// Listen for settings changes from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'settingsChanged') {
    console.log('[LinkedIn Assistant] Settings changed:', message.settings);
    
    // If auto-comments were disabled, immediately stop any processing
    if (message.settings.enableAutoComments === false) {
      // We could remove data-la-filled attribute from all comment boxes to allow
      // refilling if the setting is turned back on, but we'll keep this behavior for now
      console.log('[LinkedIn Assistant] Auto-comments were disabled');
    }
    
    // Acknowledge receipt
    sendResponse({status: 'received'});
  }
  return true; // Keep the channel open for async response
});

// Function to check current settings and log them
function checkSettings() {
  chrome.storage.sync.get(['enableAutoComments'], function(result) {
    console.log('[LinkedIn Assistant] Current settings check:', {
      enableAutoComments: result.enableAutoComments,
      explicitlyDisabled: result.enableAutoComments === false,
      storageValue: JSON.stringify(result)
    });
  });
}

// Initial setup
function initialize() {
  console.log('[LinkedIn Assistant] Auto-comment initialized');
  
  // Check current settings
  checkSettings();
  
  // First, clean up any buttons that might have been added by previous versions
  // or other extensions with similar classes
  const existingRegenerateButtons = document.querySelectorAll('.butterfly-regenerate-btn');
  const existingRefineButtons = document.querySelectorAll('.butterfly-refine-btn');
  const existingPostButtons = document.querySelectorAll('.butterfly-post-btn');
  
  existingRegenerateButtons.forEach(el => el.remove());
  existingRefineButtons.forEach(el => el.remove());
  existingPostButtons.forEach(el => el.remove());
  
  // Add isolated stylesheet to prevent interference with LinkedIn styles
  const style = document.createElement('style');
  style.textContent = `
    /* Ensure our UI elements don't affect LinkedIn layout */
    .assistant-regenerate-btn,
    .assistant-refine-btn {
      padding: 4px 10px;
      margin: 4px 8px 4px 0;
      font-size: 12px;
      cursor: pointer;
      border: none;
      border-radius: 4px;
      color: white;
      position: relative;
      display: inline-block;
      min-width: auto;
      max-width: none;
      text-align: center;
      box-sizing: border-box;
      font-family: inherit;
    }
    
    .assistant-regenerate-btn {
      background: #0077B5;
    }
    
    .assistant-refine-btn {
      background: #0072b1;
    }
    
    .assistant-regenerate-btn:disabled,
    .assistant-refine-btn:disabled {
      background: #cccccc;
      cursor: not-allowed;
    }
    
    /* Explicitly hide any leftover buttons from other extensions */
    .butterfly-regenerate-btn, 
    .butterfly-refine-btn, 
    .butterfly-post-btn {
      display: none !important;
    }
  `;
  document.head.appendChild(style);
  
  // Periodically clean up any unwanted buttons
  function cleanupUnwantedButtons() {
    const unwantedButtons = document.querySelectorAll('.butterfly-regenerate-btn, .butterfly-refine-btn, .butterfly-post-btn');
    unwantedButtons.forEach(button => button.remove());
  }
  
  scanAndFill();
  observeFeed();
  
  // Set up observers and periodic scanning
  const observer = new MutationObserver(() => {
    setTimeout(() => {
      cleanupUnwantedButtons();
      scanAndFill();
    }, 500); // Slight delay to let DOM settle
  });
  observer.observe(document.body, { childList: true, subtree: true });
  
  // Fallback: periodic scan and cleanup
  setInterval(() => {
    cleanupUnwantedButtons();
    scanAndFill();
    observeFeed();
    // Periodically check settings to ensure they're being properly applied
    checkSettings();
  }, 2000);
}

// Start the script when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}