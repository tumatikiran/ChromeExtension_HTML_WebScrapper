let currentTab = null;

// Store the tab when popup opens
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  currentTab = tabs[0];
});

document.getElementById('cloneButton').addEventListener('click', async () => {
  if (!currentTab) return;
  
  const statusElement = document.getElementById('status');
  const cloneButton = document.getElementById('cloneButton');
  const progressContainer = document.getElementById('progressContainer');
  const progressBar = document.getElementById('progressBar');
  const progressText = document.getElementById('progressText');
  const errorList = document.getElementById('errorList');
  
  // Get options
  const options = {
    // Basic Resources
    cloneHTML: document.getElementById('cloneHTML').checked,
    cloneCSS: document.getElementById('cloneCSS').checked,
    cloneJS: document.getElementById('cloneJS').checked,
    
    // Media Resources
    cloneImages: document.getElementById('cloneImages').checked,
    cloneFonts: document.getElementById('cloneFonts').checked,
    cloneVideos: document.getElementById('cloneVideos').checked,
    cloneAudio: document.getElementById('cloneAudio').checked,
    
    // Additional Settings
    handleCORS: document.getElementById('handleCORS').checked,
    preserveStructure: document.getElementById('preserveStructure').checked
  };
  
  // Create folder name from URL
  const url = new URL(currentTab.url);
  const websiteName = url.hostname.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
  const folderName = `${websiteName}_${timestamp}`;
  
  // Reset UI
  progressContainer.style.display = 'block';
  progressBar.style.width = '0%';
  progressText.textContent = '0%';
  cloneButton.disabled = true;
  statusElement.textContent = 'Starting cloning process...';
  errorList.innerHTML = '';
  
  try {
    // First inject JSZip
    await chrome.scripting.executeScript({
      target: { tabId: currentTab.id },
      files: ['jszip.min.js']
    });

    // Then inject content script
    await chrome.scripting.executeScript({
      target: { tabId: currentTab.id },
      files: ['content.js']
    });

    // Finally send the options and folder name
    await chrome.tabs.sendMessage(currentTab.id, {
      action: 'startCloning',
      options: options,
      folderName: folderName
    });
  } catch (error) {
    statusElement.textContent = 'Error: ' + error.message;
    cloneButton.disabled = false;
    progressContainer.style.display = 'none';
    console.error('Cloning error:', error);
  }
});

// Listen for status updates and errors
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'updateStatus') {
    const statusElement = document.getElementById('status');
    const progressBar = document.getElementById('progressBar');
    const progressText = document.getElementById('progressText');
    const cloneButton = document.getElementById('cloneButton');
    const errorList = document.getElementById('errorList');

    statusElement.textContent = request.message;
    
    if (request.progress !== undefined) {
      progressBar.style.width = `${request.progress}%`;
      progressText.textContent = `${request.progress}%`;
    }

    if (request.error) {
      const errorItem = document.createElement('div');
      errorItem.textContent = `• ${request.error}`;
      errorList.appendChild(errorItem);
    }

    if (request.complete) {
      cloneButton.disabled = false;
      setTimeout(() => {
        document.getElementById('progressContainer').style.display = 'none';
      }, 2000);
    }
  }
  return true;
});
  