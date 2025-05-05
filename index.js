const axios = require('axios');
const { getWallet } = require('./generate-register');

const domain = 'indonesia.gaia.domains'
const url = `https://${domain}/v1/chat/completions`;

const initialPrompt = 'You are having a conversation about blockchain and cryptocurrency. Start with an interesting question or observation.'

const MAX_CONVERSATIONS = 30;
const MAX_TOTAL_TOKENS = 2000;

// Fungsi untuk menghasilkan random IPv4
function getRandomIPv4() {
    return Array(4).fill(0).map(() => Math.floor(Math.random() * 256)).join('.');
}

function estimateTokens(str) {
    return Math.ceil((str || '').length / 4);
}

function getTotalTokens(messages) {
    return messages.reduce((sum, msg) => sum + estimateTokens(msg.content), 0);
}

async function fetchChatResponse(apiKey, prompt, role = 'assistant', conversationHistory = [], retryCount = 0) {
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 5000; // 5 seconds delay between retries

    // Batasi conversationHistory hanya 3 pesan terakhir
    if (conversationHistory.length > 3) {
        conversationHistory = conversationHistory.slice(-3);
    }

    // Siapkan pesan sistem
    const systemMsg = {
        role: 'system',
        content: role === 'human'
            ? 'You are a curious human discussing blockchain and crypto. Express thoughts naturally, show emotions, and sometimes be skeptical. Use English.'
            : 'You are a knowledgeable AI assistant discussing blockchain and crypto. Use <thinking>your analysis</thinking> format before responding.'
    };

    // Gabungkan pesan
    let messages = [
        systemMsg,
        ...conversationHistory,
        { role: 'user', content: prompt }
    ];

    // Truncate conversationHistory lebih agresif jika total token melebihi batas 2000
    while (getTotalTokens(messages) > MAX_TOTAL_TOKENS && conversationHistory.length > 0) {
        conversationHistory.shift(); // Hapus pesan terlama
        messages = [
            systemMsg,
            ...conversationHistory,
            { role: 'user', content: prompt }
        ];
    }

    return new Promise(async (resolve, reject) => {
        try {
            const data = {
                messages,
                stream: true, // Aktifkan streaming
                stream_options: {
                    'include_usage': true                    
                }
            };

            // Simulate thinking process
            if (role === 'assistant') {
                const thinking = await generateThinking(prompt);
                console.log(`🤔 ${role} thinking: ${thinking}`);
            }

            const startTime = Date.now();
            const response = await axios.post(url, data, {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    'X-Forwarded-For': getRandomIPv4() // Tambahkan random IP di header
                },
                timeout: 60000,
                responseType: 'stream'
            });

            if (response.status === 429) {
                console.error('Rate limited (429)');
                return resolve({ rateLimited: true });
            }

            let result = '';
            let usage = { total_tokens: 'unknown' };
            let done = false;
            let output = '';

            response.data.on('data', chunk => {
                const str = chunk.toString();
                result += str;
                // Cek jika stream mengandung [DONE]
                if (str.includes('[DONE]')) {
                    done = true;
                }
                // Tampilkan isi stream ke console secara real-time (tanpa newline double)
                const lines = str.split('\n').filter(Boolean);
                for (const line of lines) {
                    // Cek jika line adalah data JSON stream
                    if (line.startsWith('data:')) {
                        const jsonStr = line.replace('data:', '').trim();
                        if (jsonStr === '[DONE]') continue;
                        try {
                            const json = JSON.parse(jsonStr);
                            if (json.choices && json.choices[0] && json.choices[0].delta && json.choices[0].delta.content) {
                                const content = json.choices[0].delta.content;
                                output += content;
                            }
                            if (json.usage) {
                                usage = json.usage;
                            }
                        } catch (e) { /* abaikan */ }
                    }
                }
            });
            response.data.on('end', () => {
                const endTime = Date.now();
                const elapsed = endTime - startTime;
                // Hitung token manual jika usage null
                let totalTokens = usage.total_tokens;
                if (!totalTokens || totalTokens === 'unknown' || totalTokens === null) {
                    totalTokens = Math.ceil(output.length / 4);
                }
                const emoji = role === 'human' ? '🥸' : '✨';
                const roleLabel = role.charAt(0).toUpperCase() + role.slice(1);
                console.log(`\n${emoji} ${roleLabel} usage: ${totalTokens} tokens, ${elapsed}ms`);
                return resolve(output);
            });
            response.data.on('error', err => {
                console.error('Stream error:', err.message);
                return resolve("");
            });
        } catch (error) {
            console.error('Request error:', error.message);
            // Check if it's a 429 status code (rate limit)
            if (error.response?.status === 429) {
                console.error('Rate limited (429)');
                return resolve({ rateLimited: true });
            }
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

// Fungsi untuk menjalankan 10 execute() paralel dan pause 5 menit jika ada rate limit
async function runParallelExecutions(parallelCount = 20) {
    let shouldPause = false;
    let pausePromise = null;

    async function wrappedExecute(...args) {
        while (shouldPause) {
            await pausePromise;
        }
        const result = await execute(...args);
        // Cek jika ada rate limit
        if (result && typeof result === 'object' && result.rateLimited) {
            if (!shouldPause) {
                shouldPause = true;
                console.log('⏸️ Rate limited! Pausing all executions for 5 minutes...');
                pausePromise = new Promise(res => setTimeout(() => {
                    shouldPause = false;
                    pausePromise = null;
                    res();
                }, 5 * 60 * 1000)); // 5 menit
            }
            await pausePromise;
        }
        return result;
    }

    await Promise.all(
        Array(parallelCount).fill(0).map(() => wrappedExecute())
    );
}

// Catch unhandled promise rejections to prevent process crash
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', reason);
});

runParallelExecutions(10);
