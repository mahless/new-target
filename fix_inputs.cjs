const fs = require('fs');
const path = require('path');

function walkSync(dir, filelist = []) {
  fs.readdirSync(dir).forEach(file => {
    const dirFile = path.join(dir, file);
    if (fs.statSync(dirFile).isDirectory()) {
      filelist = walkSync(dirFile, filelist);
    } else if (dirFile.endsWith('.tsx') || dirFile.endsWith('.ts')) {
      filelist.push(dirFile);
    }
  });
  return filelist;
}

const files = walkSync('./src');
files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  if (content.includes('e.target.value')) {
    if (!content.includes('٠١٢٣٤٥٦٧٨٩')) {
      content = content.replace(/e\.target\.value/g, "e.target.value.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString())");
      fs.writeFileSync(file, content);
      console.log('Fixed', file);
    }
  }
});
