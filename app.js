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
    const augmentedCategories = reconstructCategories(augmentedCards);
    console.log('Categories reconstructed');

    console.log('Rendering result page');
    res.render('result', { data: { categories: augmentedCategories }, failedCards });
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
  
  lines.forEach((line, index) => {
    line = line.trim();
    if (line === '') {
      console.log(`Line ${index + 1}: Empty line, skipping`);
      return;
    }

    // Try to match detailed format: e.g., "2x Card Name (SET) 123 [Category]"
    const detailedMatch = line.match(/^(\d+)x\s+(.+?)\s+\((\w+)\)\s+([\w*-]+)(?:\s+\*?\w*\*?)?\s+\[([^\]]+)\]$/);

    if (detailedMatch) {
      const [ , count, name, set, number, category ] = detailedMatch;
      console.log(`Line ${index + 1}: Parsed card - Count: ${count}, Name: "${name}", Set: "${set}", Number: "${number}", Category: "${category}"`);
      
      // Get or create the category array
      if (!categoryMap.has(category)) {
        categoryMap.set(category, { name: category, cards: [] });
      }
      
      // Add the card to its category
      categoryMap.get(category).cards.push({ count: parseInt(count), name, set, number, category });
    } else {
      // Treat as simple card name with default values
      const name = line;
      const count = 1;
      const set = undefined; // Will fetch the default set from Scryfall
      const number = 'N/A';
      const category = 'Uncategorized';

      console.log(`Line ${index + 1}: Parsed simple card - Count: ${count}, Name: "${name}", Set: "${set}", Number: "${number}", Category: "${category}"`);
      
      // Get or create the 'Uncategorized' category
      if (!categoryMap.has(category)) {
        categoryMap.set(category, { name: category, cards: [] });
      }
      
      // Add the card to the 'Uncategorized' category
      categoryMap.get(category).cards.push({ count, name, set, number, category });
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

  augmentedCards.forEach(card => {
    if (!categoriesMap[card.category]) {
      categoriesMap[card.category] = { name: card.category, cards: [] };
    }
    categoriesMap[card.category].cards.push(card);
  });

  return Object.values(categoriesMap);
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