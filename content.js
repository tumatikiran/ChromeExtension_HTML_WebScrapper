// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'startCloning') {
    if (typeof JSZip === 'undefined') {
      chrome.runtime.sendMessage({ 
        action: 'updateStatus', 
        message: 'Error: JSZip not loaded', 
        progress: 0,
        complete: true,
        error: 'JSZip library not loaded'
      });
      return;
    }
    cloneWebsite(request.options);
  }
});

async function cloneWebsite(options) {
  try {
    chrome.runtime.sendMessage({ 
      action: 'updateStatus', 
      message: 'Starting cloning process...', 
      progress: 0 
    });

    const baseUrl = window.location.origin;
    const resources = {
      html: options.cloneHTML ? document.documentElement.outerHTML : null,
      styles: [],
      scripts: [],
      images: []
    };

    let progress = 0;
    const progressSteps = {
      css: options.cloneCSS ? 20 : 0,
      js: options.cloneJS ? 20 : 0,
      images: options.cloneImages ? 20 : 0,
      zip: 40
    };

    // Clone CSS if selected
    if (options.cloneCSS) {
      chrome.runtime.sendMessage({ 
        action: 'updateStatus', 
        message: 'Cloning CSS...', 
        progress 
      });

      const styleSheets = Array.from(document.styleSheets);
      for (const sheet of styleSheets) {
        try {
          if (sheet.href) {
            const response = await fetch(sheet.href);
            const css = await response.text();
            resources.styles.push({
              url: sheet.href,
              content: css
            });
          } else if (sheet.ownerNode && sheet.ownerNode.textContent) {
            resources.styles.push({
              url: 'inline',
              content: sheet.ownerNode.textContent
            });
          }
        } catch (error) {
          const errorMessage = `Failed to clone CSS from ${sheet.href}: ${error.message}`;
          console.error(errorMessage);
          if (options.handleCORS) {
            chrome.runtime.sendMessage({ 
              action: 'updateStatus', 
              error: errorMessage
            });
          }
        }
      }
      progress += progressSteps.css;
    }

    // Clone JavaScript if selected
    if (options.cloneJS) {
      chrome.runtime.sendMessage({ 
        action: 'updateStatus', 
        message: 'Cloning JavaScript...', 
        progress 
      });

      const scripts = Array.from(document.getElementsByTagName('script'));
      for (const script of scripts) {
        if (script.src) {
          try {
            const response = await fetch(script.src);
            const js = await response.text();
            resources.scripts.push({
              url: script.src,
              content: js
            });
          } catch (error) {
            const errorMessage = `Failed to clone JavaScript from ${script.src}: ${error.message}`;
            console.error(errorMessage);
            if (options.handleCORS) {
              chrome.runtime.sendMessage({ 
                action: 'updateStatus', 
                error: errorMessage
              });
            }
          }
        } else if (script.textContent) {
          resources.scripts.push({
            url: 'inline',
            content: script.textContent
          });
        }
      }
      progress += progressSteps.js;
    }

    // Clone Images if selected
    if (options.cloneImages) {
      chrome.runtime.sendMessage({ 
        action: 'updateStatus', 
        message: 'Cloning Images...', 
        progress 
      });

      const images = Array.from(document.getElementsByTagName('img'));
      for (const img of images) {
        try {
          const response = await fetch(img.src);
          const blob = await response.blob();
          resources.images.push({
            url: img.src,
            blob: blob
          });
        } catch (error) {
          const errorMessage = `Failed to clone image from ${img.src}: ${error.message}`;
          console.error(errorMessage);
          if (options.handleCORS) {
            chrome.runtime.sendMessage({ 
              action: 'updateStatus', 
              error: errorMessage
            });
          }
        }
      }
      progress += progressSteps.images;
    }

    // Create ZIP file
    chrome.runtime.sendMessage({ 
      action: 'updateStatus', 
      message: 'Creating ZIP file...', 
      progress 
    });

    const zip = new JSZip();
    
    // Add selected resources to ZIP
    if (options.cloneHTML) {
      zip.file('index.html', resources.html);
    }
    
    if (options.cloneCSS) {
      const cssFolder = zip.folder('css');
      resources.styles.forEach((style, index) => {
        const fileName = style.url === 'inline' ? `inline-style-${index}.css` : style.url.split('/').pop();
        cssFolder.file(fileName, style.content);
      });
    }
    
    if (options.cloneJS) {
      const jsFolder = zip.folder('js');
      resources.scripts.forEach((script, index) => {
        const fileName = script.url === 'inline' ? `inline-script-${index}.js` : script.url.split('/').pop();
        jsFolder.file(fileName, script.content);
      });
    }
    
    if (options.cloneImages) {
      const imgFolder = zip.folder('images');
      resources.images.forEach((image, index) => {
        const extension = image.url.split('.').pop() || 'png';
        const fileName = `image${index}.${extension}`;
        imgFolder.file(fileName, image.blob);
      });
    }

    // Generate and download ZIP
    chrome.runtime.sendMessage({ 
      action: 'updateStatus', 
      message: 'Generating ZIP file...', 
      progress: 90 
    });

    const content = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(content);
    
    chrome.runtime.sendMessage({
      action: 'download',
      url: url,
      filename: 'website-clone.zip'
    });

    chrome.runtime.sendMessage({ 
      action: 'updateStatus', 
      message: 'Download complete!', 
      progress: 100,
      complete: true 
    });

  } catch (error) {
    chrome.runtime.sendMessage({ 
      action: 'updateStatus', 
      message: 'Error: ' + error.message, 
      progress: 0,
      complete: true,
      error: error.message
    });
  }
}
  