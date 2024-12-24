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
      images: [],
      fonts: [],
      videos: [],
      audio: []
    };

    let progress = 0;
    const progressSteps = {
      css: options.cloneCSS ? 15 : 0,
      js: options.cloneJS ? 15 : 0,
      images: options.cloneImages ? 15 : 0,
      fonts: options.cloneFonts ? 15 : 0,
      videos: options.cloneVideos ? 15 : 0,
      audio: options.cloneAudio ? 15 : 0,
      zip: 10
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

    // Clone Fonts if selected
    if (options.cloneFonts) {
      chrome.runtime.sendMessage({ 
        action: 'updateStatus', 
        message: 'Cloning Fonts...', 
        progress 
      });

      // Get fonts from @font-face rules
      const fontUrls = new Set();
      Array.from(document.styleSheets).forEach(sheet => {
        try {
          Array.from(sheet.cssRules || []).forEach(rule => {
            if (rule instanceof CSSFontFaceRule) {
              const urlMatch = rule.cssText.match(/url\(['"]?(.*?)['"]?\)/);
              if (urlMatch) {
                fontUrls.add(urlMatch[1]);
              }
            }
          });
        } catch (e) {
          if (options.handleCORS) {
            chrome.runtime.sendMessage({ 
              action: 'updateStatus', 
              error: `Failed to access stylesheet: ${e.message}`
            });
          }
        }
      });

      for (const url of fontUrls) {
        try {
          const response = await fetch(url);
          const blob = await response.blob();
          resources.fonts.push({
            url: url,
            blob: blob
          });
        } catch (error) {
          const errorMessage = `Failed to clone font from ${url}: ${error.message}`;
          console.error(errorMessage);
          if (options.handleCORS) {
            chrome.runtime.sendMessage({ 
              action: 'updateStatus', 
              error: errorMessage
            });
          }
        }
      }
      progress += progressSteps.fonts;
    }

    // Clone Videos if selected
    if (options.cloneVideos) {
      chrome.runtime.sendMessage({ 
        action: 'updateStatus', 
        message: 'Cloning Videos...', 
        progress 
      });

      const videos = [
        ...Array.from(document.getElementsByTagName('video')),
        ...Array.from(document.getElementsByTagName('source'))
      ];

      for (const video of videos) {
        const url = video.src || video.currentSrc;
        if (url) {
          try {
            const response = await fetch(url);
            const blob = await response.blob();
            resources.videos.push({
              url: url,
              blob: blob
            });
          } catch (error) {
            const errorMessage = `Failed to clone video from ${url}: ${error.message}`;
            console.error(errorMessage);
            if (options.handleCORS) {
              chrome.runtime.sendMessage({ 
                action: 'updateStatus', 
                error: errorMessage
              });
            }
          }
        }
      }
      progress += progressSteps.videos;
    }

    // Clone Audio if selected
    if (options.cloneAudio) {
      chrome.runtime.sendMessage({ 
        action: 'updateStatus', 
        message: 'Cloning Audio...', 
        progress 
      });

      const audioElements = [
        ...Array.from(document.getElementsByTagName('audio')),
        ...Array.from(document.getElementsByTagName('source'))
      ];

      for (const audio of audioElements) {
        const url = audio.src || audio.currentSrc;
        if (url) {
          try {
            const response = await fetch(url);
            const blob = await response.blob();
            resources.audio.push({
              url: url,
              blob: blob
            });
          } catch (error) {
            const errorMessage = `Failed to clone audio from ${url}: ${error.message}`;
            console.error(errorMessage);
            if (options.handleCORS) {
              chrome.runtime.sendMessage({ 
                action: 'updateStatus', 
                error: errorMessage
              });
            }
          }
        }
      }
      progress += progressSteps.audio;
    }

    // Create ZIP with all resources
    chrome.runtime.sendMessage({ 
      action: 'updateStatus', 
      message: 'Creating ZIP file...', 
      progress 
    });

    const zip = new JSZip();

    // Helper function to get relative path and ensure no duplicate folders
    const getRelativePath = (url, type) => {
      try {
        if (url === 'inline') {
          return `${type}/inline-${Date.now()}.${type}`;
        }
        
        const urlObj = new URL(url);
        let path = urlObj.pathname.substring(1);
        
        // If preserving structure, keep the full path but remove any query parameters
        if (options.preserveStructure) {
          return path.split('?')[0];
        }
        
        // If not preserving structure, just keep the filename
        return `${type}/${path.split('/').pop()}`;
      } catch {
        return `${type}/${url.split('/').pop() || `file-${Date.now()}.${type}`}`;
      }
    };

    // Add HTML
    if (options.cloneHTML) {
      zip.file('index.html', resources.html);
    }

    // Add CSS files
    if (options.cloneCSS) {
      resources.styles.forEach((style, index) => {
        const path = style.url === 'inline' 
          ? `css/inline-style-${index}.css`
          : getRelativePath(style.url, 'css');
        zip.file(path, style.content);
      });
    }

    // Add JS files
    if (options.cloneJS) {
      resources.scripts.forEach((script, index) => {
        const path = script.url === 'inline'
          ? `js/inline-script-${index}.js`
          : getRelativePath(script.url, 'js');
        zip.file(path, script.content);
      });
    }

    // Add Images
    if (options.cloneImages) {
      resources.images.forEach((image, index) => {
        const path = getRelativePath(image.url, 'images');
        zip.file(path, image.blob);
      });
    }

    // Add Fonts
    if (options.cloneFonts) {
      resources.fonts.forEach((font, index) => {
        const path = getRelativePath(font.url, 'fonts');
        zip.file(path, font.blob);
      });
    }

    // Add Videos
    if (options.cloneVideos) {
      resources.videos.forEach((video, index) => {
        const path = getRelativePath(video.url, 'videos');
        zip.file(path, video.blob);
      });
    }

    // Add Audio
    if (options.cloneAudio) {
      resources.audio.forEach((audio, index) => {
        const path = getRelativePath(audio.url, 'audio');
        zip.file(path, audio.blob);
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
  