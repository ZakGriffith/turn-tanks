import { sound } from '@pixi/sound';

// Sound effect types
export type SoundEffect = 
  | 'tankMove'
  | 'cannonFire'
  | 'shellHit'
  | 'tankExplosion'
  | 'turnStart'
  | 'actionQueue'
  | 'buttonClick';

// Sound configuration - base volumes (will be multiplied by master volume)
// tankMove uses native Audio API to avoid @pixi/sound auto-play issues
const SOUND_CONFIG: Record<SoundEffect, { url: string; volume: number; useNativeAudio?: boolean }> = {
  tankMove: { url: '/sounds/tanktracks.mp3', volume: 0.5, useNativeAudio: true },
  cannonFire: { url: '/sounds/cannon-fire.wav', volume: 1.0, useNativeAudio: true },
  shellHit: { url: '/sounds/shell-hit.wav', volume: 0.9, useNativeAudio: true },
  tankExplosion: { url: '/sounds/explosion.wav', volume: 1.0, useNativeAudio: true },
  turnStart: { url: '/sounds/turn-start.wav', volume: 0.6 },
  actionQueue: { url: '/sounds/action-queue.wav', volume: 0.5 },
  buttonClick: { url: '/sounds/button-click.wav', volume: 0.5 },
};

class SoundManagerClass {
  private initialized = false;
  private enabled = true;
  private masterVolume = 0.6; // Default 60%
  private loadedSounds: Set<SoundEffect> = new Set();
  private nativeAudioElements: Map<SoundEffect, HTMLAudioElement> = new Map();

  async init() {
    if (this.initialized) return;
    
    console.log('[SoundManager] Initializing sounds...');
    
    // Load sounds
    const loadPromises = Object.entries(SOUND_CONFIG).map(async ([key, config]) => {
      if (!config.url) return;
      
      // Use native Audio API for sounds marked as such (avoids @pixi/sound auto-play issues)
      if (config.useNativeAudio) {
        console.log(`[SoundManager] Using native Audio for: ${key}`);
        // Don't preload - just mark as available
        this.loadedSounds.add(key as SoundEffect);
        return;
      }
      
      try {
        await sound.add(key, {
          url: config.url,
          preload: false,
          autoPlay: false,
          volume: config.volume * this.masterVolume,
        });
        this.loadedSounds.add(key as SoundEffect);
        console.log(`[SoundManager] Registered: ${key}`);
      } catch (err) {
        console.warn(`[SoundManager] Failed to add ${key}:`, err);
      }
    });

    await Promise.allSettled(loadPromises);
    this.initialized = true;
    console.log('[SoundManager] Initialization complete');
  }

  play(effect: SoundEffect, options?: { volume?: number; loop?: boolean }) {
    if (!this.enabled || !this.initialized) return;
    if (this.masterVolume === 0) return; // Don't play if muted/volume is 0
    
    const config = SOUND_CONFIG[effect];
    if (!config.url) return;
    if (!this.loadedSounds.has(effect)) return;
    
    const volume = (options?.volume ?? config.volume) * this.masterVolume;
    
    // Use native Audio API for marked sounds
    if (config.useNativeAudio) {
      console.log(`[SoundManager] Playing (native): ${effect} at volume ${volume.toFixed(2)} (master: ${this.masterVolume.toFixed(2)})`);
      try {
        // Create new Audio element each time to allow overlapping sounds
        const audio = new Audio(config.url);
        audio.volume = volume;
        audio.loop = options?.loop ?? false;
        audio.play().catch(() => {
          // Ignore autoplay errors
        });
        // Store reference for stopping
        this.nativeAudioElements.set(effect, audio);
      } catch (err) {
        console.warn(`[SoundManager] Could not play native audio ${effect}`);
      }
      return;
    }
    
    try {
      console.log(`[SoundManager] Playing: ${effect}`);
      sound.play(effect, {
        volume,
        loop: options?.loop ?? false,
      });
    } catch (err) {
      console.warn(`[SoundManager] Could not play ${effect}`);
    }
  }

  stop(effect: SoundEffect) {
    const config = SOUND_CONFIG[effect];
    
    // Handle native audio
    if (config?.useNativeAudio) {
      const audio = this.nativeAudioElements.get(effect);
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
        this.nativeAudioElements.delete(effect);
      }
      return;
    }
    
    try {
      sound.stop(effect);
    } catch {
      // Ignore
    }
  }

  stopAll() {
    // Stop native audio
    this.nativeAudioElements.forEach((audio) => {
      audio.pause();
      audio.currentTime = 0;
    });
    this.nativeAudioElements.clear();
    
    sound.stopAll();
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (!enabled) {
      this.stopAll();
    }
  }

  isEnabled() {
    return this.enabled;
  }

  setMasterVolume(volume: number) {
    this.masterVolume = Math.max(0, Math.min(1, volume));
    // Only update sound volumes if initialized
    if (!this.initialized) return;
    
    // Update all sound volumes
    Object.entries(SOUND_CONFIG).forEach(([key, config]) => {
      try {
        const snd = sound.find(key);
        if (snd) {
          snd.volume = config.volume * this.masterVolume;
        }
      } catch {
        // Ignore - sound may not be loaded yet
      }
    });
  }

  getMasterVolume() {
    return this.masterVolume;
  }
}

// Singleton instance
export const SoundManager = new SoundManagerClass();

