document.addEventListener('DOMContentLoaded', function() {
    // Check if user is registered, if not redirect to registration
    chrome.storage.local.get(['isRegistered', 'userEmail', 'isAdmin'], function(result) {
      if (!result.isRegistered) {
        window.location.href = 'registration.html';
        return;
      }
      
      // Store user email for convenience
      const userEmail = result.userEmail;
      
      // Check if user is admin and show admin tab if they are
      if (result.isAdmin) {
        document.getElementById('admin-tab-button').style.display = 'block';
        // Initialize admin panel
        initAdminPanel();
      }
      
      // Log usage analytics when popup opens
      logUserActivity('popup_opened');
    });
    
    // Tab switching
    const tabButtons = document.querySelectorAll('.tab-button');
    tabButtons.forEach(button => {
      button.addEventListener('click', function() {
        const tabId = this.getAttribute('data-tab');
        
        // Update active button
        tabButtons.forEach(btn => btn.classList.remove('active'));
        this.classList.add('active');
        
        // Hide all tab content
        document.querySelectorAll('.tab-content').forEach(tab => {
          tab.style.display = 'none';
        });
        
        // Show selected tab
        document.getElementById(tabId).style.display = 'flex';
        
        // If admin tab is selected, refresh the data
        if (tabId === 'admin-tab') {
          fetchUserData();
        }
      });
    });
    
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
    
    // Function to log user activity to your analytics backend
    function logUserActivity(action, details = {}) {
      chrome.storage.local.get(['userEmail'], function(result) {
        if (!result.userEmail) return;
        
        const analyticsData = {
          email: result.userEmail,
          action: action,
          timestamp: new Date().toISOString(),
          details: details
        };
        
        // Send analytics data to your server
        fetch('https://your-api.com/log-extension-activity', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(analyticsData)
        }).catch(error => {
          console.error('Analytics error:', error);
          // Non-critical, so we just log the error
        });
      });
    }
    
    // Admin panel functions
    function initAdminPanel() {
      // Add refresh button listener
      document.getElementById('refresh-users-button').addEventListener('click', fetchUserData);
      
      // Initial data fetch
      fetchUserData();
    }
    
    function fetchUserData() {
      const usersContainer = document.getElementById('users-container');
      usersContainer.innerHTML = '<div class="users-loading">Loading user data...</div>';
      
      // Update stats display
      document.getElementById('total-users').textContent = 'Loading...';
      document.getElementById('active-users').textContent = 'Loading...';
      
      chrome.storage.local.get(['userEmail'], function(result) {
        if (!result.userEmail) return;
        
        // Fetch user data from server
        fetch('https://your-api.com/admin/users', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            adminEmail: result.userEmail
          })
        })
        .then(response => response.json())
        .then(data => {
          if (data.success) {
            // Update stats
            document.getElementById('total-users').textContent = data.stats.totalUsers || 0;
            document.getElementById('active-users').textContent = data.stats.activeLastWeek || 0;
            
            // Render user list
            renderUserList(data.users);
          } else {
            usersContainer.innerHTML = '<div class="users-loading">Error loading user data.</div>';
          }
        })
        .catch(error => {
          console.error('Error fetching user data:', error);
          usersContainer.innerHTML = '<div class="users-loading">Connection error. Please try again.</div>';
        });
      });
    }
    
    function renderUserList(users) {
      const usersContainer = document.getElementById('users-container');
      
      if (!users || users.length === 0) {
        usersContainer.innerHTML = '<div class="users-loading">No users found.</div>';
        return;
      }
      
      usersContainer.innerHTML = '';
      
      // Sort users by registration date (newest first)
      users.sort((a, b) => new Date(b.installDate) - new Date(a.installDate));
      
      users.forEach(user => {
        const userItem = document.createElement('div');
        userItem.className = 'user-item';
        
        const formattedDate = new Date(user.installDate).toLocaleDateString(undefined, {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        });
        
        userItem.innerHTML = `
          <div class="user-email">${user.email}</div>
          <div class="user-date">Registered: ${formattedDate}</div>
        `;
        
        usersContainer.appendChild(userItem);
      });
    }
    
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
      
      // Log user action
      logUserActivity('generate_post_requested', { context_length: message.length });
      
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
            
            // Log successful generation
            logUserActivity('post_generated', { 
              success: true,
              post_length: response.post.length
            });
          } else {
            addBotMessage(response.error || 'Sorry, there was an error generating your post.');
            
            // Log failed generation
            logUserActivity('post_generated', { 
              success: false,
              error: response.error || 'Unknown error'
            });
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
      
      // Log user action
      logUserActivity('insert_to_linkedin_requested');
      
      // Send message to content script to insert the post
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'insertText',
          text: currentGeneratedPost
        }, function(response) {
          if (response && response.success) {
            addBotMessage('Post successfully inserted into LinkedIn!');
            
            // Log successful insertion
            logUserActivity('insert_to_linkedin_completed', { 
              success: true,
              method: 'direct_insertion'
            });
          } else {
            addBotMessage('Could not insert text. Make sure you are on LinkedIn and have a post editor open.');
            
            // Copy to clipboard as fallback
            navigator.clipboard.writeText(currentGeneratedPost)
              .then(() => {
                addBotMessage('Post copied to clipboard instead.');
                
                // Log clipboard fallback
                logUserActivity('insert_to_linkedin_completed', { 
                  success: false,
                  method: 'clipboard_fallback'
                });
              })
              .catch(err => {
                console.error('Could not copy text: ', err);
                
                // Log complete failure
                logUserActivity('insert_to_linkedin_completed', { 
                  success: false,
                  method: 'failed',
                  error: err.message
                });
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