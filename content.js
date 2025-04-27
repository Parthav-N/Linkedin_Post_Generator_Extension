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
      // Try to find the post editor
      let postEditor = null;
      
      // First, check if we're on the feed page with the "Start a post" box
      const feedPostEditors = document.querySelectorAll('[contenteditable="true"][data-placeholder="What do you want to talk about?"]');
      if (feedPostEditors.length > 0) {
        postEditor = feedPostEditors[0];
      }
      
      // If not found, check for an open post creation modal
      if (!postEditor) {
        const modalPostEditors = document.querySelectorAll('[contenteditable="true"][aria-label="Text editor for creating content"]');
        if (modalPostEditors.length > 0) {
          postEditor = modalPostEditors[0];
        }
      }
      
      // If not found, check for article editor
      if (!postEditor) {
        const articleEditors = document.querySelectorAll('[contenteditable="true"][aria-label="Editor for article content"]');
        if (articleEditors.length > 0) {
          postEditor = articleEditors[0];
        }
      }
      
      // If editor is found, focus it and insert text
      if (postEditor) {
        // Focus the editor
        postEditor.focus();
        
        // Try using the clipboard API first (modern approach)
        const canUseClipboard = true; // Assume we can use it until we know we can't
        
        if (canUseClipboard) {
          // This approach tries to keep formatting if any
          // First clear existing content
          postEditor.textContent = '';
          
          // Then insert new content
          // For simple text insertion:
          postEditor.textContent = text;
          
          // Fire input event to trigger LinkedIn's UI update
          postEditor.dispatchEvent(new Event('input', {
            bubbles: true,
            cancelable: true
          }));
          
          return { success: true };
        } else {
          // Fallback to execCommand approach (older)
          document.execCommand('insertText', false, text);
          return { success: true };
        }
      } else {
        // If we couldn't find the editor, return failure
        console.error('Could not find LinkedIn post editor');
        return { 
          success: false, 
          error: 'LinkedIn post editor not found. Please open the post composer first.' 
        };
      }
    } catch (error) {
      console.error('Error inserting text into LinkedIn:', error);
      return { 
        success: false, 
        error: error.message 
      };
    }
  }