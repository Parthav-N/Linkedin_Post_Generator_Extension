// Listen for messages from the popup
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === 'insertText') {
    const result = insertTextIntoLinkedIn(request.text);
    sendResponse(result);
  }
  return true; // Keep the message channel open for asynchronous response
});

// Function to insert text into LinkedIn post editor
function insertTextIntoLinkedIn(text) {
  try {
    // Try to find the post editor using multiple possible selectors
    let postEditor = null;
    
    // Updated selector array with various possible LinkedIn editor selectors
    const possibleSelectors = [
      // Feed post editor selectors
      '[contenteditable="true"][data-placeholder="What do you want to talk about?"]',
      '[contenteditable="true"][aria-placeholder="What do you want to talk about?"]',
      // Post modal selectors
      '[contenteditable="true"][aria-label="Text editor for creating content"]',
      '[contenteditable="true"][aria-label="Post editor"]',
      // Article editor
      '[contenteditable="true"][aria-label="Editor for article content"]',
      // Generic content editable in LinkedIn post area
      'div[role="textbox"][contenteditable="true"]',
      // Additional possible selectors
      '[contenteditable="true"].ql-editor',
      '.sharing-input__editor [contenteditable="true"]',
      '.editor-container [contenteditable="true"]'
    ];
    
    // Try each selector until we find an editor
    for (const selector of possibleSelectors) {
      const editors = document.querySelectorAll(selector);
      if (editors.length > 0) {
        postEditor = editors[0];
        console.log('LinkedIn editor found with selector:', selector);
        break;
      }
    }
    
    // If editor is found, focus it and insert text
    if (postEditor) {
      // Focus the editor
      postEditor.focus();
      
      // Clear existing content first
      postEditor.innerHTML = '';
      
      // Insert new content
      // Method 1: Using innerHTML (preserves line breaks)
      const formattedText = text.replace(/\n/g, '<br>');
      postEditor.innerHTML = formattedText;
      
      // Method 2: Using execCommand as fallback
      if (!postEditor.innerHTML || postEditor.innerHTML === '') {
        document.execCommand('insertHTML', false, formattedText);
      }
      
      // Method 3: Direct textContent as last resort
      if (!postEditor.innerHTML || postEditor.innerHTML === '') {
        postEditor.textContent = text;
      }
      
      // Fire multiple events to ensure LinkedIn detects the change
      ['input', 'change', 'blur', 'focus'].forEach(eventType => {
        postEditor.dispatchEvent(new Event(eventType, {
          bubbles: true,
          cancelable: true
        }));
      });
      
      console.log('Text successfully inserted into LinkedIn editor');
      return { success: true };
    } else {
      // If we couldn't find the editor, return failure with helpful message
      console.error('Could not find LinkedIn post editor');
      return { 
        success: false, 
        error: 'LinkedIn post editor not found. Please make sure you\'re on LinkedIn and have clicked to create a post before using this feature.' 
      };
    }
  } catch (error) {
    console.error('Error inserting text into LinkedIn:', error);
    return { 
      success: false, 
      error: error.message || 'An unexpected error occurred while inserting text' 
    };
  }
}