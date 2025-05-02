const axios = require('axios');
const { getWallet } = require('./generate-register');

const domain = 'indonesia.gaia.domains'
const url = `https://${domain}/v1/chat/completions`;

const initialPrompt = 'You are having a conversation about blockchain and cryptocurrency. Start with an interesting question or observation.'

const MAX_CONVERSATIONS = 30;

async function fetchChatResponse(apiKey, prompt, role = 'assistant', conversationHistory = [], retryCount = 0) {
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 5000; // 5 seconds delay between retries

    return new Promise(async (resolve, reject) => {
        try {
            const messages = [
                { 
                    role: 'system', 
                    content: role === 'human' ? 
                        'You are a curious human discussing blockchain and crypto. Express thoughts naturally, show emotions, and sometimes be skeptical. Use English.' :
                        'You are a knowledgeable AI assistant discussing blockchain and crypto. Use <thinking>your analysis</thinking> format before responding.' 
                },
                ...conversationHistory,
                { role: 'user', content: prompt }
            ];

            const data = {
                messages,
                stream: false // Explicitly set to false
            };

            // Simulate thinking process
            if (role === 'assistant') {
                const thinking = await generateThinking(prompt);
                console.log(`🤔 ${role} thinking: ${thinking}`);
            }

            const response = await axios.post(url, data, {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                timeout: 60000
            });

            if (response.status === 200 && response.data) {
                if (response.data.choices && response.data.choices.length > 0) {
                    const reply = response.data.choices[0].message;
                    const usage = response.data.usage || { total_tokens: 'unknown' };
                    
                    const emoji = role === 'human' ? '🥸' : '✨';
                    console.log(`${emoji} ${role.charAt(0).toUpperCase() + role.slice(1)} usage: ${usage.total_tokens} tokens`);
                    
                    return resolve(reply.content || "");
                } else {
                    console.error('Unexpected response structure');
                    return resolve("");
                }
            } else if (response.status === 402) {
                console.error('Insufficient gaiaCredits Balance');
                // Return a special signal for insufficient credits
                return resolve({ insufficientCredits: true });
            } else {
                console.error('Unexpected response status:', response.status);
                if (retryCount < MAX_RETRIES) {
                    console.log(`Retrying... (${retryCount + 1}/${MAX_RETRIES})`);
                    await new Promise(r => setTimeout(r, RETRY_DELAY));
                    return resolve(fetchChatResponse(apiKey, prompt, role, conversationHistory, retryCount + 1));
                }
                return resolve("");
            }
        } catch (error) {
            console.error('Request error:', error.message);
            
            // Check if it's a 402 status code (insufficient credits)
            if (error.response?.status === 402) {
                console.error('Insufficient gaiaCredits Balance');
                // Return a special signal for insufficient credits
                return resolve({ insufficientCredits: true });
            }

            // Retry for other errors
            if (retryCount < MAX_RETRIES) {
                console.log(`Retrying... (${retryCount + 1}/${MAX_RETRIES})`);
                await new Promise(r => setTimeout(r, RETRY_DELAY));
                return resolve(fetchChatResponse(apiKey, prompt, role, conversationHistory, retryCount + 1));
            } else {
                console.error('Max retries reached, giving up');
                return resolve("");
            }
        }
    });
}

async function generateThinking(prompt) {
    const thoughts = [
        'Analyzing context',
        'Considering perspectives',
        'Evaluating technical aspects',
        'Reviewing trends',
        'Connecting concepts'
    ];
    
    // Simulate thinking delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    return thoughts[Math.floor(Math.random() * thoughts.length)];
}

async function conversation(apiKey, prompt, existingHistory = [], existingCount = 0) {
    let conversationCount = existingCount;
    let conversationHistory = [...existingHistory];

    const continueConversation = async (prompt) => {
        if (conversationCount >= MAX_CONVERSATIONS) {
            console.log("\n--- Max conversation limit reached, restarting ---");
            conversationCount = 0;
            conversationHistory = [];
            return conversation(apiKey, initialPrompt);
        }

        // Human AI Turn
        const humanResponse = await fetchChatResponse(apiKey, prompt, 'human', conversationHistory);
        
        // Check for insufficient credits signal
        if (humanResponse && typeof humanResponse === 'object' && humanResponse.insufficientCredits) {
            console.log("⚠️ Insufficient credits - Getting new API key while preserving conversation...");
            // Get a new key and continue with the same history
            return execute(conversationHistory, conversationCount, prompt);
        }
        
        if (!humanResponse) {
            console.log("Empty response from human AI, retrying...");
            return continueConversation(initialPrompt);
        }
        
        // Don't log the full response
        conversationHistory.push({ role: 'assistant', content: humanResponse });
        conversationCount++;

        // Add delay to make it more natural
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Assistant AI Turn
        const assistantResponse = await fetchChatResponse(apiKey, humanResponse, 'assistant', conversationHistory);
        
        // Check for insufficient credits signal
        if (assistantResponse && typeof assistantResponse === 'object' && assistantResponse.insufficientCredits) {
            console.log("⚠️ Insufficient credits - Getting new API key while preserving conversation...");
            // Get a new key and continue with the same history and last human response
            return execute(conversationHistory, conversationCount, humanResponse);
        }
        
        if (!assistantResponse) {
            console.log("Empty response from assistant AI, retrying...");
            return continueConversation(humanResponse);
        }
        
        // Don't log the full response
        conversationHistory.push({ role: 'assistant', content: assistantResponse });
        conversationCount++;

        // Add natural pause between conversations
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Continue the conversation
        return continueConversation(assistantResponse);
    };

    return continueConversation(prompt);
}

const execute = async (previousHistory = [], previousCount = 0, lastPrompt = initialPrompt) => {
    try {
        let key = await getWallet().catch(e => {
            console.error("Error getting wallet:", e.message);
            return null;
        });
        
        if (key && key.apiKey) {
            if (previousHistory.length > 0) {
                console.log(`🔄 Continuing conversation with new API key (${previousCount} exchanges so far)...`);
            } else {
                console.log("🤖 Starting AI conversation...");
            }
            return conversation(key.apiKey, lastPrompt, previousHistory, previousCount);
        } else {
            console.log("No valid API key, waiting 10 seconds before retrying...");
            await new Promise(resolve => setTimeout(resolve, 10000));
            return execute(previousHistory, previousCount, lastPrompt);
        }
    } catch (err) {
        console.error("Critical error in execute function:", err.message);
        console.log("Waiting 30 seconds before restarting...");
        await new Promise(resolve => setTimeout(resolve, 30000));
        return execute(previousHistory, previousCount, lastPrompt);
    }
}

// Catch unhandled promise rejections to prevent process crash
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', reason);
});

execute();
