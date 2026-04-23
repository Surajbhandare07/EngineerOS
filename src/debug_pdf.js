const PDFParser = require('pdf2json');
console.log("PDFParser type:", typeof PDFParser);
const parser = new PDFParser(null, 1);
console.log("Parser instance methods:", Object.keys(parser).filter(k => typeof parser[k] === 'function'));
console.log("Prototype methods:", Object.getOwnPropertyNames(Object.getPrototypeOf(parser)));
