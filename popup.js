document.addEventListener('DOMContentLoaded', function() {
  // DOM Elements
  const userInput = document.getElementById('user-input');
  const sendButton = document.getElementById('send-button');
  const chatContainer = document.getElementById('chat-container');
  const loadingIndicator = document.getElementById('loading-indicator');
  
  // Templates
  const userMessageTemplate = document.getElementById('user-message-template');
  const botMessageTemplate = document.getElementById('bot-message-template');
  const postMessageTemplate = document.getElementById('post-message-template');
  
  // Current generated post content
  let currentGeneratedPost = null;
  
  // Chat history
  let chatHistory = [];
  
  // Event Listeners
  sendButton.addEventListener('click', sendMessage);
  userInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
  
  // Initialize by loading chat history
  loadChatHistory();
  
  // Main Functions
  function sendMessage() {
    const message = userInput.value.trim();
    if (!message) return;
    
    // Add user message to chat
    addUserMessage(message);
    userInput.value = '';
    
    // Show loading indicator
    loadingIndicator.style.display = 'flex';
    chatContainer.style.display = 'none';
    
    // Make API request
    makeNetworkRequest('generate_post', { context: message })
      .then(response => {
        // Hide loading indicator
        loadingIndicator.style.display = 'none';
        chatContainer.style.display = 'block';
        
        if (response.success) {
          currentGeneratedPost = response.post;
          addPostMessage(response.post);
          chatContainer.scrollTop = chatContainer.scrollHeight;
        } else {
          addBotMessage(response.error || 'Sorry, there was an error generating your post.');
        }
      });
  }
  
  function regeneratePost() {
    if (!hasUserMessages()) return;
    
    // Show loading indicator
    loadingIndicator.style.display = 'flex';
    chatContainer.style.display = 'none';
    
    // Get the last user message
    const lastUserMessage = getLastUserMessage();
    
    // Make API request
    makeNetworkRequest('regenerate_post', { context: lastUserMessage })
      .then(response => {
        // Hide loading indicator
        loadingIndicator.style.display = 'none';
        chatContainer.style.display = 'block';
        
        if (response.success) {
          // Remove previous post messages
          removePostMessages();
          
          currentGeneratedPost = response.post;
          addPostMessage(response.post);
          chatContainer.scrollTop = chatContainer.scrollHeight;
        } else {
          addBotMessage(response.error || 'Sorry, there was an error regenerating your post.');
        }
      });
  }
  
  function modifyPost(action) {
    if (!currentGeneratedPost || !hasUserMessages()) return;
    
    // Show loading indicator
    loadingIndicator.style.display = 'flex';
    chatContainer.style.display = 'none';
    
    // Get the last user message
    const lastUserMessage = getLastUserMessage();
    
    // Make API request
    makeNetworkRequest('modify_post', {
      context: lastUserMessage,
      current_post: currentGeneratedPost,
      action: action
    })
      .then(response => {
        // Hide loading indicator
        loadingIndicator.style.display = 'none';
        chatContainer.style.display = 'block';
        
        if (response.success) {
          // Remove previous post messages
          removePostMessages();
          
          currentGeneratedPost = response.post;
          addPostMessage(response.post);
          chatContainer.scrollTop = chatContainer.scrollHeight;
        } else {
          addBotMessage(response.error || `Sorry, there was an error ${action}ing your post.`);
        }
      });
  }
  
  function insertIntoLinkedIn() {
    if (!currentGeneratedPost) return;
    
    // Send message to content script to insert the post
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      chrome.tabs.sendMessage(tabs[0].id, {
        action: 'insertText',
        text: currentGeneratedPost
      }, function(response) {
        if (response && response.success) {
          addBotMessage('Post successfully inserted into LinkedIn!');
        } else {
          addBotMessage('Could not insert text. Make sure you are on LinkedIn and have a post editor open.');
          
          // Copy to clipboard as fallback
          navigator.clipboard.writeText(currentGeneratedPost)
            .then(() => {
              addBotMessage('Post copied to clipboard instead.');
            })
            .catch(err => {
              console.error('Could not copy text: ', err);
            });
        }
      });
    });
  }
  
  // Helper Functions
  function addUserMessage(text) {
    const template = userMessageTemplate.content.cloneNode(true);
    template.querySelector('p').textContent = text;
    chatContainer.appendChild(template);
    chatContainer.scrollTop = chatContainer.scrollHeight;
    
    // Save to history
    chatHistory.push({
      type: 'user',
      text: text
    });
    saveChatHistory();
  }
  
  function addBotMessage(text) {
    const template = botMessageTemplate.content.cloneNode(true);
    template.querySelector('p').textContent = text;
    chatContainer.appendChild(template);
    chatContainer.scrollTop = chatContainer.scrollHeight;
    
    // Save to history
    chatHistory.push({
      type: 'bot',
      text: text
    });
    saveChatHistory();
  }
  
  function addPostMessage(text) {
    const template = postMessageTemplate.content.cloneNode(true);
    const postContent = template.querySelector('.post-content');
    postContent.textContent = text;
    
    // Add event listeners to buttons
    template.querySelector('.regenerate-button').addEventListener('click', regeneratePost);
    template.querySelector('.reduce-button').addEventListener('click', () => modifyPost('reduce'));
    template.querySelector('.elaborate-button').addEventListener('click', () => modifyPost('elaborate'));
    template.querySelector('.share-button').addEventListener('click', insertIntoLinkedIn);
    
    // Add event listener for copy functionality
    template.querySelector('.copy-hint').addEventListener('click', () => {
      navigator.clipboard.writeText(text)
        .then(() => {
          addBotMessage('Post copied to clipboard.');
        })
        .catch(err => {
          console.error('Could not copy text: ', err);
        });
    });
    
    chatContainer.appendChild(template);
    chatContainer.scrollTop = chatContainer.scrollHeight;
    
    // Save to history
    chatHistory.push({
      type: 'post',
      text: text
    });
    saveChatHistory();
    
    // Save the current generated post to session storage for persistence
    chrome.storage.session.set({ 'currentGeneratedPost': text });
  }
  
  function hasUserMessages() {
    return chatContainer.querySelector('.user-message') !== null;
  }
  
  function getLastUserMessage() {
    const userMessages = chatContainer.querySelectorAll('.user-message p');
    if (userMessages.length === 0) return '';
    return userMessages[userMessages.length - 1].textContent;
  }
  
  function removePostMessages() {
    const postMessages = chatContainer.querySelectorAll('.post-message');
    postMessages.forEach(message => message.remove());
    
    // Update history by removing post messages
    chatHistory = chatHistory.filter(msg => msg.type !== 'post');
    saveChatHistory();
  }
  
  // Persistence Functions
  function saveChatHistory() {
    // Save chat history to session storage (cleared when browser closes)
    chrome.storage.session.set({ 'chatHistory': chatHistory });
    chrome.storage.session.set({ 'currentGeneratedPost': currentGeneratedPost });
  }
  
  function loadChatHistory() {
    // Load chat history from session storage
    chrome.storage.session.get(['chatHistory', 'currentGeneratedPost'], function(result) {
      if (result.chatHistory && result.chatHistory.length > 0) {
        chatHistory = result.chatHistory;
        
        // Clear chat container first
        chatContainer.innerHTML = '';
        
        // Rebuild chat UI from history
        chatHistory.forEach(message => {
          if (message.type === 'user') {
            const template = userMessageTemplate.content.cloneNode(true);
            template.querySelector('p').textContent = message.text;
            chatContainer.appendChild(template);
          } else if (message.type === 'bot') {
            const template = botMessageTemplate.content.cloneNode(true);
            template.querySelector('p').textContent = message.text;
            chatContainer.appendChild(template);
          } else if (message.type === 'post') {
            const template = postMessageTemplate.content.cloneNode(true);
            const postContent = template.querySelector('.post-content');
            postContent.textContent = message.text;
            
            // Add event listeners to buttons
            template.querySelector('.regenerate-button').addEventListener('click', regeneratePost);
            template.querySelector('.reduce-button').addEventListener('click', () => modifyPost('reduce'));
            template.querySelector('.elaborate-button').addEventListener('click', () => modifyPost('elaborate'));
            template.querySelector('.share-button').addEventListener('click', insertIntoLinkedIn);
            
            // Add event listener for copy functionality
            template.querySelector('.copy-hint').addEventListener('click', () => {
              navigator.clipboard.writeText(message.text)
                .then(() => {
                  addBotMessage('Post copied to clipboard.');
                })
                .catch(err => {
                  console.error('Could not copy text: ', err);
                });
            });
            
            chatContainer.appendChild(template);
          }
        });
        
        // Restore current generated post
        if (result.currentGeneratedPost) {
          currentGeneratedPost = result.currentGeneratedPost;
        }
        
        // Scroll to bottom
        chatContainer.scrollTop = chatContainer.scrollHeight;
      } else {
        // No history - add a welcome message
        addBotMessage('Hello! I can help you generate engaging LinkedIn posts. Share some context about what you want to post about.');
      }
    });
  }
  
  // Network Functions
  async function makeNetworkRequest(endpoint, requestBody) {
    const baseUrls = [
      'https://linkedin-post-generator-backend.onrender.com',
      'http://linkedin-post-generator-backend.onrender.com'
    ];
    
    for (const baseUrl of baseUrls) {
      try {
        const response = await fetch(`${baseUrl}/${endpoint}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestBody)
        });
        
        if (response.ok) {
          const data = await response.json();
          return {
            success: true,
            post: data.post
          };
        }
      } catch (error) {
        console.error(`Error with ${baseUrl}:`, error);
        // Continue to next URL
      }
    }
    
    return {
      success: false,
      error: 'Unable to connect to the server. Please check your internet connection and try again.'
    };
  }
  
  // Add a clear history button (optional)
  function addClearHistoryButton() {
    const headerDiv = document.querySelector('.header');
    const clearButton = document.createElement('button');
    clearButton.textContent = 'Clear Chat';
    clearButton.style.position = 'absolute';
    clearButton.style.right = '10px';
    clearButton.style.top = '10px';
    clearButton.style.fontSize = '12px';
    clearButton.style.padding = '4px 8px';
    clearButton.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
    clearButton.style.border = 'none';
    clearButton.style.borderRadius = '4px';
    clearButton.style.color = 'white';
    clearButton.style.cursor = 'pointer';
    
    clearButton.addEventListener('click', function() {
      chatHistory = [];
      currentGeneratedPost = null;
      chrome.storage.session.remove(['chatHistory', 'currentGeneratedPost']);
      chatContainer.innerHTML = '';
      addBotMessage('Hello! I can help you generate engaging LinkedIn posts. Share some context about what you want to post about.');
    });
    
    headerDiv.appendChild(clearButton);
  }
  
  // Add the clear history button
  addClearHistoryButton();
});