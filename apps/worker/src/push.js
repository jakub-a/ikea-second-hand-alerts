const encoder = new TextEncoder();

function base64UrlEncode(bytes) {
  let binary = '';
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlDecode(str) {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(str.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function uint16be(value) {
  return new Uint8Array([(value >> 8) & 0xff, value & 0xff]);
}

function concatBytes(...arrays) {
  const total = arrays.reduce((sum, arr) => sum + arr.length, 0);
  const output = new Uint8Array(total);
  let offset = 0;
  arrays.forEach((arr) => {
    output.set(arr, offset);
    offset += arr.length;
  });
  return output;
}

async function hkdf(salt, ikm, info, length) {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt,
      info
    },
    key,
    length * 8
  );
  return new Uint8Array(bits);
}

async function encryptPayload(subscription, payload) {
  const clientPublicKey = base64UrlDecode(subscription.keys.p256dh);
  const authSecret = base64UrlDecode(subscription.keys.auth);

  const serverKeyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits']
  );
  const serverPublicKeyRaw = new Uint8Array(await crypto.subtle.exportKey('raw', serverKeyPair.publicKey));

  const clientPublicKeyCrypto = await crypto.subtle.importKey(
    'raw',
    clientPublicKey,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []
  );

  const sharedSecret = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: 'ECDH', public: clientPublicKeyCrypto },
      serverKeyPair.privateKey,
      256
    )
  );

  const info = concatBytes(encoder.encode('WebPush: info\0'), clientPublicKey, serverPublicKeyRaw);
  const prk = await hkdf(authSecret, sharedSecret, info, 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));

  const context = concatBytes(
    encoder.encode('P-256'),
    new Uint8Array([0x00]),
    uint16be(clientPublicKey.length),
    clientPublicKey,
    uint16be(serverPublicKeyRaw.length),
    serverPublicKeyRaw
  );

  const cekInfo = concatBytes(encoder.encode('Content-Encoding: aes128gcm\0'), context);
  const nonceInfo = concatBytes(encoder.encode('Content-Encoding: nonce\0'), context);

  const contentEncryptionKey = await hkdf(salt, prk, cekInfo, 16);
  const nonce = await hkdf(salt, prk, nonceInfo, 12);

  const cek = await crypto.subtle.importKey('raw', contentEncryptionKey, { name: 'AES-GCM' }, false, ['encrypt']);
  const payloadBytes = encoder.encode(payload);
  const pad = new Uint8Array([0x00, 0x00]);
  const plaintext = concatBytes(pad, payloadBytes);

  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, cek, plaintext)
  );

  return {
    ciphertext,
    salt,
    serverPublicKey: serverPublicKeyRaw
  };
}

async function createVapidJwt(audience, publicKey, privateKey) {
  const header = base64UrlEncode(encoder.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const exp = Math.floor(Date.now() / 1000) + 12 * 60 * 60;
  const payload = base64UrlEncode(
    encoder.encode(JSON.stringify({ aud: audience, exp, sub: 'mailto:alerts@example.com' }))
  );
  const token = `${header}.${payload}`;

  const publicBytes = base64UrlDecode(publicKey);
  const x = base64UrlEncode(publicBytes.slice(1, 33));
  const y = base64UrlEncode(publicBytes.slice(33, 65));
  const jwk = {
    kty: 'EC',
    crv: 'P-256',
    x,
    y,
    d: privateKey
  };

  const key = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    encoder.encode(token)
  );

  const signatureBase64 = base64UrlEncode(new Uint8Array(signature));
  return `${token}.${signatureBase64}`;
}

export async function sendPush(subscription, payload, env) {
  const endpoint = subscription?.endpoint;
  if (!endpoint) throw new Error('Missing subscription endpoint');

  const audience = new URL(endpoint).origin;
  const jwt = await createVapidJwt(audience, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
  let headers = {
    TTL: '60',
    Authorization: `vapid t=${jwt}, k=${env.VAPID_PUBLIC_KEY}`,
    'Crypto-Key': `p256ecdsa=${env.VAPID_PUBLIC_KEY}`
  };
  let body;

  if (payload) {
    const payloadJson = JSON.stringify(payload);
    const encrypted = await encryptPayload(subscription, payloadJson);
    headers = {
      ...headers,
      'Crypto-Key': `dh=${base64UrlEncode(encrypted.serverPublicKey)}; p256ecdsa=${env.VAPID_PUBLIC_KEY}`,
      Encryption: `salt=${base64UrlEncode(encrypted.salt)}; rs=4096`,
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream'
    };
    body = encrypted.ciphertext;
  }

  const res = await fetch(endpoint, {
    method: 'POST',
    headers,
    body
  });

  if (!res.ok) {
    const textBody = await res.text();
    throw new Error(`Push failed: ${res.status} ${textBody}`);
  }

  return { status: res.status };
}
