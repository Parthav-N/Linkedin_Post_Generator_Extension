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
    
    // Event Listeners
    sendButton.addEventListener('click', sendMessage);
    userInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
    
    // Initialize the chat container with a welcome message
    addBotMessage('Hello! I can help you generate engaging LinkedIn posts. Share some context about what you want to post about.');
    
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
    }
    
    function addBotMessage(text) {
      const template = botMessageTemplate.content.cloneNode(true);
      template.querySelector('p').textContent = text;
      chatContainer.appendChild(template);
      chatContainer.scrollTop = chatContainer.scrollHeight;
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
  });