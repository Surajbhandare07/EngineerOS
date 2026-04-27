try {
    const { createCanvas } = require('@napi-rs/canvas');
    const canvas = createCanvas(100, 100);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'red';
    ctx.fillRect(0, 0, 50, 50);
    console.log("Canvas created successfully. Data URL length:", canvas.toDataURL().length);
} catch (e) {
    console.error("Canvas failed:", e.message);
}
