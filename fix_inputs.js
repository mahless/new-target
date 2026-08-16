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
  // We only want to replace e.target.value inside onChange handlers or similar,
  // but replacing it everywhere it's used as a string is generally safe.
  // Let's replace e.target.value when it's passed to a setter like setSomething(e.target.value)
  // regex: set[A-Za-z0-9_]+\(\s*e\.target\.value\s*\)
  
  // Wait, what if it's setSomething(Number(e.target.value)) ?
  // Let's just replace `e.target.value` with `(e.target.value.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString()))`
  // But ONLY where it's part of an onChange handler or similar, to avoid replacing types or other unrelated things.
  // Actually `e.target.value` is very specific to event handlers.
  
  if (content.includes('e.target.value')) {
    // Only replace if it doesn't already have the replace
    if (!content.includes('٠١٢٣٤٥٦٧٨٩')) {
      content = content.replace(/e\.target\.value/g, "e.target.value.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString())");
      fs.writeFileSync(file, content);
      console.log('Fixed', file);
    }
  }
});
