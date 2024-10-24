# MTG Card Augmenter

A web application that enhances Magic: The Gathering card lists by automatically fetching and displaying additional card information such as mana costs, descriptions, and current market prices using the Scryfall API.

## Features

- Parse card lists with support for both simple and detailed formats
- Fetch card information from Scryfall API including:
  - Mana cost
  - Card description (oracle text)
  - Current price in USD (both regular and foil)
- Category-based organization of cards
- Built-in rate limiting to respect Scryfall API guidelines
- 24-hour caching of card data for improved performance
- Copy augmented results to clipboard
- Clear cache functionality
- Responsive web interface

## Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/mtg-augmenter.git

# Navigate to project directory
cd mtg-augmenter

# Install dependencies
npm install
```

## Usage

1. Start the server:
```bash
npm start
```

2. Open your browser and navigate to `http://localhost:3000`

3. Input your card list in either format:
   - Simple format: Just card names, one per line
   - Detailed format: `2x Card Name (SET) 123 [Category]`

Example input (compatible with .txt exports from Archidekt):
```
Creatures
2x Lightning Bolt (LEA) 123 [Burn]
3x Mountain (ZEN) 242 [Lands]
Shock
```

Example input 2 (just put the card names in)
```
Blood Artist
Bastion of Remembrace
Norin the Wary
```

## Input Format Details

The application supports two input formats:

### Simple Format
- One card per line
- Just the card name
- Will be placed in "Uncategorized" category
- Example: `Lightning Bolt`

### Detailed Format
- Format: `{quantity}x {card name} ({set}) {collector number} [{category}]`
- Example: `2x Lightning Bolt (LEA) 123 [Burn]`
- All components must be present for detailed format parsing

## API Rate Limiting

The application implements rate limiting to comply with Scryfall API guidelines:
- 100ms delay between requests
- Built-in request caching (24-hour TTL)
- Failed request handling with error reporting

## Dependencies

- Express.js - Web application framework
- Axios - HTTP client for API requests
- EJS - Templating engine
- node-cache - Caching solution
- body-parser - Request body parsing middleware


## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details. (AKA do whatever you want man this is a 5 minute side project)

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## Acknowledgments

- [Scryfall API](https://scryfall.com/docs/api) for providing card data
- Magic: The Gathering is a trademark of Wizards of the Coast LLC