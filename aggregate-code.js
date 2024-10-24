const fs = require('fs');
const path = require('path');

function aggregateFiles(rootDir, outputFile, excludeDirs = [], excludeFiles = []) {
  const outStream = fs.createWriteStream(outputFile);

  function traverseDirectory(currentDir) {
    try {
      fs.readdirSync(currentDir).forEach(item => {
        const itemPath = path.join(currentDir, item);
        try {
          const stat = fs.statSync(itemPath);

          if (stat.isDirectory()) {
            if (!excludeDirs.includes(item)) {
              traverseDirectory(itemPath);
            }
          } else if (stat.isFile()) {
            if (!excludeFiles.includes(item)) {
              const content = fs.readFileSync(itemPath, 'utf-8');
              outStream.write(`<file_start>\n`);
              outStream.write(`File: ${itemPath}\n`);
              outStream.write(content);
              outStream.write(`\n<file_end>\n\n`);
            }
          }
        } catch (err) {
          if (err.code === 'EPERM') {
            console.warn(`Skipping inaccessible path: ${itemPath}`);
          } else {
            throw err;
          }
        }
      });
    } catch (err) {
      if (err.code === 'EPERM') {
        console.warn(`Skipping inaccessible directory: ${currentDir}`);
      } else {
        throw err;
      }
    }
  }

  traverseDirectory(rootDir);
  outStream.end();
}

// Example usage
const rootDirectory = __dirname;
const outputFile = 'aggregated_code.txt';
const excludeDirectories = ['.git', 'node_modules'];
const excludeFiles = ['.gitignore', 'README.md', 'aggregated_code.txt', 'aggregate-code.js', 'package-lock.json', 'readme.md', '.env', 'API spec.yaml'];

aggregateFiles(rootDirectory, outputFile, excludeDirectories, excludeFiles);