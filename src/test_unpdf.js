const { getDocumentProxy, extractImages } = require('unpdf');
const fs = require('fs');

async function test() {
    try {
        console.log("Testing unpdf extractImages...");
        // We don't have a PDF file here, so this is just a syntax check / module load check
        console.log("Modules loaded successfully.");
    } catch (e) {
        console.error("Error:", e);
    }
}

test();
