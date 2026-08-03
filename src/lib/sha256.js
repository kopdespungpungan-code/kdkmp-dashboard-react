// SHA-256 pure JS (port dari versi vanilla)
const K = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
  0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
  0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
  0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
  0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
  0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
  0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
  0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
const rrot = (x, n) => (x >>> n) | (x << (32 - n));

export function sha256(msg) {
  const H = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
  const l = msg.length;
  const n = l + 8;
  const m = ((n >> 6) + 1) << 6;
  const a = new Uint8Array(m);
  for (let i = 0; i < l; i++) a[i] = msg.charCodeAt(i) & 0xff;
  a[l] = 0x80;
  const bitsLo = (l << 3) >>> 0, bitsHi = Math.floor(l / 0x20000000);
  a[m-8] = (bitsHi >>> 24) & 255; a[m-7] = (bitsHi >>> 16) & 255;
  a[m-6] = (bitsHi >>> 8) & 255;  a[m-5] = bitsHi & 255;
  a[m-4] = (bitsLo >>> 24) & 255; a[m-3] = (bitsLo >>> 16) & 255;
  a[m-2] = (bitsLo >>> 8) & 255;  a[m-1] = bitsLo & 255;
  const w = new Array(64);
  for (let i = 0; i < m; i += 64) {
    for (let j = 0; j < 16; j++)
      w[j] = ((a[i+j*4]<<24)|(a[i+j*4+1]<<16)|(a[i+j*4+2]<<8)|(a[i+j*4+3])) >>> 0;
    for (let j = 16; j < 64; j++) {
      const s0 = rrot(w[j-15],7) ^ rrot(w[j-15],18) ^ (w[j-15]>>>3);
      const s1 = rrot(w[j-2],17) ^ rrot(w[j-2],19) ^ (w[j-2]>>>10);
      w[j] = (w[j-16] + s0 + w[j-7] + s1) >>> 0;
    }
    let ah=H[0],bh=H[1],ch=H[2],dh=H[3],eh=H[4],fh=H[5],gh=H[6],hh=H[7];
    for (let j = 0; j < 64; j++) {
      const S1 = rrot(eh,6) ^ rrot(eh,11) ^ rrot(eh,25);
      const ch2 = (eh & fh) ^ (~eh & gh);
      const t1 = (hh + S1 + ch2 + K[j] + w[j]) >>> 0;
      const S0 = rrot(ah,2) ^ rrot(ah,13) ^ rrot(ah,22);
      const maj = (ah & bh) ^ (ah & ch) ^ (bh & ch);
      const t2 = (S0 + maj) >>> 0;
      hh=gh; gh=fh; fh=eh; eh=(dh+t1)>>>0; dh=ch; ch=bh; bh=ah; ah=(t1+t2)>>>0;
    }
    H[0]=(H[0]+ah)>>>0; H[1]=(H[1]+bh)>>>0; H[2]=(H[2]+ch)>>>0; H[3]=(H[3]+dh)>>>0;
    H[4]=(H[4]+eh)>>>0; H[5]=(H[5]+fh)>>>0; H[6]=(H[6]+gh)>>>0; H[7]=(H[7]+hh)>>>0;
  }
  let out = "";
  for (let i = 0; i < 8; i++)
    for (let j = 28; j >= 0; j -= 4) out += ((H[i] >>> j) & 15).toString(16);
  return out;
}
