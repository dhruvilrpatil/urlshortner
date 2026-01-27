// URL Shortener Application
document.addEventListener('DOMContentLoaded', function() {
  const form = document.getElementById('shortenerForm');
  const urlInput = document.getElementById('urlInput');
  const codeInput = document.getElementById('codeInput');
  const shortenBtn = document.getElementById('shortenBtn');
  const btnText = document.querySelector('.btn-text');
  const btnLoader = document.getElementById('btnLoader');
  const resultContainer = document.getElementById('resultContainer');
  const messageContainer = document.getElementById('messageContainer');
  const messageContent = document.getElementById('messageContent');
  const shortUrlOutput = document.getElementById('shortUrlOutput');
  const originalUrlOutput = document.getElementById('originalUrlOutput');
  const codeOutput = document.getElementById('codeOutput');
  const expiresAtOutput = document.getElementById('expiresAtOutput');
  const copyBtn = document.getElementById('copyBtn');
  const backBtn = document.getElementById('backBtn');
  const errorMessage = document.getElementById('errorMessage');
  const codeErrorMessage = document.getElementById('codeErrorMessage');
  const copyFeedback = document.getElementById('copyFeedback');

  // Form submission
  form.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const url = urlInput.value.trim();
    const customCode = codeInput.value.trim();
    
    // Clear previous errors
    errorMessage.textContent = '';
    codeErrorMessage.textContent = '';
    messageContainer.classList.add('hidden');
    
    // Validate URL
    if (!url) {
      errorMessage.textContent = 'Please enter a URL';
      return;
    }
    
    if (!isValidUrl(url)) {
      errorMessage.textContent = 'Please enter a valid URL (starting with http:// or https://)';
      return;
    }
    
    if (url.length > 2048) {
      errorMessage.textContent = 'URL is too long (max 2048 characters)';
      return;
    }
    
    // Validate custom code if provided
    if (customCode) {
      const codeValidation = validateCustomCode(customCode);
      if (!codeValidation.valid) {
        codeErrorMessage.textContent = codeValidation.error;
        return;
      }
    }
    
    // Show loading state
    shortenBtn.disabled = true;
    btnText.classList.add('hidden');
    btnLoader.classList.remove('hidden');
    resultContainer.classList.add('hidden');
    
    try {
      const payload = { url: url };
      if (customCode) {
        payload.code = customCode;
      }
      
      const response = await fetch('/shorten', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });
      
      const data = await response.json();
      
      if (response.ok) {
        // Success - display results
        shortUrlOutput.value = data.short_url;
        originalUrlOutput.value = data.original_url;
        codeOutput.value = data.code;
        expiresAtOutput.value = formatDateTime(data.expires_at);
        resultContainer.classList.remove('hidden');
        
        // Show message if URL was already shortened
        if (data.message) {
          showMessage(data.message, 'success');
        }
        
        urlInput.value = '';
        codeInput.value = '';
        urlInput.focus();
      } else {
        // Error response from server
        if (data.error) {
          // Check if error is about the custom code
          if (data.error.toLowerCase().includes('code') || data.error.toLowerCase().includes('already')) {
            codeErrorMessage.textContent = data.error;
          } else {
            showMessage(data.error, 'error');
          }
        } else {
          showMessage('Failed to shorten URL', 'error');
        }
      }
    } catch (error) {
      console.error('Error:', error);
      // Fallback to client-side demo shortener if backend is unavailable
      handleClientSideShorten(url, customCode);
    } finally {
      // Hide loading state
      shortenBtn.disabled = false;
      btnText.classList.remove('hidden');
      btnLoader.classList.add('hidden');
    }
  });
  
  // Back button functionality
  backBtn.addEventListener('click', function() {
    resultContainer.classList.add('hidden');
    messageContainer.classList.add('hidden');
    urlInput.focus();
  });
  
  // Copy button functionality
  copyBtn.addEventListener('click', function() {
    const shortUrl = shortUrlOutput.value;
    
    if (navigator.clipboard) {
      navigator.clipboard.writeText(shortUrl).then(function() {
        // Show feedback
        copyFeedback.classList.remove('hidden');
        setTimeout(function() {
          copyFeedback.classList.add('hidden');
        }, 2000);
      }).catch(function(err) {
        console.error('Failed to copy:', err);
        fallbackCopy(shortUrl);
      });
    } else {
      fallbackCopy(shortUrl);
    }
  });
  
  // Fallback copy function for older browsers
  function fallbackCopy(text) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    
    copyFeedback.classList.remove('hidden');
    setTimeout(function() {
      copyFeedback.classList.add('hidden');
    }, 2000);
  }
  
  // URL validation
  function isValidUrl(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
    } catch (e) {
      return false;
    }
  }
  
  // Validate custom code
  function validateCustomCode(code) {
    if (!code) {
      return { valid: true };
    }
    
    if (code.length < 3) {
      return { valid: false, error: 'Short code must be at least 3 characters' };
    }
    
    if (code.length > 32) {
      return { valid: false, error: 'Short code must be at most 32 characters' };
    }
    
    // Only allow alphanumeric, hyphens, and underscores
    if (!/^[a-zA-Z0-9_-]+$/.test(code)) {
      return { valid: false, error: 'Short code can only contain letters, numbers, hyphens, and underscores' };
    }
    
    return { valid: true };
  }
  
  // Format ISO datetime to readable format
  function formatDateTime(isoString) {
    try {
      const date = new Date(isoString.replace('Z', '+00:00'));
      return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZoneName: 'short'
      });
    } catch (e) {
      return isoString;
    }
  }
  
  // Show message
  function showMessage(message, type) {
    messageContent.textContent = message;
    messageContainer.classList.remove('hidden', 'error', 'success');
    messageContainer.classList.add(type);
  }
  
  // Clear error on input
  urlInput.addEventListener('input', function() {
    errorMessage.textContent = '';
  });
  
  codeInput.addEventListener('input', function() {
    codeErrorMessage.textContent = '';
  });

  // Client-side demo shortener (fallback when backend is unavailable)
  function handleClientSideShorten(url, customCode) {
    try {
      // Generate a short code if not provided
      const generatedCode = customCode || generateRandomCode();
      
      // Create a demo short URL
      const baseUrl = window.location.origin;
      const shortUrl = baseUrl + '/?goto=' + encodeURIComponent(generatedCode);
      
      // Calculate expiration (24 hours from now)
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);
      
      // Display results
      shortUrlOutput.value = shortUrl;
      originalUrlOutput.value = url;
      codeOutput.value = generatedCode;
      expiresAtOutput.value = formatDateTime(expiresAt.toISOString());
      resultContainer.classList.remove('hidden');
      
      // Store in localStorage for demo purposes
      const storage = JSON.parse(localStorage.getItem('shortenedUrls') || '{}');
      storage[generatedCode] = {
        url: url,
        code: generatedCode,
        shortUrl: shortUrl,
        createdAt: new Date().toISOString(),
        expiresAt: expiresAt.toISOString()
      };
      localStorage.setItem('shortenedUrls', JSON.stringify(storage));
      
      urlInput.value = '';
      codeInput.value = '';
      urlInput.focus();
      
      showMessage('✓ Demo mode: URL shortened (stored locally in browser)', 'success');
    } catch (e) {
      console.error('Client-side shortening error:', e);
      showMessage('An error occurred. Please try again.', 'error');
    }
  }

  // Generate a random short code
  function generateRandomCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  // Handle redirect on page load (demo mode)
  function handleRedirect() {
    const params = new URLSearchParams(window.location.search);
    const gotoCode = params.get('goto');
    
    if (gotoCode) {
      const storage = JSON.parse(localStorage.getItem('shortenedUrls') || '{}');
      const shortened = storage[gotoCode];
      
      if (shortened) {
        // Check if expired
        const expiresAt = new Date(shortened.expiresAt);
        if (new Date() > expiresAt) {
          showMessage(`The short link has expired (expired at ${formatDateTime(shortened.expiresAt)})`, 'error');
          return;
        }
        // Redirect to the original URL
        window.location.href = shortened.url;
      } else {
        showMessage('Short link not found. It may have expired or was created in a different session.', 'error');
      }
    }
  }

  // Check for redirect on page load
  handleRedirect();
});


