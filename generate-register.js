const axios = require('axios');
const fs = require('fs');
const { ethers } = require('ethers');

const apiUrl = 'https://api.gaianet.ai/api/v1/users';

async function signMessage(wallet) {
  const message = {
    wallet_address: wallet.address,
    timestamp: Math.floor(Date.now() / 1000)
  };
  const signature = await wallet.signMessage(JSON.stringify(message));
  return { signature, message };
}

// Fungsi untuk menghasilkan random IPv4
function getRandomIPv4() {
    return Array(4).fill(0).map(() => Math.floor(Math.random() * 256)).join('.');
}

async function login(wallet) {
  const { signature, message } = await signMessage(wallet);
  const response = await axios.post(`${apiUrl}/connect-wallet/`, { signature, message }, {
    headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': getRandomIPv4() }
  });
  return response.data.data.access_token;
}

async function listApiKeys(token) {
  const response = await axios.get(`${apiUrl}/apikey/list/`, {
    headers: { 'Authorization': token, 'X-Forwarded-For': getRandomIPv4() }
  });
  return response.data.data.objects;
}

async function removeApiKey(token, id) {
  const response = await axios.post(`${apiUrl}/apikey/delete/`, { id }, {
    headers: { 'Authorization': token, 'Content-Type': 'application/json', 'X-Forwarded-For': getRandomIPv4() }
  });
  return response.data.message;
}

async function overview(token) {
  const response = await axios.get(`${apiUrl}/apikey/list/`, {
    headers: { 'Authorization': token, 'X-Forwarded-For': getRandomIPv4() }
  }).catch((e) => ({status: 500, data: null}));

  return response.data?response.data.data:null;
}

async function createApiKey(token) {
  const response = await axios.post(`${apiUrl}/apikey/create/`, { name: 'key1' }, {
    headers: { 'Authorization': token, 'Content-Type': 'application/json', 'X-Forwarded-For': getRandomIPv4() }
  });
  return response.data.data.api_key;
}

function sleep(time) {
    return new Promise((resolve, reject) => {
        setTimeout(resolve, time)
    })
}

async function processWallets(wallets) {
  const results = [];
  for (const wallet of wallets) {
    const token = await login(wallet);
    let apiKeys = await listApiKeys(token);
    if (apiKeys.length === 0) {
      const newApiKey = await createApiKey(token);
      results.push({ wallet: wallet.address, api_key: newApiKey });
      console.log(`API keys saved for ${wallet.address}`)
      fs.writeFileSync('api_keys.json', JSON.stringify(results, null, 2));
    } else {
        // console.log(`delete keys ${wallet.address}`)
        // for (const api of apiKeys) {
        //     await removeApiKey(token, api.id)
        // }
    }

    await sleep(5000)
  }
  console.log('API keys saved to api_keys.json');
}

const generateWallet = () => {
    return new Promise(async (resolve, reject) => {
        try {
            const wallet = ethers.Wallet.createRandom()
            console.log(`logged in wallet ${wallet.address}`)
            const token = await login(wallet);
            const apiKey = await createApiKey(token);
            console.log(`apikey: ${apiKey}`)
            return resolve({wallet: {address: wallet.address, privateKey: wallet.privateKey}, apiKey: apiKey})
        } catch (e) {
            return reject(`failed generate wallet`, e)
        }
    })
}
exports.getWallet = generateWallet;
