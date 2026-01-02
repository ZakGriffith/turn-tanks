const fs = require('fs');
const path = require('path');

const SAMPLE_RATE = 44100;

// Create WAV file buffer
function createWav(samples, sampleRate = SAMPLE_RATE) {
  const numChannels = 1;
  const bitDepth = 16;
  const dataLength = samples.length * (bitDepth / 8);
  const headerLength = 44;
  const totalLength = headerLength + dataLength;
  
  const buffer = Buffer.alloc(totalLength);
  
  // WAV header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(totalLength - 8, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // fmt chunk size
  buffer.writeUInt16LE(1, 20); // PCM format
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * numChannels * (bitDepth / 8), 28);
  buffer.writeUInt16LE(numChannels * (bitDepth / 8), 32);
  buffer.writeUInt16LE(bitDepth, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataLength, 40);
  
  // Audio data
  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const sample = Math.max(-1, Math.min(1, samples[i]));
    const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
    buffer.writeInt16LE(Math.round(intSample), offset);
    offset += 2;
  }
  
  return buffer;
}

// Sound generators - LOUDER versions
const sounds = {
  'tank-move': (sr) => {
    const duration = 0.6;
    const samples = new Float32Array(Math.floor(sr * duration));
    for (let i = 0; i < samples.length; i++) {
      const t = i / sr;
      // Engine rumble with grinding - LOUDER
      const rumble = Math.sin(2 * Math.PI * 35 * t) * 0.6;
      const rumble2 = Math.sin(2 * Math.PI * 55 * t) * 0.4;
      const grind = Math.sin(2 * Math.PI * (80 + Math.sin(t * 20) * 10) * t) * 0.25;
      const noise = (Math.random() - 0.5) * 0.3;
      const envelope = Math.min(1, t * 8) * Math.max(0, 1 - (t / duration) * 0.5);
      samples[i] = (rumble + rumble2 + grind + noise) * envelope * 0.9;
    }
    return samples;
  },
  
  'cannon-fire': (sr) => {
    const duration = 0.5;
    const samples = new Float32Array(Math.floor(sr * duration));
    for (let i = 0; i < samples.length; i++) {
      const t = i / sr;
      // Sharp explosive attack - LOUDER
      const boom = Math.sin(2 * Math.PI * 60 * t) * Math.exp(-t * 10);
      const crack = Math.sin(2 * Math.PI * 200 * t) * Math.exp(-t * 20);
      const noise = (Math.random() - 0.5) * Math.exp(-t * 5);
      const tail = Math.sin(2 * Math.PI * 40 * t) * Math.exp(-t * 3) * 0.5;
      samples[i] = (boom * 0.7 + crack * 0.5 + noise * 0.9 + tail) * 0.95;
    }
    return samples;
  },
  
  'shell-hit': (sr) => {
    const duration = 0.35;
    const samples = new Float32Array(Math.floor(sr * duration));
    for (let i = 0; i < samples.length; i++) {
      const t = i / sr;
      // Metal impact with ring - LOUDER
      const impact = Math.sin(2 * Math.PI * 150 * t) * Math.exp(-t * 15);
      const ring = Math.sin(2 * Math.PI * 600 * t) * Math.exp(-t * 12) * 0.6;
      const ring2 = Math.sin(2 * Math.PI * 900 * t) * Math.exp(-t * 15) * 0.4;
      const noise = (Math.random() - 0.5) * Math.exp(-t * 25);
      samples[i] = (impact * 0.8 + ring + ring2 + noise * 0.6) * 0.95;
    }
    return samples;
  },
  
  'explosion': (sr) => {
    const duration = 1.2;
    const samples = new Float32Array(Math.floor(sr * duration));
    for (let i = 0; i < samples.length; i++) {
      const t = i / sr;
      // Big explosion with rumble - LOUDER
      const boom = Math.sin(2 * Math.PI * 40 * t) * Math.exp(-t * 2);
      const boom2 = Math.sin(2 * Math.PI * 25 * t) * Math.exp(-t * 1.5);
      const crackle = Math.sin(2 * Math.PI * 100 * t) * Math.exp(-t * 6) * 0.5;
      const noise = (Math.random() - 0.5) * Math.exp(-t * 2.5);
      const rumble = Math.sin(2 * Math.PI * 20 * t) * Math.exp(-t * 1.2) * 0.6;
      samples[i] = (boom * 0.5 + boom2 * 0.4 + crackle + noise * 0.8 + rumble) * 0.98;
    }
    return samples;
  },
  
  'turn-start': (sr) => {
    const duration = 0.25;
    const samples = new Float32Array(Math.floor(sr * duration));
    for (let i = 0; i < samples.length; i++) {
      const t = i / sr;
      // Pleasant notification chime - LOUDER
      const freq1 = 880;
      const freq2 = 1100;
      const chime1 = Math.sin(2 * Math.PI * freq1 * t) * Math.exp(-t * 10);
      const chime2 = Math.sin(2 * Math.PI * freq2 * t) * Math.exp(-t * 12) * 0.7;
      const envelope = Math.min(1, t * 50);
      samples[i] = (chime1 + chime2) * envelope * 0.7;
    }
    return samples;
  },
  
  'action-queue': (sr) => {
    const duration = 0.12;
    const samples = new Float32Array(Math.floor(sr * duration));
    for (let i = 0; i < samples.length; i++) {
      const t = i / sr;
      // Quick UI blip - LOUDER
      const blip = Math.sin(2 * Math.PI * 700 * t) * Math.exp(-t * 30);
      const blip2 = Math.sin(2 * Math.PI * 500 * t) * Math.exp(-t * 35) * 0.6;
      samples[i] = (blip + blip2) * 0.8;
    }
    return samples;
  },
  
  'button-click': (sr) => {
    const duration = 0.06;
    const samples = new Float32Array(Math.floor(sr * duration));
    for (let i = 0; i < samples.length; i++) {
      const t = i / sr;
      // Tiny click - LOUDER
      const click = Math.sin(2 * Math.PI * 800 * t) * Math.exp(-t * 60);
      const noise = (Math.random() - 0.5) * Math.exp(-t * 80) * 0.5;
      samples[i] = (click + noise) * 0.7;
    }
    return samples;
  }
};

// Generate all sounds
const outputDir = path.join(__dirname, '..', 'public', 'sounds');

// Ensure output directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

console.log('🔊 Generating game sounds...\n');

for (const [name, generator] of Object.entries(sounds)) {
  const samples = generator(SAMPLE_RATE);
  const wavBuffer = createWav(samples, SAMPLE_RATE);
  const filename = `${name}.wav`; // Proper WAV extension
  const filepath = path.join(outputDir, filename);
  
  fs.writeFileSync(filepath, wavBuffer);
  console.log(`✅ Generated: ${filename}`);
}

console.log('\n🎮 All sounds generated in public/sounds/');
console.log('   Refresh your browser to hear them!');

