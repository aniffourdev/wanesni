import crypto from 'crypto';
import { NextResponse } from 'next/server';

// Your ZegoCloud credentials - VERIFY these are correct
const APP_ID = 1043089575; 
const SERVER_SECRET = 'de73ca1d2ccf7ac08c56ddb810ae8c3b';

console.log('ZegoCloud APP_ID:', APP_ID);
console.log('ZegoCloud SERVER_SECRET length:', SERVER_SECRET.length);

function generateToken(appId, userId, serverSecret, effectiveTimeInSeconds, payload = {}) {
  const now = Math.floor(Date.now() / 1000);
  const expire = now + effectiveTimeInSeconds;
  const nonce = Math.floor(Math.random() * 2147483647);
  
  // Create payload string
  const payloadStr = JSON.stringify(payload);
  const base64Payload = Buffer.from(payloadStr).toString('base64');
  
  // Create signature string in correct order
  const stringToSign = `${appId}${userId}${serverSecret}${expire}${nonce}${base64Payload}`;
  
  // Generate HMAC SHA256 hash
  const hash = crypto.createHmac('sha256', serverSecret).update(stringToSign, 'utf8').digest('hex');
  
  // Return token in correct format
  const token = `04${Buffer.from(JSON.stringify({
    'iss': 'zego',
    'exp': expire
  })).toString('base64')}.${hash}.${base64Payload}`;
  
  console.log('Token components:', {
    appId,
    userId,
    expire,
    nonce,
    payloadStr,
    stringToSign: stringToSign.substring(0, 50) + '...',
    hash: hash.substring(0, 10) + '...'
  });
  
  return token;
}

export async function POST(request) {
  try {
    // Check for obviously missing credentials
    if (!APP_ID || !SERVER_SECRET || SERVER_SECRET.length < 10) {
      return NextResponse.json({ 
        error: 'ZegoCloud credentials are missing or invalid. Please update APP_ID and SERVER_SECRET in app/api/zego-tokens/route.js.' 
      }, { status: 500 });
    }

    const body = await request.json();
    const { roomID, userID, userName } = body;

    if (!roomID || !userID || !userName) {
      return NextResponse.json({ 
        error: 'Missing parameters: roomID, userID, and userName are required' 
      }, { status: 400 });
    }

    console.log('Generating token for:', { roomID, userID, userName });

    const token = generateToken(APP_ID, userID, SERVER_SECRET, 3600, { 
      room_id: roomID, 
      user_name: userName,
      privilege: {
        1: 1, // Login room privilege
        2: 1  // Publish stream privilege
      }
    });
    
    console.log('Generated token successfully for user:', userName);
    
    return NextResponse.json({ 
      success: true,
      token: token,
      roomID: roomID,
      userID: userID,
      userName: userName,
      appID: APP_ID
    });

  } catch (error) {
    console.error('Token generation error:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Token generation failed', 
      details: error instanceof Error ? error.message : error 
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ 
    message: 'This endpoint only accepts POST requests',
    usage: 'POST /api/zego-tokens with { roomID, userID, userName }',
    appID: APP_ID,
    serverConfigured: !!SERVER_SECRET
  }, { status: 405 });
}