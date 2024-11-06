// public/script.js

// Query Input Management
function addQuery() {
    const container = document.getElementById('queryContainer');
    const div = document.createElement('div');
    div.className = 'query-input';
    div.innerHTML = `
      <textarea name="queries[]" rows="3" cols="100" 
        placeholder="Enter Scryfall query string...&#10;Example: id<=ubr (oracle:destroy OR oracle:counter OR oracle:exile)"
        class="query-textarea"></textarea>
      <button type="button" class="remove-query" onclick="removeQuery(this)">Remove</button>
    `;
    container.appendChild(div);
  }
  
  function removeQuery(button) {
    const container = document.getElementById('queryContainer');
    if (container.children.length > 1) {
      button.parentElement.remove();
    }
  }
  
  // Price Display Management
  function initializePriceToggle() {
    const showPricesCheckbox = document.getElementById('showPrices');
    if (!showPricesCheckbox) return;
  
    const priceElements = document.querySelectorAll('.price-info');
    const priceTotals = document.querySelector('.price-totals');
  
    showPricesCheckbox.addEventListener('change', function() {
      const showPrices = this.checked;
      
      priceElements.forEach(el => {
        el.classList.toggle('hidden', !showPrices);
      });
      
      if (priceTotals) {
        priceTotals.classList.toggle('hidden', !showPrices);
      }
  
      fetch('/set-preferences', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ showPrices })
      });
    });
  }
  
  // Copy Functionality
  function initializeCopyButton() {
    const copyButton = document.getElementById('copyButton');
    if (!copyButton) return;
  
    copyButton.addEventListener('click', function() {
      const showPrices = document.getElementById('showPrices').checked;
      let outputText = generateOutputText(showPrices);
  
      navigator.clipboard.writeText(outputText)
        .then(() => alert('Output copied to clipboard!'))
        .catch(err => {
          console.error('Could not copy text: ', err);
          alert('Error copying the output.');
        });
    });
  }
  
  function generateOutputText(showPrices) {
    const categories = Array.from(document.querySelectorAll('.category'));
    let outputText = '';
  
    if (showPrices) {
      outputText += 'Price Summary:\n';
      document.querySelectorAll('.price-total').forEach(total => {
        outputText += `${total.textContent}\n`;
      });
      outputText += `${document.querySelector('.grand-total').textContent}\n\n`;
    }
  
    categories.forEach(category => {
      const categoryName = category.querySelector('.category-name');
      if (categoryName && categoryName.textContent.trim() !== 'Uncategorized') {
        outputText += `${categoryName.textContent}\n`;
      }
  
      category.querySelectorAll('.card').forEach(card => {
        const name = card.querySelector('.card-name').textContent;
        const details = card.querySelector('.card-details');
        
        outputText += `${name}\n`;
        outputText += `  Mana Cost: ${details.querySelector('p:nth-child(1)').textContent.split(': ')[1]}\n`;
        outputText += `  Description: ${details.querySelector('p:nth-child(3)').textContent.split(': ')[1]}\n`;
        
        if (showPrices) {
          outputText += `  Price: ${details.querySelector('.price-info').textContent.split(': ')[1]}\n`;
        }
        outputText += '\n';
      });
    });
  
    return outputText;
  }
  
  // Cache Management
  function initializeCacheClear() {
    const clearCacheButton = document.getElementById('clearCacheButton');
    if (!clearCacheButton) return;
  
    clearCacheButton.addEventListener('click', function() {
      if (confirm('Are you sure you want to clear the cache? This action cannot be undone.')) {
        fetch('/clear-cache', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ confirm: true })
        })
        .then(response => response.json())
        .then(data => {
          if (data.success) {
            alert('Cache has been successfully cleared.');
            window.location.reload();
          } else {
            alert('Failed to clear cache.');
          }
        })
        .catch(error => {
          console.error('Error clearing cache:', error);
          alert('An error occurred while clearing the cache.');
        });
      }
    });
  }
  
  // Initialize all functionality when DOM is loaded
  document.addEventListener('DOMContentLoaded', function() {
    initializePriceToggle();
    initializeCopyButton();
    initializeCacheClear();
  });