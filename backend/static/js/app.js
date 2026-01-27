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
      // Use client-side shortener
      handleClientSideShorten(url, customCode);
    } catch (error) {
      console.error('Error:', error);
      showMessage('An error occurred. Please try again.', 'error');
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

  // Client-side shortener (localStorage-based)
  function handleClientSideShorten(url, customCode) {
    try {
      const storage = JSON.parse(localStorage.getItem('shortenedUrls') || '{}');
      
      // Check if custom code is provided
      let generatedCode = customCode;
      
      if (customCode) {
        // Check if custom code already exists
        if (storage[customCode]) {
          codeErrorMessage.textContent = 'This short code is already taken. Please choose another one.';
          return;
        }
        generatedCode = customCode;
      } else {
        // Generate a unique code if not provided
        let attempts = 0;
        do {
          generatedCode = generateRandomCode();
          attempts++;
        } while (storage[generatedCode] && attempts < 100);
        
        if (attempts >= 100) {
          showMessage('Unable to generate a unique short code. Please try with a custom code.', 'error');
          return;
        }
      }
      
      // Create a short URL
      const baseUrl = window.location.origin + window.location.pathname.replace(/\/[^\/]*\.html$/, '');
      const shortUrl = baseUrl + '?goto=' + encodeURIComponent(generatedCode);
      
      // Calculate expiration (24 hours from now)
      const createdAt = new Date();
      const expiresAt = new Date(createdAt.getTime() + 24 * 60 * 60 * 1000);
      
      // Store in localStorage
      storage[generatedCode] = {
        url: url,
        code: generatedCode,
        shortUrl: shortUrl,
        createdAt: createdAt.toISOString(),
        expiresAt: expiresAt.toISOString()
      };
      localStorage.setItem('shortenedUrls', JSON.stringify(storage));
      
      // Display results
      shortUrlOutput.value = shortUrl;
      originalUrlOutput.value = url;
      codeOutput.value = generatedCode;
      expiresAtOutput.value = formatDateTime(expiresAt.toISOString());
      resultContainer.classList.remove('hidden');
      
      // Check if this URL was already shortened
      let isDuplicate = false;
      for (let code in storage) {
        if (code !== generatedCode && storage[code].url === url && !isExpired(storage[code].expiresAt)) {
          isDuplicate = true;
          break;
        }
      }
      
      if (isDuplicate) {
        showMessage('✓ URL shortened (This URL was previously shortened)', 'success');
      } else {
        showMessage('✓ URL shortened successfully!', 'success');
      }
      
      urlInput.value = '';
      codeInput.value = '';
      urlInput.focus();
    } catch (e) {
      console.error('Client-side shortening error:', e);
      showMessage('An error occurred. Please try again.', 'error');
    }
  }

  // Check if a URL is expired
  function isExpired(expiresAtString) {
    try {
      const expiresAt = new Date(expiresAtString);
      return new Date() > expiresAt;
    } catch (e) {
      return false;
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

  // Handle redirect on page load
  function handleRedirect() {
    const params = new URLSearchParams(window.location.search);
    const gotoCode = params.get('goto');
    
    if (gotoCode) {
      const storage = JSON.parse(localStorage.getItem('shortenedUrls') || '{}');
      const shortened = storage[gotoCode];
      
      if (shortened) {
        // Check if expired
        if (isExpired(shortened.expiresAt)) {
          // Remove expired entry
          delete storage[gotoCode];
          localStorage.setItem('shortenedUrls', JSON.stringify(storage));
          showMessage(`The short link has expired (expired at ${formatDateTime(shortened.expiresAt)})`, 'error');
          return;
        }
        // Redirect to the original URL
        window.location.href = shortened.url;
      } else {
        showMessage('Short link not found. It may have expired or does not exist.', 'error');
      }
    }
  }

  // Check for redirect on page load
  handleRedirect();
});


