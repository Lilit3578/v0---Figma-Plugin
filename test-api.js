// Quick API test script to diagnose quota issues
// Run with: node test-api.js

const API_KEY = process.env.GEMINI_API_KEY || 'your-api-key-here';
const MODEL_NAME = 'gemini-2.5-flash'; // Latest stable model (June 2025)

async function testAPI() {
    console.log('🔍 Testing Gemini API connection...\n');
    console.log(`API Key: ${API_KEY.substring(0, 10)}...${API_KEY.substring(API_KEY.length - 4)}`);
    console.log(`Model: ${MODEL_NAME}\n`);

    const url = `https://generativelanguage.googleapis.com/v1/models/${MODEL_NAME}:generateContent?key=${API_KEY}`;

    const payload = {
        contents: [{
            parts: [{
                text: 'Say "Hello" in JSON format: {"message": "Hello"}'
            }]
        }],
        generationConfig: {
            temperature: 0.6,
            maxOutputTokens: 100
        }
    };

    try {
        console.log('📡 Sending request to Gemini API...\n');
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        });

        console.log(`Status: ${response.status} ${response.statusText}\n`);

        const data = await response.json();

        if (!response.ok) {
            console.error('❌ API Error:');
            console.error(JSON.stringify(data, null, 2));

            // Diagnose common issues
            if (response.status === 429) {
                console.error('\n⚠️  DIAGNOSIS: Rate limit exceeded');
                console.error('Possible causes:');
                console.error('1. Too many requests in short time');
                console.error('2. New accounts may have stricter limits');
                console.error('3. API key might be shared/compromised');
            } else if (response.status === 403) {
                console.error('\n⚠️  DIAGNOSIS: API key invalid or no access');
                console.error('Possible causes:');
                console.error('1. API key not enabled for Gemini API');
                console.error('2. Billing not set up (if required)');
                console.error('3. API restrictions preventing access');
            } else if (response.status === 404) {
                console.error('\n⚠️  DIAGNOSIS: Model not found');
                console.error(`Model "${MODEL_NAME}" may not be available`);
                console.error('Try: gemini-1.5-flash or gemini-1.5-pro');
            }
            return;
        }

        console.log('✅ Success! API is working correctly.\n');
        console.log('Response:');
        console.log(JSON.stringify(data, null, 2));

    } catch (error) {
        console.error('❌ Network Error:', error.message);
        console.error('\nPossible causes:');
        console.error('1. No internet connection');
        console.error('2. Firewall blocking requests');
        console.error('3. Invalid API endpoint');
    }
}

// Check if API key is set
if (!API_KEY || API_KEY === 'your-api-key-here' || API_KEY === 'your-new-api-key-here') {
    console.error('❌ Error: No API key found!');
    console.error('\nPlease either:');
    console.error('1. Set GEMINI_API_KEY environment variable');
    console.error('2. Edit this file and replace "your-api-key-here" with your actual key');
    process.exit(1);
}

testAPI();
