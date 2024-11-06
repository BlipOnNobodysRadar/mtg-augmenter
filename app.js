// File: /home/blip/Desktop/projects/mtg-augmenter/app.js
const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');
const path = require('path');
const NodeCache = require('node-cache'); // Fixed: removed 'new'

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize cache with a TTL of 24 hours
const cardCache = new NodeCache({ stdTTL: 86400 }); // 24 hours

// Set EJS as templating engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Debug middleware to log all requests
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  if (req.method === 'POST') {
    console.log('Request body:', req.body);
  }
  next();
});

app.get('/', (req, res) => {
  console.log('Rendering index page');
  res.render('index');
});


// Add a new route to handle display preferences:
app.post('/set-preferences', (req, res) => {
  const { showPrices } = req.body;
  // In a real app, you'd want to store this in a session or user preferences
  // For now, we'll just send back a success response
  res.json({ success: true });
});

// New route for search results
app.post('/search', async (req, res) => {
  console.log('Starting /search route');
  const { queries, limit = 30 } = req.body;
  
  if (!queries || queries.length === 0) {
    return res.status(400).send('No search queries provided');
  }

  try {
    const results = [];
    const failedQueries = [];

    for (const query of queries) {
      try {
        const searchUrl = `https://api.scryfall.com/cards/search?q=${encodeURIComponent(query)}%20sort:edhrec&order=desc&unique=cards`;
        const response = await axios.get(searchUrl);
        
        // Get only the specified number of cards
        const cards = response.data.data.slice(0, limit).map(card => ({
          name: card.name,
          mana_cost: card.mana_cost || 'N/A',
          type_line: card.type_line || 'N/A',
          description: card.oracle_text || 'N/A',
          usd: card.prices.usd || 'N/A',
          usd_foil: card.prices.usd_foil || 'N/A',
          count: 1 // For compatibility with existing template
        }));

        results.push({
          name: `Results for: ${query}`,
          cards: cards,
          categoryTotal: cards.reduce((sum, card) => 
            sum + (card.usd !== 'N/A' ? parseFloat(card.usd) : 0), 0).toFixed(2)
        });

        // Rate limiting
        await delay(100);
      } catch (error) {
        console.error(`Error searching for query "${query}":`, error.message);
        failedQueries.push({ query, error: error.response?.data?.details || error.message });
      }
    }

    // Calculate grand total
    const grandTotal = results.reduce((sum, category) => 
      sum + parseFloat(category.categoryTotal), 0).toFixed(2);

    res.render('search-result', { 
      data: { categories: results }, 
      failedQueries,
      grandTotal
    });
  } catch (error) {
    console.error('Error in /search route:', error);
    res.status(500).send(`An error occurred while processing the searches: ${error.message}`);
  }
});

// Then modify the /augment route to pass the totals to the template:

app.post('/augment', async (req, res) => {
  console.log('Starting /augment route');
  const inputText = req.body.inputText;
  console.log('Input text received:', inputText);

  if (!inputText) {
    console.log('No input text provided');
    return res.status(400).send('No input text provided');
  }

  console.log('Parsing input...');
  const parsedData = parseInput(inputText);
  console.log('Parsed data:', JSON.stringify(parsedData, null, 2));

  if (!parsedData.categories || parsedData.categories.length === 0) {
    console.log('No valid categories found in input');
    return res.status(400).send('No valid categories found in input');
  }

  try {
    console.log('Flattening cards...');
    const allCards = parsedData.categories.flatMap(category =>
      category.cards.map(card => ({ ...card, category: category.name }))
    );
    console.log('Total cards to process:', allCards.length);

    console.log('Fetching cards with rate limit...');
    const { augmentedCards, failedCards } = await fetchCardsWithRateLimit(allCards, 100);
    console.log('Cards fetched. Successful:', augmentedCards.length, 'Failed:', failedCards.length);

    console.log('Reconstructing categories...');
    const { categories, grandTotal } = reconstructCategories(augmentedCards);
    console.log('Categories reconstructed. Total price:', grandTotal);

    console.log('Rendering result page');
    res.render('result', { 
      data: { categories }, 
      failedCards,
      grandTotal
    });
  } catch (error) {
    console.error('Error in /augment route:', error);
    res.status(500).send(`An error occurred while processing the cards: ${error.message}`);
  }
});

function parseInput(input) {
  console.log('Starting input parsing');
  const lines = input.split('\n');
  console.log('Number of lines:', lines.length);
  
  // We'll use a Map to group cards by category
  const categoryMap = new Map();
  let currentCategory = 'Uncategorized';
  
  lines.forEach((line, index) => {
    line = line.trim();
    if (line === '') {
      console.log(`Line ${index + 1}: Empty line, skipping`);
      return;
    }

    // Check if this line is a category header by looking at the next line
    const nextLine = index < lines.length - 1 ? lines[index + 1].trim() : '';
    const isHeader = nextLine.match(/^\d+x\s/);
    
    if (isHeader && !line.includes('(') && !line.includes('[')) {
      currentCategory = line;
      console.log(`Line ${index + 1}: Found category header "${currentCategory}"`);
      if (!categoryMap.has(currentCategory)) {
        categoryMap.set(currentCategory, { name: currentCategory, cards: [] });
      }
      return;
    }

    // Try to match Archidekt detailed format: "1x Card Name (set) number [Category{tags}]"
    // Also handles cards with "//" in their names
    const archidektMatch = line.match(/^(\d+)x\s+([^(]+?)\s+\(([^)]+)\)\s+([\w\-*]+(?:\s*\*\w*\*)?)\s+\[([^\]]+?)(?:\{[^\}]+\})?\]$/);

    // Try to match previous detailed format
    const detailedMatch = !archidektMatch && line.match(/^(\d+)x\s+(.+?)\s+\((\w+)\)\s+([\w*-]+)(?:\s+\*?\w*\*?)?\s+\[([^\]]+)\]$/);

    if (archidektMatch || detailedMatch) {
      const match = archidektMatch || detailedMatch;
      const [ , count, name, set, number, category ] = match;
      console.log(`Line ${index + 1}: Parsed card - Count: ${count}, Name: "${name.trim()}", Set: "${set}", Number: "${number}", Category: "${category}"`);
      
      // Get or create the category
      if (!categoryMap.has(category)) {
        categoryMap.set(category, { name: category, cards: [] });
      }
      
      // Add the card to its category
      categoryMap.get(category).cards.push({ 
        count: parseInt(count), 
        name: name.trim(), 
        set, 
        number, 
        category 
      });
    } else {
      // Treat as simple card name with default values
      const cardMatch = line.match(/^(?:(\d+)x\s+)?(.+)$/);
      if (cardMatch) {
        const [, count = "1", name] = cardMatch;
        console.log(`Line ${index + 1}: Parsed simple card - Count: ${count}, Name: "${name}", Category: "${currentCategory}"`);
        
        // Get or create the current category
        if (!categoryMap.has(currentCategory)) {
          categoryMap.set(currentCategory, { name: currentCategory, cards: [] });
        }
        
        // Add the card to the current category
        categoryMap.get(currentCategory).cards.push({ 
          count: parseInt(count), 
          name: name.trim(), 
          set: undefined, 
          number: 'N/A', 
          category: currentCategory 
        });
      }
    }
  });

  // Convert the Map to an array of categories
  const categories = Array.from(categoryMap.values());
  console.log('Parsing complete. Categories found:', categories.length);
  
  return { categories };
}

/**
 * Fetches card information from Scryfall API with rate limiting.
 * @param {Array} cards - Array of card objects to fetch.
 * @param {number} delayMs - Delay in milliseconds between requests.
 * @returns {object} Augmented card data and failed cards.
 */
async function fetchCardsWithRateLimit(cards, delayMs) {
  const augmentedCards = [];
  const failedCards = [];

  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    try {
      const info = await fetchCardInfo(card.name, card.set);
      augmentedCards.push({
        ...card,
        mana_cost: info.mana_cost || 'N/A',
        type_line: info.type_line || 'N/A',  // Added type_line
        description: info.oracle_text || 'N/A',
        usd: info.usd || 'N/A',
        usd_foil: info.usd_foil || 'N/A'
      });
      console.log(`Fetched ${card.name} (${card.set || 'default'})`);
    } catch (error) {
      console.error(`Error fetching data for ${card.name} (${card.set || 'default'}):`, error.message);
      failedCards.push({ name: card.name, set: card.set || 'default', error: error.response ? error.response.data.details : error.message });
      augmentedCards.push({
        ...card,
        mana_cost: 'N/A',
        type_line: 'N/A',  // Added type_line
        description: 'N/A',
        usd: 'N/A',
        usd_foil: 'N/A'
      });
    }

    if (i < cards.length - 1) {
      await delay(delayMs);
    }
  }

  return { augmentedCards, failedCards };
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchCardInfo(name, set) {
  const cacheKey = `${name.toLowerCase()}_${set ? set.toLowerCase() : 'default'}`;
  const cachedData = cardCache.get(cacheKey);

  if (cachedData) {
    console.log(`Cache hit for ${name} (${set || 'default'})`);
    return cachedData;
  }

  const encodedName = encodeURIComponent(name);
  let url = `https://api.scryfall.com/cards/named?exact=${encodedName}`;
  if (set) {
    url += `&set=${set}`;
  }

  try {
    const response = await axios.get(url);
    const data = response.data;
    const cardInfo = {
      mana_cost: data.mana_cost || 'N/A',
      oracle_text: data.oracle_text || 'N/A',
      type_line: data.type_line || 'N/A',  // Added type_line
      usd: data.prices.usd || 'N/A',
      usd_foil: data.prices.usd_foil || 'N/A'
    };
    cardCache.set(cacheKey, cardInfo);
    console.log(`Fetched and cached ${name} (${set || 'default'})`);
    return cardInfo;
  } catch (error) {
    console.error(`Error fetching data for ${name} (${set || 'default'}):`, error.response ? error.response.data.details : error.message);
    throw error;
  }
}


function reconstructCategories(augmentedCards) {
  const categoriesMap = {};
  let grandTotal = 0;

  augmentedCards.forEach(card => {
    if (!categoriesMap[card.category]) {
      categoriesMap[card.category] = { 
        name: card.category, 
        cards: [],
        categoryTotal: 0 
      };
    }
    
    // Calculate price for this card (count * price)
    const cardPrice = card.usd !== 'N/A' ? 
      parseFloat(card.usd) * card.count : 
      0;
    
    // Add to category total
    categoriesMap[card.category].categoryTotal += cardPrice;
    
    // Add to grand total
    grandTotal += cardPrice;
    
    // Add the card to its category
    categoriesMap[card.category].cards.push(card);
  });

  // Convert the totals to fixed decimal strings
  Object.values(categoriesMap).forEach(category => {
    category.categoryTotal = category.categoryTotal.toFixed(2);
  });

  return {
    categories: Object.values(categoriesMap),
    grandTotal: grandTotal.toFixed(2)
  };
}

// Route to clear the cache
app.post('/clear-cache', (req, res) => {
  // Optional: Add authentication or confirmation mechanisms here
  cardCache.flushAll();
  console.log('Cache has been cleared.');
  res.json({ success: true });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
