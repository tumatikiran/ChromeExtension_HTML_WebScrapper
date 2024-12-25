// Add this function at the beginning of the file to extract URLs from CSS
function extractUrlsFromCSS(cssText) {
  const urlRegex = /url\(['"]?([^'"()]+)['"]?\)/g;
  const urls = new Set();
  let match;
  
  while ((match = urlRegex.exec(cssText)) !== null) {
    if (match[1] && !match[1].startsWith('data:')) {
      urls.add(match[1]);
    }
  }
  
  return Array.from(urls);
}

// Add this function to get computed styles
function getBackgroundImages() {
  const urls = new Set();
  const elements = document.querySelectorAll('*');

  elements.forEach(element => {
    const computedStyle = window.getComputedStyle(element);
    
    // Check all background-related properties
    const backgroundProps = [
      'backgroundImage',
      'background',
      'borderImage',
      'listStyleImage'
    ];

    backgroundProps.forEach(prop => {
      const value = computedStyle[prop];
      if (value && value !== 'none') {
        const matches = value.match(/url\(['"]?([^'"()]+)['"]?\)/g);
        if (matches) {
          matches.forEach(match => {
            const url = match.replace(/url\(['"]?([^'"()]+)['"]?\)/, '$1');
            if (!url.startsWith('data:')) {
              urls.add(url);
            }
          });
        }
      }
    });

    // Check for custom data attributes that might contain image URLs
    Array.from(element.attributes).forEach(attr => {
      if (attr.name.startsWith('data-') && attr.value.match(/\.(png|jpg|jpeg|gif|svg|webp)$/i)) {
        urls.add(attr.value);
      }
    });
  });

  // Also check CSS variables that might contain image URLs
  const rootStyles = window.getComputedStyle(document.documentElement);
  for (const prop of rootStyles) {
    if (prop.startsWith('--')) {
      const value = rootStyles.getPropertyValue(prop);
      if (value.includes('url(')) {
        const matches = value.match(/url\(['"]?([^'"()]+)['"]?\)/g);
        if (matches) {
          matches.forEach(match => {
            const url = match.replace(/url\(['"]?([^'"()]+)['"]?\)/, '$1');
            if (!url.startsWith('data:')) {
              urls.add(url);
            }
          });
        }
      }
    }
  }

  return Array.from(urls);
}

// Add this function to get favicon and other icons
function getIconUrls() {
  const urls = new Set();
  
  // Get favicon and standard icons
  const favicon = document.querySelector('link[rel="shortcut icon"], link[rel="icon"]');
  if (favicon) {
    urls.add(favicon.href);
  }
  
  // Get all icon-related links
  const iconLinks = document.querySelectorAll('link[rel*="icon"], link[rel="apple-touch-icon"]');
  iconLinks.forEach(icon => urls.add(icon.href));

  // Get icons from elements with icon classes
  const iconElements = document.querySelectorAll(
    '.icon, .fa, .fas, .far, .fab, .material-icons, ' + 
    '[class*="icon-"], [class*="ico-"], [class*="fa-"]'
  );

  iconElements.forEach(element => {
    // Get background image if exists
    const style = window.getComputedStyle(element);
    if (style.backgroundImage && style.backgroundImage !== 'none') {
      const matches = style.backgroundImage.match(/url\(['"]?([^'"()]+)['"]?\)/g);
      if (matches) {
        matches.forEach(match => {
          const url = match.replace(/url\(['"]?([^'"()]+)['"]?\)/, '$1');
          urls.add(url);
        });
      }
    }

    // Check for font awesome or other icon font classes
    element.classList.forEach(className => {
      if (className.match(/(fa-|icon-|ico-)/)) {
        // Store the class name for reference
        console.log('Found icon class:', className);
      }
    });
  });

  // Get icons from sprite sheets and SVG symbols
  const svgUses = document.querySelectorAll('use[href]');
  svgUses.forEach(use => {
    const href = use.getAttribute('href');
    if (href && href.startsWith('#')) {
      const svgId = href.substring(1);
      const svgSymbol = document.querySelector(`#${svgId}`);
      if (svgSymbol) {
        urls.add(window.location.href + href);
      }
    }
  });

  return Array.from(urls);
}

// Function to convert relative URLs to absolute
function makeUrlAbsolute(url, base) {
  try {
    // If it's already an absolute URL or a data URL, return as is
    if (url.match(/^(https?:)?\/\//) || url.startsWith('data:')) {
      return url;
    }
    // Handle root-relative URLs
    if (url.startsWith('/')) {
      const baseUrl = new URL(base);
      return `${baseUrl.origin}${url}`;
    }
    // Convert relative URL to absolute
    return new URL(url, base).href;
  } catch (error) {
    console.error('Error making URL absolute:', error);
    return url;
  }
}

// Function to rewrite URLs in HTML content
function rewriteHtmlUrls(html, baseUrl) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  
  // Process links
  doc.querySelectorAll('a[href]').forEach(link => {
    try {
      const href = link.getAttribute('href');
      const absoluteUrl = makeUrlAbsolute(href, baseUrl);
      const url = new URL(absoluteUrl);
      
      // Only modify internal links
      if (url.hostname === new URL(baseUrl).hostname) {
        let newPath = url.pathname;
        if (newPath === '/') {
          newPath = 'index.html';
        } else if (!newPath.endsWith('.html')) {
          newPath = newPath.replace(/\/$/, '') + '.html';
        }
        link.setAttribute('href', newPath.replace(/^\//, ''));
      }
    } catch (error) {
      console.error('Error processing link:', error);
    }
  });

  // Rewrite URLs in various attributes
  const urlAttributes = {
    'a': 'href',
    'img': 'src',
    'link': 'href',
    'script': 'src',
    'form': 'action',
    'iframe': 'src',
    'video': 'src',
    'audio': 'src',
    'source': 'src',
    'track': 'src',
    'embed': 'src',
    'object': 'data'
  };

  // Process each element type and its corresponding attribute
  Object.entries(urlAttributes).forEach(([tag, attr]) => {
    doc.querySelectorAll(tag).forEach(element => {
      if (element.hasAttribute(attr)) {
        const originalUrl = element.getAttribute(attr);
        const absoluteUrl = makeUrlAbsolute(originalUrl, baseUrl);
        
        // Update the attribute with the local path
        if (!absoluteUrl.startsWith('data:')) {
          try {
            const url = new URL(absoluteUrl);
            const localPath = url.pathname.substring(1); // Remove leading slash
            element.setAttribute(attr, localPath);
          } catch (error) {
            console.error('Error processing URL:', error);
          }
        }
      }
    });
  });

  // Rewrite inline styles
  doc.querySelectorAll('[style]').forEach(element => {
    const style = element.getAttribute('style');
    const rewrittenStyle = rewriteCssUrls(style, baseUrl);
    element.setAttribute('style', rewrittenStyle);
  });

  return doc.documentElement.outerHTML;
}

// Function to rewrite URLs in CSS content
function rewriteCssUrls(css, baseUrl) {
  return css.replace(/url\(['"]?([^'"()]+)['"]?\)/g, (match, url) => {
    if (url.startsWith('data:')) {
      return match;
    }
    const absoluteUrl = makeUrlAbsolute(url, baseUrl);
    try {
      const urlObj = new URL(absoluteUrl);
      return `url('${urlObj.pathname.substring(1)}')`;
    } catch (error) {
      console.error('Error processing CSS URL:', error);
      return match;
    }
  });
}

// Add this function to get all internal page URLs
function getInternalPageUrls(baseUrl) {
  const urls = new Set();
  const domain = new URL(baseUrl).hostname;
  
  // Get all internal links
  document.querySelectorAll('a[href]').forEach(link => {
    try {
      const href = link.href;
      const url = new URL(href);
      
      // Only include links from same domain and not already processed
      if (url.hostname === domain && !urls.has(href)) {
        urls.add(href);
      }
    } catch (error) {
      console.error('Error processing link:', error);
    }
  });
  
  return Array.from(urls);
}

// Add this function to clone a single page
async function cloneSinglePage(url, zip, options, baseUrl) {
  try {
    const response = await fetch(url);
    const html = await response.text();
    
    // Get the relative path for this page
    const urlObj = new URL(url);
    let path = urlObj.pathname;
    if (path === '/') {
      path = 'index.html';
    } else if (!path.endsWith('.html')) {
      path = path.replace(/\/$/, '') + '.html';
    }
    
    // Remove leading slash
    path = path.replace(/^\//, '');
    
    // Rewrite URLs in the HTML content
    const rewrittenHtml = rewriteHtmlUrls(html, baseUrl);
    
    // Add to zip
    zip.file(path, rewrittenHtml);
    
    return true;
  } catch (error) {
    console.error(`Error cloning page ${url}:`, error);
    return false;
  }
}

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
    const folderName = request.folderName || 'website-clone';
    cloneWebsite(request.options, folderName);
  }
});

async function cloneWebsite(options, folderName) {
  try {
    chrome.runtime.sendMessage({ 
      action: 'updateStatus', 
      message: 'Starting cloning process...', 
      progress: 0 
    });

    const baseUrl = window.location.href;
    
    // Get all internal pages to clone
    const internalPages = getInternalPageUrls(baseUrl);
    const totalPages = internalPages.length;
    let pagesProcessed = 0;

    chrome.runtime.sendMessage({ 
      action: 'updateStatus', 
      message: `Found ${totalPages} pages to clone...`, 
      progress: 0 
    });

    // Create ZIP
    const zip = new JSZip();
  
    // Clone each internal page
    for (const pageUrl of internalPages) {
      chrome.runtime.sendMessage({ 
        action: 'updateStatus', 
        message: `Cloning page: ${pageUrl}`, 
        progress: (pagesProcessed / totalPages) * 50 
      });
      
      await cloneSinglePage(pageUrl, zip, options, baseUrl);
      pagesProcessed++;
    }

    const resources = {
      html: options.cloneHTML ? document.documentElement.outerHTML : null,
      styles: [],
      scripts: [],
      images: [],
      fonts: [],
      videos: [],
      audio: [],
      backgroundImages: [],
      icons: []
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

    // Rewrite URLs in HTML
    if (options.cloneHTML) {
      resources.html = rewriteHtmlUrls(document.documentElement.outerHTML, baseUrl);
    }

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

    // Update CSS processing
    if (options.cloneCSS) {
      resources.styles = resources.styles.map(style => ({
        ...style,
        content: rewriteCssUrls(style.content, baseUrl)
      }));
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

    // Update JavaScript processing to handle any URLs in JS files
    if (options.cloneJS) {
      resources.scripts = resources.scripts.map(script => ({
        ...script,
        // Optionally process URLs in JavaScript files if needed
        content: script.content
      }));
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

    // Clone background images
    if (options.cloneImages) {
      chrome.runtime.sendMessage({ 
        action: 'updateStatus', 
        message: 'Cloning Background Images...', 
        progress 
      });

      const backgroundImageUrls = getBackgroundImages();
      for (const url of backgroundImageUrls) {
        try {
          const absoluteUrl = new URL(url, window.location.href).href;
          const response = await fetch(absoluteUrl);
          const blob = await response.blob();
          resources.backgroundImages.push({
            url: absoluteUrl,
            blob: blob
          });
        } catch (error) {
          const errorMessage = `Failed to clone background image from ${url}: ${error.message}`;
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

    // Clone icons
    if (options.cloneImages) {
      chrome.runtime.sendMessage({ 
        action: 'updateStatus', 
        message: 'Cloning Icons...', 
        progress 
      });

      const iconUrls = getIconUrls();
      for (const url of iconUrls) {
        try {
      const response = await fetch(url);
      const blob = await response.blob();
          resources.icons.push({
            url: url,
            blob: blob
          });
        } catch (error) {
          const errorMessage = `Failed to clone icon from ${url}: ${error.message}`;
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

    // Create ZIP with all resources
    chrome.runtime.sendMessage({ 
      action: 'updateStatus', 
      message: 'Creating ZIP file...', 
      progress 
    });

    // Helper function to get relative path and preserve original structure
    const getRelativePath = (url, type) => {
      try {
        if (url === 'inline') {
          return `${type}/inline-${Date.now()}.${type}`;
        }

        const absoluteUrl = makeUrlAbsolute(url, baseUrl);
        const urlObj = new URL(absoluteUrl);
        let path = urlObj.pathname;
        
        // Remove leading slash if present
        if (path.startsWith('/')) {
          path = path.substring(1);
        }

        // If preserving structure, keep the path but remove any query parameters
        if (options.preserveStructure) {
          return path.split('?')[0];
        }
        
        // If not preserving structure, organize by type
        const filename = path.split('/').pop().split('?')[0];
        return `${type}/${filename}`;
      } catch (error) {
        console.error('Error processing path:', error);
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

    // Add background images to ZIP
    if (options.cloneImages && resources.backgroundImages.length > 0) {
      resources.backgroundImages.forEach((image) => {
        try {
          const path = getRelativePath(image.url, 'images');
          zip.file(path, image.blob);
        } catch (error) {
          console.error('Error adding background image to ZIP:', error);
          const extension = image.url.split('.').pop().split('?')[0] || 'png';
          const originalName = image.url.split('/').pop().split('?')[0];
          const fileName = originalName || `background-${Date.now()}.${extension}`;
          zip.file(`images/${fileName}`, image.blob);
        }
      });
    }

    // Add icons to ZIP
    if (options.cloneImages && resources.icons.length > 0) {
      resources.icons.forEach((icon) => {
        try {
          const path = getRelativePath(icon.url, 'images');
          zip.file(path, icon.blob);
        } catch (error) {
          console.error('Error adding icon to ZIP:', error);
          const extension = icon.url.split('.').pop().split('?')[0] || 'ico';
          const originalName = icon.url.split('/').pop().split('?')[0];
          const fileName = originalName || `icon-${Date.now()}.${extension}`;
          zip.file(`images/${fileName}`, icon.blob);
        }
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
      filename: `${folderName}.zip`
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
  