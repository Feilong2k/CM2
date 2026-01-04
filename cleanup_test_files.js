const fs = require('fs');
const path = require('path');

const filesToCleanup = [
  'test_append.txt',
  'test_new_file.txt',
  'test_writeplantool_append.js',
  'cleanup_test_files.js'
];

filesToCleanup.forEach(file => {
  try {
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
      console.log(`✅ Cleaned up: ${file}`);
    }
  } catch (error) {
    console.log(`⚠️ Could not clean up ${file}: ${error.message}`);
  }
});

console.log('\n🎯 Cleanup complete!');