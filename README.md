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
   - Detailed format: `2x Card Name (SET) 123 [Category]` (compatible with Archidekt exports)

### Simple Format Example

Input:
![Simple Format Input](Simple%20In.png)

Output:
![Simple Format Output](Simple%20Out.png)

### Detailed Format Example

Input:
![Detailed Format Input](Detailed%20In.png)

Output:
![Detailed Format Output](Detailed%20Out.png)

## Input Format Details

The application supports two input formats:

### Simple Format
- One card per line
- Just the card name
- Will be placed in "Uncategorized" category
- Example: `Lightning Bolt`
- Automatically looks up the latest printing

### Detailed Format (default Archidekt export format)
- Format: `{quantity}x {card name} ({set}) {collector number} [{category}]`
- Example: `2x Lightning Bolt (LEA) 123 [Burn]`
- All components must be present for detailed format parsing
- Compatible with Archidekt exports

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

## Development Tools

### Code Aggregator
The repository includes `aggregate-code.js`, a handy utility for bundling up the project's source files into a single document. It's particularly useful for:
- Getting a quick overview of the entire codebase
- Preparing code for documentation or review
- Creating shareable snapshots of your project

Usage:
```javascript
node aggregate-code.js
```

The script will:
- Generate an `aggregated_code.txt` file
- Skip common directories like `node_modules` and `.git`
- Format files with clear separators and headers
- Exclude configuration and build files

You can customize what gets included/excluded by modifying the exclude arrays in the script.

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