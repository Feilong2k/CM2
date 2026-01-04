// Clean up debug files
const fs = require('fs');
const path = require('path');

const filesToDelete = [
  'debug_190.js',
  'check_length.js',
  'cleanup.js'
];

filesToDelete.forEach(file => {
  try {
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
      console.log(`Deleted: ${file}`);
    }
  } catch (error) {
    console.error(`Error deleting ${file}:`, error.message);
  }
});