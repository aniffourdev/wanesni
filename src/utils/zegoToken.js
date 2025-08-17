// utils/zegoToken.js
import CryptoJS from 'crypto-js';

const APP_ID = 1159221767;
const SERVER_SECRET = '37700a46dc241b55081a9f53e43043fe';

export function generateZegoToken(userID, effectiveTimeInSeconds = 3600) {
  try {
    const now = Math.floor(Date.now() / 1000);
    const expire = now + effectiveTimeInSeconds;
    const nonce = Math.floor(Math.random() * 2147483647);
    
    // Create payload
    const payload = {
      "iss": "zego",
      "exp": expire
    };
    
    // Encode payload
    const payloadBase64 = btoa(JSON.stringify(payload));
    
    // Create signature content
    const content = `${APP_ID}${userID}${SERVER_SECRET}${expire}${nonce}${payloadBase64}`;
    
    // Generate signature using HMAC-SHA256
    const hash = CryptoJS.HmacSHA256(content, SERVER_SECRET).toString();
    
    // Construct final token
    const token = `${APP_ID}:${userID}:${expire}:${nonce}:${hash}:${payloadBase64}`;
    
    return token;
  } catch (error) {
    console.error('Token generation failed:', error);
    return '';
  }
}

// Alternative: Use ZegoCloud's built-in token generator (requires different import)
export function generateTestToken(roomID, userID) {
  try {
    // This would work with ZegoUIKitPrebuilt but we're using ExpressEngine
    // Keep as fallback option
    return '';
  } catch (error) {
    return '';
  }
}