const axios = require('axios');
const { getWallet } = require('./generate-register');

const domain = 'indonesia.gaia.domains'
const url = `https://${domain}/v1/chat/completions`;

const initialPrompt = 'give me random question chat to AI Agent, context: crypto & blockchain'

// Function to handle regular API responses (non-streaming)
function fetchChatResponse(apiKey, prompt, retries = 20) {
    return new Promise(async (resolve, reject) => {
        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                const data = {
                    messages: [
                        { role: 'system', content: 'You are a helpful assistant. reply minimum 700 characters' },
                        { role: 'user', content: prompt }
                    ]
                };

                const response = await axios.post(url, data, {
                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        'Accept': 'application/json',
                        'Content-Type': 'application/json'
                    },
                    timeout: 600000
                });

                if (response.status === 200) {
                    try {
                        const reply = response.data.choices[0].message;
                        const usage = response.data.usage;
                        
                        // Only log the usage information
                        console.log(`✨ Assistant usage: ${usage.total_tokens} tokens`);
                        
                        return resolve(reply.content || "");
                    } catch (e) {
                        console.error(`Response parsing failed: ${e.message}`);
                        if (attempt === retries) {
                            return resolve("");
                        }
                    }
                } else if (response.status == 402) {
                    console.error('Insufficient gaiaCredits Balance');
                    return resolve("");
                }
            } catch (error) {
                console.error(`Attempt ${attempt} failed: ${error.message}`);
                if (attempt === retries) {
                    return resolve("");
                }
            }
        }
        console.error('All retry attempts failed.');
        return resolve("");
    });
}

function humanReply(apiKey, prompt, retries = 20) {
    return new Promise(async (resolve, reject) => {
        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                const data = {
                    messages: [
                        { role: 'system', content: 'You are human, always asking to discuss something. always use english' },
                        { role: 'user', content: prompt }
                    ]
                };

                const response = await axios.post(url, data, {
                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        'Accept': 'application/json',
                        'Content-Type': 'application/json'
                    },
                    timeout: 600000
                });

                if (response.status === 200) {
                    try {
                        const reply = response.data.choices[0].message;
                        const usage = response.data.usage;
                        
                        // Only log the usage information
                        console.log(`🥸 Human usage: ${usage.total_tokens} tokens`);
                        
                        return resolve(reply.content || "");
                    } catch (e) {
                        console.error(`Response parsing failed: ${e.message}`);
                        if (attempt === retries) {
                            return resolve("");
                        }
                    }
                } else if (response.status == 402) {
                    console.error('Insufficient gaiaCredits Balance');
                    return resolve("");
                }
            } catch (error) {
                console.error(`Attempt ${attempt} failed: ${error.message}`);
                if (attempt === retries) {
                    return resolve("");
                }
            }
        }
        console.error('All retry attempts failed.');
        return resolve("");
    });
}

let maxJumlahChat = 100;

const execute = async () => {
    let jumlahChat = 0;

    const asking = async (apiKey, prompt) => {
        // Remove conversation counter log to make output cleaner
        
        // Ensure we have a valid prompt
        const validPrompt = prompt || initialPrompt;
        
        try {
            // Get human reply with improved error handling
            let getAsk = await humanReply(apiKey, validPrompt);
            
            jumlahChat++;
            
            // If we got a non-empty response, proceed with assistant response
            if (getAsk && getAsk.length > 0) {
                let answer = await fetchChatResponse(apiKey, getAsk);
                jumlahChat++;
                
                // If we have a valid answer, continue the conversation
                if (answer && answer.length > 0) {
                    if (jumlahChat < maxJumlahChat) {
                        // Add a small delay between conversations
                        await new Promise(resolve => setTimeout(resolve, 5000));
                        return asking(apiKey, answer);
                    } else {
                        console.log("--- Max chat limit reached, restarting ---");
                        jumlahChat = 0; // Reset counter
                        return execute();
                    }
                } else {
                    console.log("Empty response from assistant, trying again...");
                    return asking(apiKey, initialPrompt); // Restart with initial prompt
                }
            } else {
                console.log("Empty response from human, trying again...");
                return asking(apiKey, initialPrompt); // Restart with initial prompt
            }
        } catch (e) {
            console.error(`Error: ${e.message}`);
            // Don't stop - just continue with a new conversation
            return asking(apiKey, initialPrompt);
        }
    }

    try {
        let key = await getWallet().catch(e => {
            console.error("Error getting wallet:", e.message);
            return null;
        });
        
        if (key && key.apiKey) {
            return asking(key.apiKey);
        } else {
            console.log("No valid API key, waiting 10 seconds before retrying...");
            await new Promise(resolve => setTimeout(resolve, 10000));
            return execute();
        }
    } catch (err) {
        console.error("Critical error in execute function:", err.message);
        console.log("Waiting 30 seconds before restarting...");
        await new Promise(resolve => setTimeout(resolve, 30000));
        return execute(); // Always keep the program running
    }
}

// Catch unhandled promise rejections to prevent process crash
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', reason);
    // No need to exit process - let it continue
});

execute();
