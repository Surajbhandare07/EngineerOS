const Groq = require('groq-sdk');
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || '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' });

async function testGroq() {
    try {
        console.log("Testing Groq Vision API...");
        const response = await groq.chat.completions.create({
            model: "meta-llama/llama-4-scout-17b-16e-instruct",
            messages: [
                {
                    role: "user",
                    content: [
                        { type: "text", text: "What is in this image?" },
                        { type: "image_url", image_url: { url: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==" } }
                    ]
                }
            ]
        });
        console.log("Groq response:", response.choices[0].message.content);
    } catch (e) {
        console.error("Groq failed:", e.message);
    }
}

testGroq();
