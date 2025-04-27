document.addEventListener('DOMContentLoaded', function() {
    const registrationForm = document.getElementById('registration-form');
    const emailField = document.getElementById('email');
    const privacyConsent = document.getElementById('privacy-consent');
    const errorMessage = document.getElementById('error-message');
    const privacyPolicyLink = document.getElementById('privacy-policy-link');
  
    // Show privacy policy when clicked
    privacyPolicyLink.addEventListener('click', function(e) {
      e.preventDefault();
      alert('Privacy Policy: Your email will be stored securely to help us improve the extension and track usage. We will never share your email with third parties.');
    });
  
    // Handle form submission
    registrationForm.addEventListener('submit', function(e) {
      e.preventDefault();
      
      const email = emailField.value.trim();
      const hasConsented = privacyConsent.checked;
      
      // Validate email
      if (!isValidEmail(email)) {
        errorMessage.textContent = 'Please enter a valid email address.';
        return;
      }
      
      // Ensure consent is given
      if (!hasConsented) {
        errorMessage.textContent = 'You must agree to the privacy policy to continue.';
        return;
      }
      
      // Clear any previous errors
      errorMessage.textContent = '';
      
      // Show loading state
      const submitButton = document.getElementById('submit-button');
      const originalButtonText = submitButton.textContent;
      submitButton.textContent = 'Registering...';
      submitButton.disabled = true;
      
      // Check if this is an admin email
      const isAdmin = email === 'parthavnuthalapati2019@gmail.com'; // Replace with your actual admin email
      
      // Send data to your server
      registerUser(email)
        .then(response => {
          if (response.success) {
            // Store email locally for future use
            chrome.storage.local.set({ 
              'userEmail': email,
              'registrationDate': new Date().toISOString(),
              'isRegistered': true,
              'isAdmin': isAdmin
            }, function() {
              // Redirect to main popup page
              window.location.href = 'popup.html';
            });
          } else {
            errorMessage.textContent = response.error || 'Registration failed. Please try again.';
            submitButton.textContent = originalButtonText;
            submitButton.disabled = false;
          }
        })
        .catch(error => {
          console.error('Registration error:', error);
          errorMessage.textContent = 'Connection error. Please check your internet and try again.';
          submitButton.textContent = originalButtonText;
          submitButton.disabled = false;
        });
    });
    
    // Email validation helper
    function isValidEmail(email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(email);
    }
    
    // Function to send registration data to your server
    async function registerUser(email) {
      try {
        // Replace with your actual API endpoint
        const response = await fetch('https://your-api.com/register-extension-user', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            email: email,
            installDate: new Date().toISOString(),
            browser: 'Chrome',
            extensionVersion: chrome.runtime.getManifest().version
          })
        });
        
        return await response.json();
      } catch (error) {
        console.error('API error:', error);
        // If server is unavailable, still allow registration locally
        return { success: true };
      }
    }
    
    // Check if already registered
    chrome.storage.local.get(['isRegistered'], function(result) {
      if (result.isRegistered) {
        // User already registered, redirect to main popup
        window.location.href = 'popup.html';
      }
    });
    });