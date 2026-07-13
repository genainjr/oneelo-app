import { createECDH } from 'node:crypto';

function base64Url(buffer) {
  return Buffer.from(buffer)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

const ecdh = createECDH('prime256v1');
ecdh.generateKeys();

const publicKey = base64Url(ecdh.getPublicKey());
const privateKey = base64Url(ecdh.getPrivateKey());

console.log('WEB_PUSH_PUBLIC_KEY=' + publicKey);
console.log('WEB_PUSH_PRIVATE_KEY=' + privateKey);
console.log('WEB_PUSH_SUBJECT=mailto:suporte@lookuplabs.com.br');
