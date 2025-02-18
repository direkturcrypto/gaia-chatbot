const axios = require('axios');

const domain = 'indonesia.gaia.domains' // change your domain if you have domain & joined nodes
const url = `https://${domain}/v1/chat/completions`;

const initialPrompt = 'give me random question chat to AI Agent, context: crypto & blockchain'

function fetchChatResponse(apiKey, prompt, retries = 20) {
    return new Promise(async (resolve, reject) => {
        for (let attempt = 1; attempt <= retries; attempt++) {
          try {
            console.log(`🥸 bot > ${prompt}`)
            const data = {
              messages: [
                { role: 'system', content: 'You are a helpful assistant. reply minimum 700 characters' },
                { role: 'user', content: prompt}
              ]
            };
      
            const response = await axios.post(url, data, {
              headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Accept': 'application/json',
                'Content-Type': 'application/json'
              },
              timeout: 30000
            });
            
            if (response.status === 200) {
              try {
                  const reply = response.data.choices[0].message
                  const usage = response.data.usage
                  // console.log(`✨ gaia > ${reply.content}`)
                  console.log(`✅ usage`, usage.total_tokens, 'tokens')

                  return resolve(reply.content);
              } catch (e) {
                  console.error(`response failed: ${e.message}`)
                  return resolve(null);
              }
            }
          } catch (error) {
            console.error(`Attempt ${attempt} failed`);
          }
        }
        console.error('All retry attempts failed.');
        return resolve(null);
    })
}

const keys = [
    "gaia-xxxxx",
    "gaia-xxxxx",
    "gaia-xxxxx"
]

const execute = async () => {
    for (let i=0; i<keys.length; i++) {
        const apiKey = keys[i]
        let getAsk = await fetchChatResponse(apiKey, initialPrompt);
        if (getAsk) {
            await fetchChatResponse(apiKey, getAsk);
        }
    }
    return execute()
}

execute()
