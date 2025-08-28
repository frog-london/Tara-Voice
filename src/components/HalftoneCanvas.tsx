import React, { useRef, useEffect, useCallback, useState } from 'react';
import * as martinez from 'martinez-polygon-clipping';

// Color utility functions
function parseColor(color: string): [number, number, number] {
  if (color.startsWith('#')) {
    // Parse hex color
    const hex = color.slice(1);
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return [r, g, b];
  } else if (color.startsWith('hsl(')) {
    // Parse HSL color - convert to RGB
    const match = color.match(/hsl\(\s*(\d+)\s*,\s*(\d+)%\s*,\s*(\d+)%\s*\)/);
    if (match) {
      const h = parseInt(match[1]) / 360;
      const s = parseInt(match[2]) / 100;
      const l = parseInt(match[3]) / 100;
      
      const hslToRgb = (h: number, s: number, l: number): [number, number, number] => {
        if (s === 0) {
          const val = Math.round(l * 255);
          return [val, val, val];
        }
        
        const hue2rgb = (p: number, q: number, t: number) => {
          if (t < 0) t += 1;
          if (t > 1) t -= 1;
          if (t < 1/6) return p + (q - p) * 6 * t;
          if (t < 1/2) return q;
          if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
          return p;
        };
        
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        const r = hue2rgb(p, q, h + 1/3);
        const g = hue2rgb(p, q, h);
        const b = hue2rgb(p, q, h - 1/3);
        
        return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
      };
      
      return hslToRgb(h, s, l);
    }
  }
  return [255, 255, 255]; // Default to white
}

function lerpColor(color1: string, color2: string, progress: number): string {
  const [r1, g1, b1] = parseColor(color1);
  const [r2, g2, b2] = parseColor(color2);
  
  const r = Math.round(r1 + (r2 - r1) * progress);
  const g = Math.round(g1 + (g2 - g1) * progress);
  const b = Math.round(b1 + (b2 - b1) * progress);
  
  return `rgb(${r}, ${g}, ${b})`;
}

// Rotation animation utilities
function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function calculateMaskRotation(startTime: number): number {
  const now = performance.now();
  const elapsed = (now - startTime) / 1000; // Convert to seconds
  
  // Each revolution = 0.9s rotation + 0.1s pause = 1s total
  const revolutionDuration = 1.0; // 1 second per revolution
  const rotationDuration = 0.9; // 0.9s of actual rotation
  // const pauseDuration = 0.1; // 0.1s pause
  
  // Determine which revolution we're in (0-3)
  const revolutionIndex = Math.floor(elapsed / revolutionDuration);
  
  // If we've completed all 4 revolutions, stop
  if (revolutionIndex >= 4) {
    console.log('Animation complete - returning 0°');
    return 0;
  }
  
  // Calculate progress within current revolution
  const revolutionElapsed = elapsed - (revolutionIndex * revolutionDuration);
  
  // Check if we're in the pause period
  if (revolutionElapsed > rotationDuration) {
    // We're in pause, reset to 0° for next revolution
    console.log(`Revolution ${revolutionIndex + 1} complete - in pause, returning 0°`);
    return 0;
  }
  
  // We're rotating, calculate eased progress
  const rotationProgress = revolutionElapsed / rotationDuration;
  const easedProgress = easeInOutCubic(rotationProgress);
  
  // Calculate angle within this revolution (0-180)
  const currentAngle = easedProgress * 180;
  
  console.log(`Revolution ${revolutionIndex + 1}: ${currentAngle.toFixed(1)}°`);
  
  return currentAngle;
}

interface AudioData {
  frequencyData: Uint8Array;
  bassLevel: number;
  midLevel: number;
  trebleLevel: number;
  averageLevel: number;
}

interface Wave {
  id: string;
  birthTime: number;
  currentRadius: number;
  speed: number;
  intensity: number;
  frequency: 'bass' | 'mid' | 'treble';
  maxRadius: number;
  decayRate: number;
}

interface Ripple {
  id: string;
  birthTime: number;
  currentRadius: number;
  speed: number;
  amplitude: number;
  frequency: 'bass' | 'mid' | 'treble';
  maxRadius: number;
  decayRate: number;
}

class WaveManager {
  private waves: Wave[] = [];
  // private lastBassLevel = -1;
  // private lastMidLevel = -1;
  // private lastTrebleLevel = -1;
  private lastBassSpawn = 0;
  private lastMidSpawn = 0;
  private lastTrebleSpawn = 0;
  private centerX: number;
  private centerY: number;
  private maxRadius: number;
  
  constructor(centerX: number, centerY: number, maxRadius: number) {
    this.centerX = centerX;
    this.centerY = centerY;
    this.maxRadius = maxRadius;
  }
  
  updateCenter(centerX: number, centerY: number, maxRadius: number) {
    this.centerX = centerX;
    this.centerY = centerY;
    this.maxRadius = maxRadius;
  }
  
  spawnWave(frequency: 'bass' | 'mid' | 'treble', intensity: number) {
    const wave: Wave = {
      id: `${frequency}-${Date.now()}-${Math.random()}`,
      birthTime: Date.now(),
      currentRadius: 0,
      speed: frequency === 'bass' ? 1 : frequency === 'mid' ? 3 : 6,
      intensity: Math.min(intensity, 1),
      frequency,
      maxRadius: this.maxRadius * (frequency === 'bass' ? 1.2 : frequency === 'mid' ? 0.8 : 0.4),
      decayRate: frequency === 'bass' ? 0.998 : frequency === 'mid' ? 0.995 : 0.99
    };
    
    this.waves.push(wave);
    
    // Debug output for every wave
    if ((window as any).AUDIO_DEBUG) {
      console.log(`[WaveManager] Wave spawned: ${frequency} (${intensity.toFixed(3)}) - Total waves: ${this.waves.length}`, {
        id: wave.id,
        speed: wave.speed,
        maxRadius: wave.maxRadius.toFixed(1),
        decayRate: wave.decayRate
      });
    }
  }
  
  update(audioData: AudioData, sensitivity: number = 1, bassInfluence: number = 1, midInfluence: number = 1, trebleInfluence: number = 1) {
    // Debug logging (controlled by window.AUDIO_DEBUG flag)
    if ((window as any).AUDIO_DEBUG && Date.now() % 500 < 16) {
      console.log('[WaveManager] Update called with:', {
        audioData: {
          bassLevel: audioData.bassLevel.toFixed(3),
          midLevel: audioData.midLevel.toFixed(3),
          trebleLevel: audioData.trebleLevel.toFixed(3),
          averageLevel: audioData.averageLevel.toFixed(3)
        },
        sensitivity,
        influences: { bassInfluence, midInfluence, trebleInfluence },
        currentWaves: this.waves.length
      });
    }
    
    // Update existing waves
    const initialWaveCount = this.waves.length;
    this.waves = this.waves.filter(wave => {
      wave.currentRadius += wave.speed;
      wave.intensity *= wave.decayRate;
      
      // Remove waves that are too far or too weak
      return wave.currentRadius < wave.maxRadius && wave.intensity > 0.01;
    });
    
    if ((window as any).AUDIO_DEBUG && this.waves.length !== initialWaveCount) {
      console.log(`[WaveManager] Removed ${initialWaveCount - this.waves.length} expired waves`);
    }
    
    // Apply sensitivity and influence to audio levels
    const adjustedBassLevel = audioData.bassLevel * bassInfluence * sensitivity;
    const adjustedMidLevel = audioData.midLevel * midInfluence * sensitivity;
    const adjustedTrebleLevel = audioData.trebleLevel * trebleInfluence * sensitivity;
    
    // Extremely low thresholds for any audio input detection
    const bassThreshold = 0.001;  // Almost any bass input
    const midThreshold = 0.001;   // Almost any mid input  
    const trebleThreshold = 0.001; // Almost any treble input
    
    // Cooldown periods (ms) to prevent wave spam
    // Bass: 500ms, Mid: 300ms, Treble: 100ms
    const now = Date.now();
    
    if ((window as any).AUDIO_DEBUG) {
      console.log('[WaveManager] Threshold checks:', {
        bass: {
          adjusted: adjustedBassLevel.toFixed(3),
          threshold: bassThreshold,
          lastSpawn: now - this.lastBassSpawn,
          passThreshold: adjustedBassLevel > bassThreshold,
          passCooldown: now - this.lastBassSpawn > 500
        },
        mid: {
          adjusted: adjustedMidLevel.toFixed(3),
          threshold: midThreshold,
          lastSpawn: now - this.lastMidSpawn,
          passThreshold: adjustedMidLevel > midThreshold,
          passCooldown: now - this.lastMidSpawn > 300
        },
        treble: {
          adjusted: adjustedTrebleLevel.toFixed(3),
          threshold: trebleThreshold,
          lastSpawn: now - this.lastTrebleSpawn,
          passThreshold: adjustedTrebleLevel > trebleThreshold,
          passCooldown: now - this.lastTrebleSpawn > 100
        }
      });
    }
    
    // Bass waves - spawn with cooldown (reduced for testing)
    if (adjustedBassLevel > bassThreshold && now - this.lastBassSpawn > 200) {
      if ((window as any).AUDIO_DEBUG) console.log('[WaveManager] Spawning BASS wave!', { level: adjustedBassLevel });
      this.spawnWave('bass', adjustedBassLevel);
      this.lastBassSpawn = now;
    }
    
    // Mid waves - more frequent spawning (reduced for testing)
    if (adjustedMidLevel > midThreshold && now - this.lastMidSpawn > 100) {
      if ((window as any).AUDIO_DEBUG) console.log('[WaveManager] Spawning MID wave!', { level: adjustedMidLevel });
      this.spawnWave('mid', adjustedMidLevel);
      this.lastMidSpawn = now;
    }
    
    // Treble waves - most frequent (reduced for testing)
    if (adjustedTrebleLevel > trebleThreshold && now - this.lastTrebleSpawn > 50) {
      if ((window as any).AUDIO_DEBUG) console.log('[WaveManager] Spawning TREBLE wave!', { level: adjustedTrebleLevel });
      this.spawnWave('treble', adjustedTrebleLevel);
      this.lastTrebleSpawn = now;
    }
    
    // Update last levels for potential future use
    // this.lastBassLevel = adjustedBassLevel;
    // this.lastMidLevel = adjustedMidLevel;
    // this.lastTrebleLevel = adjustedTrebleLevel;
  }
  
  getWaveInfluence(x: number, y: number): number {
    const distanceFromCenter = Math.sqrt(
      Math.pow(x - this.centerX, 2) + Math.pow(y - this.centerY, 2)
    );
    
    let totalInfluence = 0;
    
    for (const wave of this.waves) {
      const distanceFromWave = Math.abs(distanceFromCenter - wave.currentRadius);
      const waveWidth = wave.frequency === 'bass' ? 80 : wave.frequency === 'mid' ? 50 : 30;
      
      if (distanceFromWave < waveWidth) {
        const waveInfluence = (1 - distanceFromWave / waveWidth) * wave.intensity;
        totalInfluence += waveInfluence;
      }
    }
    
    return Math.min(totalInfluence, 2); // Cap influence at 2x
  }
  
  getActiveWaves(): Wave[] {
    return [...this.waves];
  }
}

class RippleManager {
  private ripples: Ripple[] = [];
  // private lastBassLevel = -1;
  // private lastMidLevel = -1;
  // private lastTrebleLevel = -1;
  private lastBassSpawn = 0;
  private lastMidSpawn = 0;
  private lastTrebleSpawn = 0;
  private centerX: number;
  private centerY: number;
  private maxRadius: number;
  
  constructor(centerX: number, centerY: number, maxRadius: number) {
    this.centerX = centerX;
    this.centerY = centerY;
    this.maxRadius = maxRadius;
  }
  
  updateCenter(centerX: number, centerY: number, maxRadius: number) {
    this.centerX = centerX;
    this.centerY = centerY;
    this.maxRadius = maxRadius;
  }
  
  spawnRipple(frequency: 'bass' | 'mid' | 'treble', intensity: number) {
    const ripple: Ripple = {
      id: `${frequency}-${Date.now()}-${Math.random()}`,
      birthTime: Date.now(),
      currentRadius: 0,
      // Bass travels slower but with more presence, treble is quick and sharp
      speed: frequency === 'bass' ? 1.5 : frequency === 'mid' ? 3.5 : 8,
      // Much stronger differentiation in amplitude - bass creates powerful waves
      amplitude: intensity * (frequency === 'bass' ? 35 : frequency === 'mid' ? 18 : 8),
      frequency,
      // Bass ripples cover more area, treble ripples are more localized
      maxRadius: this.maxRadius * (frequency === 'bass' ? 1.8 : frequency === 'mid' ? 1.2 : 0.7),
      // Bass persists longer for sustained impact, treble decays quickly for snappy response
      decayRate: frequency === 'bass' ? 0.998 : frequency === 'mid' ? 0.994 : 0.985
    };
    
    this.ripples.push(ripple);
    
    if ((window as any).AUDIO_DEBUG) {
      console.log(`[RippleManager] Ripple spawned: ${frequency} (${intensity.toFixed(3)}) - Total ripples: ${this.ripples.length}`, {
        id: ripple.id,
        speed: ripple.speed,
        amplitude: ripple.amplitude.toFixed(1),
        maxRadius: ripple.maxRadius.toFixed(1),
        decayRate: ripple.decayRate
      });
    }
  }
  
  update(audioData: AudioData, sensitivity: number = 1, bassInfluence: number = 1, midInfluence: number = 1, trebleInfluence: number = 1) {
    // Debug logging
    if ((window as any).AUDIO_DEBUG && Date.now() % 500 < 16) {
      console.log('[RippleManager] Update called with:', {
        audioData: {
          bassLevel: audioData.bassLevel.toFixed(3),
          midLevel: audioData.midLevel.toFixed(3),
          trebleLevel: audioData.trebleLevel.toFixed(3),
          averageLevel: audioData.averageLevel.toFixed(3)
        },
        sensitivity,
        influences: { bassInfluence, midInfluence, trebleInfluence },
        currentRipples: this.ripples.length
      });
    }
    
    // Update existing ripples
    const initialRippleCount = this.ripples.length;
    this.ripples = this.ripples.filter(ripple => {
      ripple.currentRadius += ripple.speed;
      ripple.amplitude *= ripple.decayRate;
      
      // Remove ripples that are too far or too weak
      return ripple.currentRadius < ripple.maxRadius && ripple.amplitude > 1;
    });
    
    if ((window as any).AUDIO_DEBUG && this.ripples.length !== initialRippleCount) {
      console.log(`[RippleManager] Removed ${initialRippleCount - this.ripples.length} expired ripples`);
    }
    
    // Apply sensitivity and influence to audio levels
    const adjustedBassLevel = audioData.bassLevel * bassInfluence * sensitivity;
    const adjustedMidLevel = audioData.midLevel * midInfluence * sensitivity;
    const adjustedTrebleLevel = audioData.trebleLevel * trebleInfluence * sensitivity;
    
    // Thresholds for ripple spawning
    const bassThreshold = 0.002;
    const midThreshold = 0.002;  
    const trebleThreshold = 0.002;
    
    const now = Date.now();
    
    // Spawn ripples with frequency-appropriate cooldowns
    // Bass: Longer cooldown for powerful, sustained ripples
    if (adjustedBassLevel > bassThreshold && now - this.lastBassSpawn > 400) {
      if ((window as any).AUDIO_DEBUG) console.log('[RippleManager] Spawning BASS ripple!', { level: adjustedBassLevel });
      this.spawnRipple('bass', adjustedBassLevel);
      this.lastBassSpawn = now;
    }
    
    // Mid: Moderate cooldown for balanced response
    if (adjustedMidLevel > midThreshold && now - this.lastMidSpawn > 200) {
      if ((window as any).AUDIO_DEBUG) console.log('[RippleManager] Spawning MID ripple!', { level: adjustedMidLevel });
      this.spawnRipple('mid', adjustedMidLevel);
      this.lastMidSpawn = now;
    }
    
    // Treble: Very short cooldown for rapid, responsive ripples
    if (adjustedTrebleLevel > trebleThreshold && now - this.lastTrebleSpawn > 50) {
      if ((window as any).AUDIO_DEBUG) console.log('[RippleManager] Spawning TREBLE ripple!', { level: adjustedTrebleLevel });
      this.spawnRipple('treble', adjustedTrebleLevel);
      this.lastTrebleSpawn = now;
    }
    
    // Update last levels
    // this.lastBassLevel = adjustedBassLevel;
    // this.lastMidLevel = adjustedMidLevel;
    // this.lastTrebleLevel = adjustedTrebleLevel;
  }
  
  getRippleDisplacement(x: number, y: number): { displacement: number, sizeModulation: number } {
    const distanceFromCenter = Math.sqrt(
      Math.pow(x - this.centerX, 2) + Math.pow(y - this.centerY, 2)
    );
    
    let totalDisplacement = 0;
    let totalSizeModulation = 1;
    
    for (const ripple of this.ripples) {
      const distanceFromRipple = Math.abs(distanceFromCenter - ripple.currentRadius);
      
      // Much more distinct ripple widths - bass creates thick waves, treble creates thin sharp lines
      const rippleWidth = ripple.frequency === 'bass' ? 120 : ripple.frequency === 'mid' ? 50 : 12;
      
      if (distanceFromRipple < rippleWidth) {
        const wavePhase = (distanceFromRipple / rippleWidth) * Math.PI;
        const falloff = (1 - distanceFromRipple / rippleWidth);
        
        // Frequency-specific displacement patterns
        let displacement = 0;
        let sizeEffect = 0;
        
        if (ripple.frequency === 'bass') {
          // Bass: Powerful, broad waves with strong displacement and size growth
          displacement = Math.sin(wavePhase) * ripple.amplitude * falloff * 1.5;
          sizeEffect = Math.cos(wavePhase * 0.5) * ripple.amplitude * falloff * 0.08; // Up to 80% size increase
          
        } else if (ripple.frequency === 'mid') {
          // Mid: Smooth water-like ripples with moderate effects
          displacement = Math.sin(wavePhase) * ripple.amplitude * falloff;
          sizeEffect = Math.sin(wavePhase) * ripple.amplitude * falloff * 0.04; // Up to 40% size change
          
        } else { // treble
          // Treble: Sharp, quick oscillations with minimal displacement but rapid size variation
          displacement = Math.sin(wavePhase * 3) * ripple.amplitude * falloff * 0.5; // Higher frequency oscillation
          sizeEffect = Math.sin(wavePhase * 4) * ripple.amplitude * falloff * 0.02; // Quick, small variations
        }
        
        totalDisplacement += displacement;
        totalSizeModulation *= (1 + sizeEffect);
      }
    }
    
    // Clamp size modulation to reasonable bounds
    totalSizeModulation = Math.max(0.3, Math.min(2.0, totalSizeModulation));
    
    return { displacement: totalDisplacement, sizeModulation: totalSizeModulation };
  }
  
  getActiveRipples(): Ripple[] {
    return [...this.ripples];
  }
}

class LoopPulseManager {
  private centerX: number;
  private centerY: number;
  private maxRadius: number;
  private loopDuration: number;
  private startTime: number;
  private currentCycle: number;
  private totalCycles: number;
  private animationIntensity: number;
  private expansionSpeed: number;
  private isCompleted: boolean;
  private pulseMaxRadius: number; // Maximum reach of pulse as percentage
  private falloffWidth: number; // Width of edge transition as percentage
  
  constructor(centerX: number, centerY: number, maxRadius: number, loopDuration: number, totalCycles: number) {
    this.centerX = centerX;
    this.centerY = centerY;
    this.maxRadius = maxRadius;
    this.loopDuration = loopDuration;
    this.totalCycles = totalCycles;
    this.startTime = performance.now();
    this.currentCycle = 0;
    this.animationIntensity = 1;
    this.expansionSpeed = 1;
    this.isCompleted = false;
    this.pulseMaxRadius = 80; // Default to 80% of canvas
    this.falloffWidth = 18; // Default to 18% transition width
  }
  
  updateCenter(centerX: number, centerY: number, maxRadius: number) {
    this.centerX = centerX;
    this.centerY = centerY;
    this.maxRadius = maxRadius;
  }
  
  updateParams(loopDuration: number, totalCycles: number, intensity: number, expansionSpeed: number, pulseMaxRadius?: number, falloffWidth?: number) {
    this.loopDuration = loopDuration;
    this.totalCycles = totalCycles;
    this.animationIntensity = intensity;
    this.expansionSpeed = expansionSpeed;
    if (pulseMaxRadius !== undefined) {
      this.pulseMaxRadius = pulseMaxRadius;
    }
    if (falloffWidth !== undefined) {
      this.falloffWidth = falloffWidth;
    }
  }
  
  reset() {
    this.startTime = performance.now();
    this.currentCycle = 0;
    this.isCompleted = false;
  }
  
  complete() {
    this.isCompleted = true;
  }
  
  // Easing function for smooth animation with better endpoint speed
  private easeInOutSine(t: number): number {
    return -(Math.cos(Math.PI * t) - 1) / 2;
  }
  
  // Get pulse multiplier for dot size at specific position
  getPulseMultiplier(x?: number, y?: number): number {
    if (this.isCompleted) return 1;
    
    const now = performance.now();
    const totalElapsed = (now - this.startTime) / 1000; // Convert to seconds
    
    // Check if animation is complete (but not for infinite cycles)
    if (this.totalCycles > 0) {
      const totalDuration = this.loopDuration * this.totalCycles;
      if (totalElapsed >= totalDuration) {
        this.isCompleted = true;
        return 1;
      }
    }
    
    // Calculate current cycle and position within cycle
    const cycleElapsed = totalElapsed % this.loopDuration;
    this.currentCycle = Math.floor(totalElapsed / this.loopDuration);
    
    // Get progress within current cycle (0 to 1)
    let progress = cycleElapsed / this.loopDuration;
    
    // Apply easing for smooth motion
    const easedProgress = this.easeInOutSine(progress);
    

    // Check if position is provided for distance-based calculation
    if (x !== undefined && y !== undefined) {
      const distanceFromCenter = Math.sqrt(
        Math.pow(x - this.centerX, 2) + Math.pow(y - this.centerY, 2)
      );
      // Max reach in pixels: 100% means exactly to clipping radius
      const maxPulseDistance = this.maxRadius * Math.max(0, Math.min(1, this.pulseMaxRadius / 100));
      if (maxPulseDistance <= 0) return 1;

      // Calculate effect zone including falloff extension
      const baseWidth = maxPulseDistance * (this.falloffWidth / 100);
      const frontWidth = Math.max(4, baseWidth / Math.max(0.25, this.expansionSpeed));
      const effectiveMaxDistance = maxPulseDistance + frontWidth; // Allow falloff to extend beyond reach

      // Only completely exclude dots that are beyond the falloff zone
      if (distanceFromCenter > effectiveMaxDistance) {
        return 1;
      }

      // Simple two-phase breathing: expand then contract
      let frontRadius;
      let isExpanding;

      if (easedProgress <= 0.5) {
        // Expanding phase: 0 to 0.5 progress
        isExpanding = true;
        const expandProgress = easedProgress * 2; // 0 to 1
        frontRadius = expandProgress * maxPulseDistance; // Wave travels to reach limit
      } else {
        // Contracting phase: 0.5 to 1 progress
        isExpanding = false;
        const contractProgress = (easedProgress - 0.5) * 2; // 0 to 1
        frontRadius = (1 - contractProgress) * maxPulseDistance;
      }

      if (isExpanding) {
        // Expanding: everything inside the front gets full effect
        if (distanceFromCenter <= frontRadius - frontWidth) {
          // Inside the wave - full plateau effect
          return 1 + this.animationIntensity;
        } else if (distanceFromCenter <= frontRadius + frontWidth) {
          // At the wave front - smooth transition
          const d = distanceFromCenter - (frontRadius - frontWidth);
          const normalized = d / (frontWidth * 2);
          const influence = 1 - normalized; // Linear falloff at edge
          return 1 + this.animationIntensity * influence;
        } else {
          // Outside the wave - no effect
          return 1;
        }
      } else {
        // Contracting: everything inside still gets effect
        if (distanceFromCenter <= frontRadius - frontWidth) {
          // Inside the contracting wave - maintain plateau
          return 1 + this.animationIntensity;
        } else if (distanceFromCenter <= frontRadius + frontWidth) {
          // At the wave front - smooth transition
          const d = distanceFromCenter - (frontRadius - frontWidth);
          const normalized = d / (frontWidth * 2);
          const influence = 1 - normalized;
          return 1 + this.animationIntensity * influence;
        } else {
          // Outside - no effect
          return 1;
        }
      }
    }
    
    // Fallback for backward compatibility (no position provided)
    const maxExpansion = 1 + (this.animationIntensity * 0.8);
    let pulseMultiplier;
    
    if (easedProgress <= 0.5) {
      pulseMultiplier = 1 + (maxExpansion - 1) * (easedProgress * 2);
    } else {
      pulseMultiplier = maxExpansion - (maxExpansion - 1) * ((easedProgress - 0.5) * 2);
    }
    
    return pulseMultiplier;
  }

  // New: return a size modulation (0.0-1.0+) for loop pulse
  // - Uniform plateau inside the pulse front
  // - Bell-shaped band at the front
  // - Minimal size outside the front
  getPulseSizeModulation(x: number, y: number): number {
    if (this.isCompleted) return 0.3;

    const now = performance.now();
    const totalElapsed = (now - this.startTime) / 1000;
    const totalDuration = this.loopDuration * this.totalCycles;
    if (totalElapsed >= totalDuration) {
      this.isCompleted = true;
      return 0.3;
    }

    const cycleElapsed = totalElapsed % this.loopDuration;
    // Eased triangular phase 0->1->0 across cycle
    const t = easeInOutCubic(cycleElapsed / this.loopDuration);
    const phase = t <= 0.5 ? (t * 2) : (1 - (t - 0.5) * 2);

    const distanceFromCenter = Math.sqrt(
      Math.pow(x - this.centerX, 2) + Math.pow(y - this.centerY, 2)
    );

    // Reach: percentage of clipping radius
    const reachRatio = Math.max(0, Math.min(1, this.pulseMaxRadius / 100));
    const maxPulseDistance = this.maxRadius * reachRatio;
    if (maxPulseDistance <= 0) return 0.3;

    const frontRadius = phase * maxPulseDistance;
    // Plateau size based on intensity (map ~0.3..1.0)
    const plateau = Math.max(0.3, Math.min(1.0, 0.3 + this.animationIntensity * 0.7));
    // Hard edge: everything inside front is plateau, outside is min size
    return distanceFromCenter <= frontRadius ? plateau : 0.3;
  }
  
  getCurrentCycle(): number {
    return this.currentCycle;
  }
  
  getTotalCycles(): number {
    return this.totalCycles;
  }
  
  isAnimationComplete(): boolean {
    return this.isCompleted;
  }
  
  getProgress(): number {
    if (this.isCompleted) return 1;
    
    const now = Date.now();
    const totalElapsed = (now - this.startTime) / 1000;
    const totalDuration = this.loopDuration * this.totalCycles;
    
    return Math.min(1, totalElapsed / totalDuration);
  }
}

interface LoopRipple {
  id: string;
  birthTime: number;
  currentRadius: number;
  speed: number;
  amplitude: number;
  maxRadius: number;
  cycleIndex: number;
}

class LoopRippleManager {
  private ripples: LoopRipple[] = [];
  private centerX: number;
  private centerY: number;
  private maxRadius: number;
  private loopDuration: number;
  private startTime: number;
  private currentCycle: number;
  private totalCycles: number;
  private animationIntensity: number;
  // private rippleFrequency: number;
  // private detailVariation: number;
  private isCompleted: boolean;
  // private ripplesPerCycle: number;
  private ringWidth: number; // Width of the ripple ring
  private ringIntensity: number; // Intensity difference between peak and valley
  private falloffSharpness: number; // Controls falloff sharpness on both sides
  private cyclePause: number; // Pause time between cycles in seconds
  // private canvasWidth: number; // Canvas dimensions for proper speed calculation
  // private canvasHeight: number;
  private lastUpdateTime: number; // Track frame timing for proper delta calculation
  
  constructor(centerX: number, centerY: number, maxRadius: number, loopDuration: number, totalCycles: number, _canvasWidth: number = 800, _canvasHeight: number = 600) {
    this.centerX = centerX;
    this.centerY = centerY;
    this.maxRadius = maxRadius;
    this.loopDuration = loopDuration;
    this.totalCycles = totalCycles;
    // this.canvasWidth = canvasWidth;
    // this.canvasHeight = canvasHeight;
    this.startTime = performance.now();
    this.currentCycle = 0;
    this.animationIntensity = 1;
    // this.rippleFrequency = 0.5; // Default to spawn ripple every 0.5 seconds
    // this.detailVariation = 1;
    this.isCompleted = false;
    // this.ripplesPerCycle = 1; // Always exactly one ripple per cycle
    this.ringWidth = 80; // Default ring width
    this.ringIntensity = 1.5; // Default intensity multiplier
    this.falloffSharpness = 2.5; // Default falloff sharpness
    this.cyclePause = 0; // Default no pause between cycles
    this.lastUpdateTime = performance.now();
  }
  
  updateCenter(centerX: number, centerY: number, maxRadius: number, _canvasWidth?: number, _canvasHeight?: number) {
    this.centerX = centerX;
    this.centerY = centerY;
    this.maxRadius = maxRadius;
    // if (canvasWidth !== undefined) this.canvasWidth = canvasWidth;
    // if (canvasHeight !== undefined) this.canvasHeight = canvasHeight;
  }
  
  updateParams(loopDuration: number, totalCycles: number, intensity: number, _frequency: number, _variation: number, ringWidth?: number, ringIntensity?: number, falloffSharpness?: number, cyclePause?: number) {
    this.loopDuration = loopDuration;
    this.totalCycles = totalCycles;
    this.animationIntensity = intensity;
    // this.rippleFrequency = Math.max(0.1, frequency); // Minimum 0.1 seconds between ripples
    // this.detailVariation = variation;
    // this.ripplesPerCycle = 1; // Always exactly one ripple per cycle
    if (ringWidth !== undefined) {
      this.ringWidth = ringWidth;
    }
    if (ringIntensity !== undefined) {
      this.ringIntensity = ringIntensity;
    }
    if (falloffSharpness !== undefined) {
      this.falloffSharpness = falloffSharpness;
    }
    if (cyclePause !== undefined) {
      this.cyclePause = cyclePause;
    }
  }
  
  reset() {
    this.startTime = performance.now();
    this.lastUpdateTime = performance.now();
    this.currentCycle = 0;
    this.isCompleted = false;
    this.ripples = [];
  }
  
  private spawnRipple(cycleIndex: number, rippleIndex: number) {
    // Travel distance should be to the clipping radius edge
    const maxTravelDistance = this.maxRadius;
    
    const ripple: LoopRipple = {
      id: `loop-ripple-${cycleIndex}-${rippleIndex}-${performance.now()}`,
      birthTime: performance.now(),
      currentRadius: 0,
      // Speed calculated to reach clipping radius in the cycle duration
      speed: maxTravelDistance / this.loopDuration,
      amplitude: this.animationIntensity * 20,
      maxRadius: maxTravelDistance, // Travel to the clipping radius
      cycleIndex
    };
    
    this.ripples.push(ripple);
  }
  
  update() {
    if (this.isCompleted) return;
    
    const now = performance.now();
    const deltaTime = (now - this.lastUpdateTime) / 1000; // Convert to seconds
    this.lastUpdateTime = now;
    const totalElapsed = (now - this.startTime) / 1000;
    
    // Effective cycle duration includes travel time + pause
    const effectiveCycleDuration = this.loopDuration + this.cyclePause;
    const totalDuration = effectiveCycleDuration * this.totalCycles;
    
    // Check if animation is complete
    if (totalElapsed >= totalDuration) {
      this.isCompleted = true;
      this.ripples = [];
      return;
    }
    
    // Calculate current cycle with pause consideration
    const cycleElapsed = totalElapsed % effectiveCycleDuration;
    const newCycle = Math.floor(totalElapsed / effectiveCycleDuration);
    
    // Only spawn ripple if we're in the active phase (not paused)
    if (newCycle !== this.currentCycle && cycleElapsed < 0.1) {
      // New cycle started and we're at the beginning (not in pause phase)
      this.ripples = [];
      this.spawnRipple(newCycle, 0);
      this.currentCycle = newCycle;
    } else if (this.ripples.length === 0 && cycleElapsed < 0.1 && newCycle === 0) {
      // First cycle, spawn initial ripple
      this.spawnRipple(this.currentCycle, 0);
    }
    
    // Update existing ripples
    this.ripples = this.ripples.filter(ripple => {
      ripple.currentRadius += ripple.speed * deltaTime; // Use actual frame time
      
      // Remove ripples that have exceeded their maximum radius (with small buffer for fade completion)
      return ripple.currentRadius < ripple.maxRadius * 1.1;
    });
  }
  
  getRippleDisplacement(x: number, y: number): { displacement: number, sizeModulation: number } {
    if (this.ripples.length === 0) {
      // No ripple present - maintain normal dot size
      return { displacement: 0, sizeModulation: 1.0 };
    }
    
    const distanceFromCenter = Math.sqrt(
      Math.pow(x - this.centerX, 2) + Math.pow(y - this.centerY, 2)
    );
    
    let bestSizeModulation = 1.0; // Start with normal size
    
    for (const ripple of this.ripples) {
      const distanceFromRipple = Math.abs(distanceFromCenter - ripple.currentRadius);
      
      // Ring effect - falloff on both sides of the ripple line
      if (distanceFromRipple < this.ringWidth) {
        // Gaussian-like falloff from the ripple ring center
        const normalizedDistance = distanceFromRipple / this.ringWidth;
        const gaussianFalloff = Math.exp(-((normalizedDistance * this.falloffSharpness) ** 2)); // Configurable peak concentration
        
        // Calculate edge fade factor (smooth fade in last 15% of radius)
        const fadeZone = this.maxRadius * 0.15; // Fade in last 15% of travel
        let edgeFadeFactor = 1.0;
        
        if (ripple.currentRadius > this.maxRadius - fadeZone) {
          // Linear fade from 1.0 to 0.0 in the fade zone
          const fadeProgress = (ripple.currentRadius - (this.maxRadius - fadeZone)) / fadeZone;
          edgeFadeFactor = Math.max(0, 1.0 - fadeProgress);
        }
        
        // Size modulation: peak at the ripple line, falloff inward and outward
        // Scale the intensity effect from normal size (1.0) and apply edge fade
        const intensityEffect = (this.ringIntensity - 1.0) * gaussianFalloff * edgeFadeFactor;
        const peakSize = 1.0 + intensityEffect;
        bestSizeModulation = Math.max(bestSizeModulation, peakSize);
      }
    }
    
    // Clamp to reasonable bounds
    bestSizeModulation = Math.max(0.2, Math.min(3.0, bestSizeModulation));
    
    return { displacement: 0, sizeModulation: bestSizeModulation };
  }
  
  getCurrentCycle(): number {
    return this.currentCycle;
  }
  
  getTotalCycles(): number {
    return this.totalCycles;
  }
  
  isAnimationComplete(): boolean {
    return this.isCompleted;
  }
  
  getProgress(): number {
    if (this.isCompleted) return 1;
    
    const now = Date.now();
    const totalElapsed = (now - this.startTime) / 1000;
    const totalDuration = this.loopDuration * this.totalCycles;
    
    return Math.min(1, totalElapsed / totalDuration);
  }
  
  getActiveRipples(): LoopRipple[] {
    return [...this.ripples];
  }
}

export interface HalftoneParams {
  gridDensity: number;
  maxDotSize: number;
  minDotSize: number;
  falloffType: 'linear' | 'exponential' | 'inverse-square';
  falloffIntensity: number;
  centerX: number;
  centerY: number;
  dotColor: string;
  backgroundColor: string;
  // Color transition parameters
  targetColor?: string;
  sourceColor?: string;
  colorTransitionProgress?: number;
  colorTransitionDuration?: number;
  animationSpeed: number;
  circularRadius: number;
  // Audio parameters
  audioEnabled: boolean;
  audioSensitivity: number;
  bassInfluence: number;
  midInfluence: number;
  trebleInfluence: number;
  audioSmoothing: number;
  audioAnimationMode: 'pulse' | 'ripple' | 'wave' | 'combined';
  // Looping mode parameters
  loopingMode: boolean;
  loopDuration: number;
  loopCycles: number;
  loopAnimationType: 'pulse' | 'ripple';
  isRecording: boolean;
  recordingProgress: number;
  pulseMaxRadius: number; // Percentage of canvas (10-100%)
  rippleRingWidth: number; // Width of the ripple ring
  rippleIntensity: number; // Difference between peak and valley
  rippleBoostAmount: number; // Additive boost strength for ripple effect
  rippleFalloffSharpness: number; // Controls falloff sharpness on both sides of ripple
  rippleCyclePause: number; // Pause time in seconds between ripple cycles
  pulseFalloffWidth: number; // Width of pulse edge transition as percentage of reach
  // Video recording parameters
  frameRate: number; // Recording frame rate (30, 60, 120 fps)
  // Offline export parameters
  offlineTemporalSamples?: number; // 1-4 temporal samples per frame
  // SVG Mask parameters
  maskEnabled: boolean;
  maskSize: number;
  maskSvgPath: string;
  // Mask rotation parameters
  maskRotation?: number;
  isThinking?: boolean;
  maskRotationStartTime?: number;
}

interface HalftoneCanvasProps {
  params: HalftoneParams;
  audioData: AudioData;
  width?: number;
  height?: number;
  onExportSVG?: (svgString: string) => void;
  onOptimizationProgress?: (progress: number, status: string) => void;
  onRecordingProgress?: (progress: number, status: string) => void;
  onRecordingComplete?: (blob: Blob) => void;
}

export const HalftoneCanvas: React.FC<HalftoneCanvasProps> = ({
  params,
  audioData,
  width: propWidth,
  height: propHeight,
  onExportSVG,
  onOptimizationProgress,
  onRecordingProgress,
  onRecordingComplete
}) => {
  // Use viewport dimensions for fullscreen canvas
  const [canvasDimensions, setCanvasDimensions] = useState({
    width: propWidth || window.innerWidth,
    height: propHeight || window.innerHeight
  });
  
  const width = canvasDimensions.width;
  const height = canvasDimensions.height;
  // Canvas will fill its container completely
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Handle window resize to maintain fullscreen
  useEffect(() => {
    const handleResize = () => {
      if (!propWidth && !propHeight) {
        setCanvasDimensions({
          width: window.innerWidth,
          height: window.innerHeight
        });
      }
    };
    
    // Only add resize listener if we're using viewport dimensions
    if (!propWidth && !propHeight) {
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
  }, [propWidth, propHeight]);
  const animationRef = useRef<number>();
  const [isOptimizing, setIsOptimizing] = useState(false);
  const waveManagerRef = useRef<WaveManager | null>(null);
  const rippleManagerRef = useRef<RippleManager | null>(null);
  const loopPulseManagerRef = useRef<LoopPulseManager | null>(null);
  const loopRippleManagerRef = useRef<LoopRippleManager | null>(null);
  const timeRef = useRef(0);
  const maskImageRef = useRef<HTMLImageElement | null>(null);
  const [maskLoadError, setMaskLoadError] = useState<string | null>(null);
  
  // Recording state
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingStartTimeRef = useRef<number>(0);
  // Recording cadence control
  const isRecordingActiveRef = useRef<boolean>(false);
  const captureTrackRef = useRef<MediaStreamTrack | null>(null);
  const frameIntervalRef = useRef<number>(0); // ms
  
  // Color transition state
  const [colorTransition, setColorTransition] = useState<{
    isTransitioning: boolean;
    sourceColor: string;
    targetColor: string;
    startTime: number;
    duration: number;
  } | null>(null);

  // Function to start color transition
  const startColorTransition = useCallback((targetColor: string, duration: number = 500) => {
    setColorTransition({
      isTransitioning: true,
      sourceColor: params.dotColor,
      targetColor: targetColor,
      startTime: performance.now(),
      duration: duration
    });
  }, [params.dotColor]);
  const lastRenderTimeRef = useRef<number>(0);
  const framesCapturedRef = useRef<number>(0);
  const expectedFramesRef = useRef<number>(0);
  const nextFrameTimeRef = useRef<number>(0);
  const recordTimerRef = useRef<number | null>(null);
  // Safe callable refs to avoid TDZ on callbacks defined later
  const drawFnRef = useRef<() => void>(() => {});
  const stopRecordingRef = useRef<() => void>(() => {});
  const updateRecordingProgressRef = useRef<() => void>(() => {});
  // Adaptive rendering control
  const lastDrawDurationRef = useRef<number>(0);
  const renderStrideRef = useRef<number>(1); // draw every N ticks when heavy
  const tickIndexRef = useRef<number>(0);
  const accumulatorRef = useRef<number>(0);
  // Offscreen rendering for high resolutions
  const offscreenCanvasRef = useRef<HTMLCanvasElement | OffscreenCanvas | null>(null);
  const offscreenCtxRef = useRef<CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null>(null);
  const useOffscreenRef = useRef<boolean>(false);
  const renderScaleRef = useRef<number>(1);

  const calculateDotSize = useCallback((distance: number, maxDistance: number) => {
    const normalizedDistance = distance / maxDistance;
    let falloffFactor = 0;

    switch (params.falloffType) {
      case 'linear':
        falloffFactor = 1 - normalizedDistance;
        break;
      case 'exponential':
        falloffFactor = Math.exp(-normalizedDistance * params.falloffIntensity);
        break;
      case 'inverse-square':
        falloffFactor = 1 / (1 + normalizedDistance * params.falloffIntensity);
        break;
    }

    falloffFactor = Math.max(0, Math.min(1, falloffFactor));
    return params.minDotSize + (params.maxDotSize - params.minDotSize) * falloffFactor;
  }, [params.falloffType, params.falloffIntensity, params.minDotSize, params.maxDotSize]);

  // SVG mask loading function
  const loadSvgMask = useCallback(async (svgPath: string): Promise<HTMLImageElement | null> => {
    if (!svgPath || svgPath.trim() === '') {
      return null;
    }

    try {
      setMaskLoadError(null);
      
      // Create a new image element
      const img = new Image();
      
      // Return a promise that resolves when the image loads
      return new Promise((resolve, reject) => {
        img.onload = () => {
          resolve(img);
        };
        
        img.onerror = () => {
          const error = `Failed to load SVG: ${svgPath}`;
          setMaskLoadError(error);
          reject(new Error(error));
        };
        
        // For SVG files, we need to handle them differently
        if (svgPath.endsWith('.svg')) {
          // Try to load as a direct URL first
          fetch(svgPath)
            .then(response => {
              if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
              }
              return response.text();
            })
            .then(svgText => {
              // Create a blob URL from the SVG text
              const blob = new Blob([svgText], { type: 'image/svg+xml' });
              const url = URL.createObjectURL(blob);
              img.src = url;
              
              // Clean up the blob URL after loading
              img.onload = () => {
                URL.revokeObjectURL(url);
                resolve(img);
              };
            })
            .catch(error => {
              setMaskLoadError(`Failed to fetch SVG: ${error.message}`);
              reject(error);
            });
        } else {
          // For non-SVG images, load directly
          img.src = svgPath;
        }
      });
    } catch (error) {
      const errorMsg = `Error loading mask: ${error instanceof Error ? error.message : 'Unknown error'}`;
      setMaskLoadError(errorMsg);
      return null;
    }
  }, []);

  // Load mask when SVG path changes
  useEffect(() => {
    if (params.maskEnabled && params.maskSvgPath) {
      loadSvgMask(params.maskSvgPath)
        .then(img => {
          maskImageRef.current = img;
        })
        .catch(error => {
          console.error('Failed to load SVG mask:', error);
          maskImageRef.current = null;
        });
    } else {
      maskImageRef.current = null;
      setMaskLoadError(null);
    }
  }, [params.maskEnabled, params.maskSvgPath, loadSvgMask]);

  // Video recording functions
  const startRecording = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas || !onRecordingProgress || !onRecordingComplete) return;

    try {
      // Get the canvas stream
      // Use manual frame pacing by requesting frames; pass 0 to avoid internal cadence
      const stream = canvas.captureStream(0);
      // Save track for manual frame requests
      const track = stream.getVideoTracks()[0] || null;
      if (track) {
        // Hint the encoder that this is motion (animation), not static detail
        try { (track as any).contentHint = 'motion'; } catch (_) {}
        // Do not force track frameRate; we'll drive frames manually
      }
      captureTrackRef.current = track || null;
      
      // Reset recorded chunks
      recordedChunksRef.current = [];
      recordingStartTimeRef.current = performance.now();
      
      // Calculate bitrate scaled by resolution and fps
      const pixels = width * height;
      // Auto-clamp FPS for very large canvases to improve stability
      let fps = Math.max(1, params.frameRate);
      const megaPixels = pixels / 1_000_000;
      if (megaPixels > 8 && fps > 30) {
        fps = 30;
      }
      const bitsPerPixelPerFrame = fps > 45 ? 0.08 : 0.06; // heuristic bpp
      let bitrate = Math.floor(pixels * fps * bitsPerPixelPerFrame); // bits/sec
      // Clamp bitrate to reasonable bounds
      bitrate = Math.max(2_000_000, Math.min(bitrate, 45_000_000));
      
      // Try codecs in order of preference for best compatibility
      const codecs = [
        'video/webm;codecs=vp8', // VP8 often smoother at lower framerates
        'video/webm;codecs=vp9', // VP9 higher quality but more processing
        'video/webm' // Fallback without codec specification
      ];
      
      let mediaRecorder: MediaRecorder;
      for (const mimeType of codecs) {
        try {
          if (MediaRecorder.isTypeSupported(mimeType)) {
            mediaRecorder = new MediaRecorder(stream, {
              mimeType,
              videoBitsPerSecond: bitrate
            });
            break;
          }
        } catch (e) {
          continue;
        }
      }
      
      // Final fallback if no codecs worked
      if (!mediaRecorder!) {
        mediaRecorder = new MediaRecorder(stream);
      }
      
      mediaRecorderRef.current = mediaRecorder;
      
      // Handle data available
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };
      
      // Handle recording stop
      mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, {
          type: 'video/webm'
        });
        onRecordingComplete(blob);
        // Reset capture state
        isRecordingActiveRef.current = false;
        captureTrackRef.current = null;
      };
      
      // Start recording with a small timeslice to ensure chunks flush reliably
      mediaRecorder.start(250);
      const startMsg = megaPixels > 8 && params.frameRate > 30
        ? `Recording started (auto 30fps for large canvas)`
        : 'Recording started...';
      onRecordingProgress(0, startMsg);
      
      // Initialize fixed-FPS cadence
      frameIntervalRef.current = 1000 / fps;
      const now = performance.now();
      lastRenderTimeRef.current = now;
      nextFrameTimeRef.current = now + frameIntervalRef.current;
      framesCapturedRef.current = 0;
      expectedFramesRef.current = Math.round(fps * params.loopDuration * params.loopCycles);
      isRecordingActiveRef.current = true;
      renderStrideRef.current = 1;
      tickIndexRef.current = 0;

      // Setup offscreen rendering for very large canvases
      useOffscreenRef.current = megaPixels > 8; // enable for >8MP
      renderScaleRef.current = useOffscreenRef.current ? 0.5 : 1; // scale to 50% for heavy sizes
      if (useOffscreenRef.current) {
        try {
          const scaledW = Math.max(1, Math.floor(width * renderScaleRef.current));
          const scaledH = Math.max(1, Math.floor(height * renderScaleRef.current));
          const c = (typeof OffscreenCanvas !== 'undefined')
            ? new OffscreenCanvas(scaledW, scaledH)
            : (() => { const el = document.createElement('canvas'); el.width = scaledW; el.height = scaledH; return el; })();
          const oc = c.getContext('2d');
          offscreenCanvasRef.current = c as any;
          offscreenCtxRef.current = oc as any;
        } catch (_) {
          useOffscreenRef.current = false;
          offscreenCanvasRef.current = null;
          offscreenCtxRef.current = null;
        }
      } else {
        offscreenCanvasRef.current = null;
        offscreenCtxRef.current = null;
      }

      // Use rAF-driven scheduler with fixed-step accumulator
      accumulatorRef.current = 0;

    } catch (error) {
      console.error('Failed to start recording:', error);
      onRecordingProgress(0, 'Recording failed to start');
    }
  }, [onRecordingProgress, onRecordingComplete, params.frameRate, params.loopDuration, params.loopCycles]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    if (recordTimerRef.current !== null) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    isRecordingActiveRef.current = false;
    useOffscreenRef.current = false;
    offscreenCanvasRef.current = null;
    offscreenCtxRef.current = null;
  }, []);

  // Keep callable refs in sync
  useEffect(() => { stopRecordingRef.current = stopRecording; }, [stopRecording]);

  const updateRecordingProgress = useCallback(() => {
    if (!params.isRecording || !onRecordingProgress) return;
    
    let progress: number;
    if (isRecordingActiveRef.current && expectedFramesRef.current > 0) {
      // Frame-accurate progress while recording
      progress = Math.min(100, (framesCapturedRef.current / expectedFramesRef.current) * 100);
    } else {
      const totalDuration = params.loopDuration * params.loopCycles;
      const elapsed = (performance.now() - recordingStartTimeRef.current) / 1000;
      progress = Math.min(100, (elapsed / totalDuration) * 100);
    }
    
    const totalDuration = params.loopDuration * params.loopCycles;
    const elapsed = (performance.now() - recordingStartTimeRef.current) / 1000;
    onRecordingProgress(progress, `Recording: ${elapsed.toFixed(1)}s / ${totalDuration.toFixed(1)}s`);
    
    // Auto-stop when complete
    if (progress >= 100) {
      stopRecording();
    }
  }, [params.isRecording, params.loopDuration, params.loopCycles, onRecordingProgress, stopRecording]);

  // Sync progress updater ref
  useEffect(() => { updateRecordingProgressRef.current = updateRecordingProgress; }, [updateRecordingProgress]);

  const generateSVG = useCallback(async (optimize: boolean = false) => {
    const spacing = Math.max(1, Math.floor(Math.min(width, height) / params.gridDensity));
    const centerX = (params.centerX / 100) * width;
    const centerY = (params.centerY / 100) * height;
    const maxDistance = Math.sqrt(Math.pow(width/2, 2) + Math.pow(height/2, 2));
    const clipRadius = params.circularRadius;

    // Audio influence calculation (use current audio data if available)
    let audioInfluence = 1;
    if (params.audioEnabled) {
      const bassLevel = audioData.bassLevel * params.bassInfluence;
      const midLevel = audioData.midLevel * params.midInfluence;
      const trebleLevel = audioData.trebleLevel * params.trebleInfluence;
      audioInfluence = 1 + (bassLevel + midLevel + trebleLevel) * params.audioSensitivity;
    }

    // Collect all circles first
    const circleData: Array<{x: number, y: number, r: number}> = [];
    
    for (let x = spacing / 2; x < width; x += spacing) {
      for (let y = spacing / 2; y < height; y += spacing) {
        const distance = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2));
        
        let dotSize = calculateDotSize(distance, maxDistance);
        
        // Apply audio influence
        if (params.audioEnabled) {
          dotSize *= audioInfluence;
        }
        
        // Skip dots that would extend beyond circular boundary
        if (distance + dotSize / 2 > clipRadius) continue;
        
        if (dotSize > 0.1) {
          circleData.push({x, y, r: dotSize / 2});
        }
      }
    }

    // Union-Find helper class for grouping overlapping circles
    class UnionFind {
      private parent: number[];
      private rank: number[];

      constructor(size: number) {
        this.parent = Array.from({ length: size }, (_, i) => i);
        this.rank = new Array(size).fill(0);
      }

      find(x: number): number {
        if (this.parent[x] !== x) {
          this.parent[x] = this.find(this.parent[x]);
        }
        return this.parent[x];
      }

      union(x: number, y: number): void {
        const rootX = this.find(x);
        const rootY = this.find(y);

        if (rootX !== rootY) {
          if (this.rank[rootX] < this.rank[rootY]) {
            this.parent[rootX] = rootY;
          } else if (this.rank[rootX] > this.rank[rootY]) {
            this.parent[rootY] = rootX;
          } else {
            this.parent[rootY] = rootX;
            this.rank[rootX]++;
          }
        }
      }

      getGroups(): Map<number, number[]> {
        const groups = new Map<number, number[]>();
        for (let i = 0; i < this.parent.length; i++) {
          const root = this.find(i);
          if (!groups.has(root)) {
            groups.set(root, []);
          }
          groups.get(root)!.push(i);
        }
        return groups;
      }
    }

    // Interface definitions
    interface Circle {
      x: number;
      y: number;
      r: number;
    }

    function circleToPolygon(circle: Circle, segments: number = 32): number[][][] {
      const polygon: number[][] = [];
      for (let i = 0; i < segments; i++) {
        const angle = (2 * Math.PI * i) / segments;
        const x = circle.x + circle.r * Math.cos(angle);
        const y = circle.y + circle.r * Math.sin(angle);
        polygon.push([x, y]);
      }
      // Ensure the polygon is properly closed for Martinez
      if (polygon.length > 0) {
        const first = polygon[0];
        const last = polygon[polygon.length - 1];
        // Only add closing point if it's not already there
        if (first[0] !== last[0] || first[1] !== last[1]) {
          polygon.push([first[0], first[1]]);
        }
      }
      // Return in Martinez MultiPolygon format: [[[ring1], [hole1], [hole2]], [[ring2]]]
      return [polygon] as any;
    }

    function polygonToPath(polygon: any): string {
      if (!polygon || polygon.length === 0) return '';
      
      // Martinez returns MultiPolygon format: [[[outer_ring], [hole1], [hole2]], [[outer_ring2], ...]]
      // For boolean union, we only want the outer perimeters (first ring of each polygon)
      
      let pathData = '';
      
      // Handle both MultiPolygon and simple Polygon formats
      const polygons = Array.isArray(polygon[0][0][0]) ? polygon : [polygon];
      
      for (const poly of polygons) {
        if (!poly || poly.length === 0) continue;
        
        // Only take the first ring (outer boundary), skip holes for clean union
        const outerRing = poly[0];
        if (!outerRing || outerRing.length < 3) continue;
        
        pathData += `M ${outerRing[0][0]},${outerRing[0][1]}`;
        for (let i = 1; i < outerRing.length - 1; i++) {
          pathData += ` L ${outerRing[i][0]},${outerRing[i][1]}`;
        }
        pathData += ' Z ';
      }
      
      return pathData.trim();
    }

    function calculateUnionPath(circles: Circle[], progressCallback?: (progress: number, status: string) => void): Promise<string> {
      return new Promise((resolve) => {
        if (circles.length === 1) {
          const c = circles[0];
          resolve(`M ${c.x - c.r},${c.y} A ${c.r},${c.r} 0 1,0 ${c.x + c.r},${c.y} A ${c.r},${c.r} 0 1,0 ${c.x - c.r},${c.y} Z`);
          return;
        }

        progressCallback?.(0, 'Converting circles to polygons...');
        
        // Convert circles to high-resolution polygons for precise boolean operations
        const segments = Math.max(16, Math.min(64, Math.ceil(circles.reduce((max, c) => Math.max(max, c.r), 0) / 2)));
        console.log(`Processing ${circles.length} overlapping circles with ${segments} segments each`);
        let unionPolygon: any = null;
        
        const processCircle = async (i: number) => {
          if (i >= circles.length) {
            progressCallback?.(100, 'Generating final path...');
            
            if (!unionPolygon || unionPolygon.length === 0) {
              // Fallback: use the largest circle
              const largest = circles.reduce((max, c) => c.r > max.r ? c : max);
              resolve(`M ${largest.x - largest.r},${largest.y} A ${largest.r},${largest.r} 0 1,0 ${largest.x + largest.r},${largest.y} A ${largest.r},${largest.r} 0 1,0 ${largest.x - largest.r},${largest.y} Z`);
              return;
            }
            
            resolve(polygonToPath(unionPolygon));
            return;
          }
          
          const progress = (i / circles.length) * 100;
          progressCallback?.(progress, `Processing circle ${i + 1} of ${circles.length}...`);
          
          const circlePolygon = circleToPolygon(circles[i], segments);
          
          if (unionPolygon === null) {
            unionPolygon = circlePolygon;
          } else {
            try {
              // Use Martinez polygon clipping for precise boolean union
              const result = martinez.union(unionPolygon, circlePolygon);
              if (result && result.length > 0) {
                unionPolygon = result;
                // Debug: Log the structure of the result to understand the format
                if (i < 3) { // Only log first few operations for debugging
                  console.log(`Union result ${i}:`, result.length, 'polygons');
                }
              }
            } catch (error) {
              console.warn('Boolean union failed, skipping circle:', error);
            }
          }
          
          // Allow UI updates between processing
          setTimeout(() => processCircle(i + 1), 1);
        };
        
        processCircle(0);
      });
    }

    let circles = '';

    if (optimize && circleData.length > 0) {
      setIsOptimizing(true);
      onOptimizationProgress?.(0, 'Starting optimization...');
      
      try {
        // Step 1: Find all connected components using Union-Find
        onOptimizationProgress?.(10, 'Analyzing overlapping circles...');
        const uf = new UnionFind(circleData.length);

        // Connect overlapping circles
        for (let i = 0; i < circleData.length; i++) {
          for (let j = i + 1; j < circleData.length; j++) {
            const circle1 = circleData[i];
            const circle2 = circleData[j];
            const distance = Math.sqrt(Math.pow(circle1.x - circle2.x, 2) + Math.pow(circle1.y - circle2.y, 2));
            
            // Check if circles overlap (distance < sum of radii)
            if (distance < (circle1.r + circle2.r)) {
              uf.union(i, j);
            }
          }
        }

        // Step 2: Group circles and create paths for overlapping groups
        onOptimizationProgress?.(30, 'Creating shape groups...');
        const groups = uf.getGroups();
        const groupArray = Array.from(groups.entries());
        
        const processGroups = async () => {
          for (let g = 0; g < groupArray.length; g++) {
            const [, indices] = groupArray[g];
            const progress = 30 + (g / groupArray.length) * 60;
            
            if (indices.length > 1) {
              // Multiple overlapping circles - create a unified path with hole preservation
              onOptimizationProgress?.(progress, `Processing group ${g + 1} of ${groupArray.length} (${indices.length} circles)...`);
              const groupCircles = indices.map(idx => circleData[idx]);
              const pathData = await calculateUnionPath(groupCircles, (subProgress, status) => {
                onOptimizationProgress?.(progress + (subProgress / 100) * (60 / groupArray.length), status);
              });
              circles += `<path d="${pathData}" fill="${params.dotColor}" fill-rule="nonzero" />\n`;
            } else {
              // Single circle, not overlapping
              const circle = circleData[indices[0]];
              circles += `<circle cx="${circle.x}" cy="${circle.y}" r="${circle.r}" fill="${params.dotColor}" />\n`;
            }
          }
        };
        
        await processGroups();
        
        onOptimizationProgress?.(100, 'Optimization complete!');
      } catch (error) {
        console.error('Optimization failed:', error);
        onOptimizationProgress?.(100, 'Optimization failed, using fallback...');
        // Fallback to individual circles
        for (const circle of circleData) {
          circles += `<circle cx="${circle.x}" cy="${circle.y}" r="${circle.r}" fill="${params.dotColor}" />\n`;
        }
      } finally {
        setIsOptimizing(false);
      }
    } else {
      // No optimization: render all circles individually
      for (const circle of circleData) {
        circles += `<circle cx="${circle.x}" cy="${circle.y}" r="${circle.r}" fill="${params.dotColor}" />\n`;
      }
    }

    const svgString = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${width}" height="${height}" fill="${params.backgroundColor}" />
  ${circles}
</svg>`;

    return svgString;
  }, [params, width, height, calculateDotSize, audioData]);

  // (moved below drawHalftone definition)

  const drawHalftone = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const mainCtx = canvas.getContext('2d');
    if (!mainCtx) return;

    // Choose target context (offscreen for heavy resolutions during recording)
    const targetCtx = (params.isRecording && useOffscreenRef.current && offscreenCtxRef.current)
      ? (offscreenCtxRef.current as CanvasRenderingContext2D)
      : (mainCtx as CanvasRenderingContext2D);

    // Apply scale transform if drawing to offscreen
    const useScale = (params.isRecording && useOffscreenRef.current && renderScaleRef.current !== 1);
    if (useScale) {
      targetCtx.save();
      targetCtx.setTransform(renderScaleRef.current, 0, 0, renderScaleRef.current, 0, 0);
    }

    // Clear canvas (respect transparent background)
    if (params.backgroundColor === 'transparent') {
      targetCtx.clearRect(0, 0, width, height);
    } else {
      targetCtx.fillStyle = params.backgroundColor;
      targetCtx.fillRect(0, 0, width, height);
    }

    // Calculate grid parameters
    const spacing = Math.max(1, Math.floor(Math.min(width, height) / params.gridDensity));
    const centerX = (params.centerX / 100) * width;
    const centerY = (params.centerY / 100) * height;
    const maxDistance = Math.sqrt(Math.pow(width/2, 2) + Math.pow(height/2, 2));
    
    // Calculate circular clipping radius
    const clipRadius = params.circularRadius;

    // Update time for animation
    timeRef.current += 0.016; // Assuming ~60fps

    // Update recording progress if recording
    if (params.isRecording) {
      updateRecordingProgress();
    }

    // Initialize and update animation managers based on mode
    if (params.loopingMode) {
      // Looping mode - initialize loop managers
      if (params.loopAnimationType === 'pulse') {
        if (!loopPulseManagerRef.current) {
          loopPulseManagerRef.current = new LoopPulseManager(centerX, centerY, clipRadius, params.loopDuration, params.loopCycles);
        } else {
          loopPulseManagerRef.current.updateCenter(centerX, centerY, clipRadius);
          loopPulseManagerRef.current.updateParams(
            params.loopDuration,
            params.loopCycles,
            params.audioSensitivity, // Repurposed as animation intensity
            params.bassInfluence,    // Repurposed as expansion speed
            params.pulseMaxRadius,   // Pulse radius control
            params.pulseFalloffWidth // Pulse falloff width control
          );
        }
      } else if (params.loopAnimationType === 'ripple') {
        if (!loopRippleManagerRef.current) {
          loopRippleManagerRef.current = new LoopRippleManager(centerX, centerY, clipRadius, params.loopDuration, params.loopCycles, width, height);
        } else {
          loopRippleManagerRef.current.updateCenter(centerX, centerY, clipRadius, width, height);
          loopRippleManagerRef.current.updateParams(
            params.loopDuration,
            params.loopCycles,
            params.audioSensitivity, // Repurposed as animation intensity
            params.midInfluence,     // Repurposed as ripple frequency
            params.trebleInfluence,  // Repurposed as detail variation
            params.rippleRingWidth,  // Ring width control
            params.rippleIntensity,  // Ring intensity control
            params.rippleFalloffSharpness, // Falloff sharpness control
            params.rippleCyclePause  // Cycle pause control
          );
        }
        loopRippleManagerRef.current.update();
      }
    } else {
      // Audio reactive mode - initialize audio managers
      if (!waveManagerRef.current) {
        waveManagerRef.current = new WaveManager(centerX, centerY, clipRadius);
      } else {
        waveManagerRef.current.updateCenter(centerX, centerY, clipRadius);
      }
      
      if (!rippleManagerRef.current) {
        rippleManagerRef.current = new RippleManager(centerX, centerY, clipRadius);
      } else {
        rippleManagerRef.current.updateCenter(centerX, centerY, clipRadius);
      }

      // Update animation systems if audio is enabled
      if (params.audioEnabled && audioData) {
        // Update wave manager for wave and combined modes
        if ((params.audioAnimationMode === 'wave' || params.audioAnimationMode === 'combined') && waveManagerRef.current) {
          waveManagerRef.current.update(
            audioData, 
            params.audioSensitivity,
            params.bassInfluence,
            params.midInfluence,
            params.trebleInfluence
          );
        }
        
        // Update ripple manager for ripple and combined modes
        if ((params.audioAnimationMode === 'ripple' || params.audioAnimationMode === 'combined') && rippleManagerRef.current) {
          rippleManagerRef.current.update(
            audioData, 
            params.audioSensitivity,
            params.bassInfluence,
            params.midInfluence,
            params.trebleInfluence
          );
        }
      }
    }

    // Calculate animation effects based on mode
    let pulseMultiplier = 1;

    if (params.loopingMode) {
      // Apply looping animation effects
      if (params.loopAnimationType === 'pulse' && loopPulseManagerRef.current) {
        // Pulse will be calculated per-dot with position to respect pulse reach setting
      } else if (params.loopAnimationType === 'ripple' && loopRippleManagerRef.current) {
        // Ripple effect will be applied per dot
      }
    } else {
      // Apply audio reactive effects
      const bassPulse = (params.audioEnabled && audioData && 
                        (params.audioAnimationMode === 'pulse' || params.audioAnimationMode === 'combined')) ? 
        1 + (audioData.bassLevel * params.bassInfluence * 0.5) : 
        1;
      pulseMultiplier = bassPulse;
    }

    // Draw dots
    // Handle color transitions
    let currentColor = params.dotColor;
    if (colorTransition?.isTransitioning) {
      const now = performance.now();
      const elapsed = now - colorTransition.startTime;
      const progress = Math.min(elapsed / colorTransition.duration, 1);
      
      if (progress >= 1) {
        // Transition complete
        currentColor = colorTransition.targetColor;
        setColorTransition(null);
      } else {
        // Interpolate color
        currentColor = lerpColor(colorTransition.sourceColor, colorTransition.targetColor, progress);
      }
    }
    
    targetCtx.fillStyle = currentColor;
    // Batch draw all dots in a single path for performance
    targetCtx.beginPath();
    for (let x = spacing / 2; x < width; x += spacing) {
      for (let y = spacing / 2; y < height; y += spacing) {
        const distance = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2));
        
        let dotX = x;
        let dotY = y;
        let dotSize;
        
        if (params.loopingMode) {
          // Looping mode animations with falloff gradient
          // Start with base falloff gradient size
          const baseDotSize = calculateDotSize(distance, maxDistance);
          
          if (params.loopAnimationType === 'pulse') {
            // Apply pulse animation effect on top of falloff gradient
            if (loopPulseManagerRef.current) {
              const pulseMod = loopPulseManagerRef.current.getPulseMultiplier(x, y);
              dotSize = baseDotSize * pulseMod;
            } else {
              dotSize = baseDotSize;
            }
          } else if (params.loopAnimationType === 'ripple' && loopRippleManagerRef.current) {
            // Apply ripple animation effect on top of falloff gradient
            const loopRippleEffect = loopRippleManagerRef.current.getRippleDisplacement(x, y);
            // Combine multiplicative and additive effects for better visibility on small dots
            const rippleBoost = (loopRippleEffect.sizeModulation - 1.0) * params.maxDotSize * params.rippleBoostAmount;
            dotSize = baseDotSize * loopRippleEffect.sizeModulation + rippleBoost;
          } else {
            // Fallback for any other animation types
            dotSize = baseDotSize;
          }
        } else {
          // Audio reactive mode - use default gradient calculation
          dotSize = calculateDotSize(distance, maxDistance);
          // Audio reactive mode animations
          
          // Apply bass pulse (overall breathing effect) - for pulse and combined modes
          if (params.audioAnimationMode === 'pulse' || params.audioAnimationMode === 'combined') {
            dotSize *= pulseMultiplier;
          }
          
          // Apply direct audio response for pulse mode
          if (params.audioEnabled && audioData && params.audioAnimationMode === 'pulse') {
            const totalAudioLevel = (audioData.bassLevel + audioData.midLevel + audioData.trebleLevel) / 3;
            dotSize *= (1 + totalAudioLevel * params.audioSensitivity * 2);
          }
          
          // Apply wave influence for wave and combined modes
          if (params.audioEnabled && waveManagerRef.current && 
             (params.audioAnimationMode === 'wave' || params.audioAnimationMode === 'combined')) {
            const waveInfluence = waveManagerRef.current.getWaveInfluence(x, y);
            dotSize *= (1 + waveInfluence * params.audioSensitivity);
          }
          
          // Apply ripple displacement for ripple and combined modes
          if (params.audioEnabled && rippleManagerRef.current && 
             (params.audioAnimationMode === 'ripple' || params.audioAnimationMode === 'combined')) {
            const rippleEffect = rippleManagerRef.current.getRippleDisplacement(x, y);
            // Apply vertical displacement to create water-like effect
            dotY += rippleEffect.displacement * 0.08; // Fine-tuned displacement scaling
            // Apply frequency-specific size modulation
            dotSize *= rippleEffect.sizeModulation * params.audioSensitivity;
          }
          
          // Add treble jitter effect
          if (params.audioEnabled && audioData && audioData.trebleLevel > 0.05) {
            const jitterAmount = audioData.trebleLevel * params.trebleInfluence * 0.2;
            const jitterX = (Math.random() - 0.5) * jitterAmount * spacing;
            const jitterY = (Math.random() - 0.5) * jitterAmount * spacing;
            
            // Apply jitter to position (small random displacement)
            const jitteredDistance = Math.sqrt(
              Math.pow((x + jitterX) - centerX, 2) + Math.pow((y + jitterY) - centerY, 2)
            );
            
            // Recalculate size with jittered position for subtle variation
            if (Math.abs(jitteredDistance - distance) < spacing * 0.5) {
              dotSize *= (1 + jitterAmount);
            }
          }
        }
        
        // Skip dots that would extend beyond circular boundary
        if (distance + dotSize / 2 > clipRadius) continue;
        
        if (dotSize > 0.1) {
          targetCtx.moveTo(dotX + dotSize / 2, dotY);
          targetCtx.arc(dotX, dotY, dotSize / 2, 0, Math.PI * 2);
        }
      }
    }
    targetCtx.fill();
    
    // Apply SVG mask cutout
    if (params.maskEnabled && maskImageRef.current) {
      // Save the current composite operation and context
      const originalCompositeOperation = targetCtx.globalCompositeOperation;
      targetCtx.save();
      
      // Use destination-out to cut out the mask shape, revealing the background
      targetCtx.globalCompositeOperation = 'destination-out';
      
      // Calculate mask center position
      const halftoneX = (params.centerX / 100) * width;
      const halftoneY = (params.centerY / 100) * height;
      
      // Apply rotation if in thinking state
      if (params.isThinking && params.maskRotationStartTime) {
        const rotation = calculateMaskRotation(params.maskRotationStartTime);
        const rotationRadians = (rotation * Math.PI) / 180;
        
        // Translate to mask center, rotate, then translate back
        targetCtx.translate(halftoneX, halftoneY);
        targetCtx.rotate(rotationRadians);
        targetCtx.translate(-params.maskSize / 2, -params.maskSize / 2);
      } else {
        // No rotation, just position normally
        targetCtx.translate(halftoneX - params.maskSize / 2, halftoneY - params.maskSize / 2);
      }
      
      // Draw the mask image at origin (transforms already applied)
      targetCtx.drawImage(maskImageRef.current, 0, 0, params.maskSize, params.maskSize);
      
      // Restore context and composite operation
      targetCtx.restore();
      targetCtx.globalCompositeOperation = originalCompositeOperation;
    }
    
    // Visual debug indicators (top-left corner)
    if (params.audioEnabled && audioData && (window as any).AUDIO_DEBUG) {
      targetCtx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      targetCtx.font = '12px monospace';
      targetCtx.fillText(`Audio: B:${(audioData.bassLevel * 100).toFixed(1)}% M:${(audioData.midLevel * 100).toFixed(1)}% T:${(audioData.trebleLevel * 100).toFixed(1)}%`, 10, 20);
      targetCtx.fillText(`Mode: ${params.audioAnimationMode} | Pulse: ${pulseMultiplier.toFixed(2)}x`, 10, 35);
      targetCtx.fillText(`Waves: ${waveManagerRef.current?.getActiveWaves().length || 0} | Ripples: ${rippleManagerRef.current?.getActiveRipples().length || 0}`, 10, 50);
      targetCtx.fillText(`Time: ${timeRef.current.toFixed(1)} | Frame: ${Math.floor(timeRef.current / 0.016)}`, 10, 65);
    }
    
    // Display mask loading error if any
    if (maskLoadError) {
      targetCtx.fillStyle = 'rgba(255, 0, 0, 0.8)';
      targetCtx.font = '12px monospace';
      targetCtx.fillText(`Mask Error: ${maskLoadError}`, 10, height - 20);
    }
    
    // If we drew to offscreen, composite to main canvas
    if (useScale) {
      targetCtx.restore();
      mainCtx.save();
      mainCtx.setTransform(1, 0, 0, 1, 0, 0);
      mainCtx.clearRect(0, 0, width, height);
      const off = offscreenCanvasRef.current as any;
      if (off) {
        mainCtx.drawImage(off, 0, 0, (off.width || width * renderScaleRef.current), (off.height || height * renderScaleRef.current), 0, 0, width, height);
      }
      mainCtx.restore();
    }
  }, [params, width, height, calculateDotSize, audioData]);

  // Sync draw function ref after drawHalftone is defined
  useEffect(() => { drawFnRef.current = drawHalftone; }, [drawHalftone]);

  // Measure draw cost to adapt stride
  useEffect(() => {
    const original = drawFnRef.current;
    drawFnRef.current = () => {
      const start = performance.now();
      original();
      const end = performance.now();
      lastDrawDurationRef.current = end - start;
      // If drawing is heavier than our frame interval, reduce draw frequency
      if (frameIntervalRef.current > 0) {
        const ratio = lastDrawDurationRef.current / frameIntervalRef.current;
        renderStrideRef.current = Math.max(1, Math.ceil(ratio));
      }
    };
    return () => {
      // restore
      drawFnRef.current = original;
    };
  }, [drawHalftone]);

  const animate = useCallback(() => {
    const now = performance.now();
    if (params.isRecording && isRecordingActiveRef.current) {
      // rAF-driven fixed-step frame production at target FPS
      const dt = now - lastRenderTimeRef.current;
      lastRenderTimeRef.current = now;
      accumulatorRef.current += dt;
      if (accumulatorRef.current >= frameIntervalRef.current - 0.5) {
        // Decide whether to draw or duplicate last frame based on draw cost
        const shouldDraw = lastDrawDurationRef.current <= frameIntervalRef.current * 0.9;
        if (shouldDraw) {
          try { drawFnRef.current && drawFnRef.current(); } catch (_) {}
        }
        const t: any = captureTrackRef.current as any;
        if (t && typeof t.requestFrame === 'function') {
          try { t.requestFrame(); } catch (_) {}
        }
        framesCapturedRef.current += 1;
        accumulatorRef.current -= frameIntervalRef.current;
        // Update progress
        try { updateRecordingProgressRef.current && updateRecordingProgressRef.current(); } catch (_) {}
        if (expectedFramesRef.current > 0 && framesCapturedRef.current >= expectedFramesRef.current) {
          try { stopRecordingRef.current && stopRecordingRef.current(); } catch (_) {}
        }
      }
    } else {
      // Normal live preview at display refresh rate
      drawHalftone();
    }
    animationRef.current = requestAnimationFrame(animate);
  }, [drawHalftone, params.isRecording, stopRecording]);

  useEffect(() => {
    animate();
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [animate]);

  // Offline high-quality exporter using WebCodecs + MediaStreamTrackGenerator
  const startOfflineExport = useCallback(async () => {
    if (!onRecordingComplete || !onRecordingProgress) return;

    // Feature detection
    const hasGenerator = typeof (window as any).MediaStreamTrackGenerator === 'function';
    const hasVideoEncoder = typeof (window as any).VideoEncoder === 'function';
    if (!hasGenerator || !hasVideoEncoder) {
      onRecordingProgress(0, 'Offline export not supported in this browser');
      return;
    }

    const fps = Math.max(1, params.frameRate || 30);
    const totalFrames = Math.round(fps * params.loopDuration * params.loopCycles);

    // Prepare drawing surface (OffscreenCanvas preferred)
    const acc = (typeof OffscreenCanvas !== 'undefined')
      ? new OffscreenCanvas(width, height)
      : (() => { const c = document.createElement('canvas'); c.width = width; c.height = height; return c; })();
    const accCtx = (acc as any).getContext('2d', { alpha: false } as any);
    if (!accCtx) {
      onRecordingProgress(0, 'Failed to get 2D context for offline export');
      return;
    }
    const sam = (typeof OffscreenCanvas !== 'undefined')
      ? new OffscreenCanvas(width, height)
      : (() => { const c = document.createElement('canvas'); c.width = width; c.height = height; return c; })();
    const samCtx = (sam as any).getContext('2d', { alpha: false } as any);
    if (!samCtx) {
      onRecordingProgress(0, 'Failed to get 2D context (sample)');
      return;
    }

    // Deterministic ripple renderer per frame (loop mode, ripple only)
    const centerX = (params.centerX / 100) * width;
    const centerY = (params.centerY / 100) * height;
    const maxCanvasDimension = Math.max(width, height);
    const maxTravelDistance = maxCanvasDimension * 1.5;
    const spacing = Math.max(1, Math.floor(Math.min(width, height) / params.gridDensity));
    const ringWidth = params.rippleRingWidth;
    const ringIntensity = params.rippleIntensity;
    const baseBg = params.backgroundColor;
    // Handle color transitions for ripple animation too
    let dotColor = params.dotColor;
    if (colorTransition?.isTransitioning) {
      const now = performance.now();
      const elapsed = now - colorTransition.startTime;
      const progress = Math.min(elapsed / colorTransition.duration, 1);
      
      if (progress >= 1) {
        dotColor = colorTransition.targetColor;
      } else {
        dotColor = lerpColor(colorTransition.sourceColor, colorTransition.targetColor, progress);
      }
    }
    const clipRadius = params.circularRadius;

    function renderAtTime(targetCtx: CanvasRenderingContext2D, t: number) {
      const cycleElapsed = t % params.loopDuration;
      const speed = maxTravelDistance / params.loopDuration;
      const rippleRadius = speed * cycleElapsed;

      // Clear (respect transparent background)
      if (baseBg === 'transparent') {
        targetCtx.clearRect(0, 0, width, height);
      } else {
        targetCtx.fillStyle = baseBg;
        targetCtx.fillRect(0, 0, width, height);
      }

      // Draw dots (batched path)
      targetCtx.fillStyle = dotColor;
      targetCtx.beginPath();
      for (let x = spacing / 2; x < width; x += spacing) {
        for (let y = spacing / 2; y < height; y += spacing) {
          const dx = x - centerX;
          const dy = y - centerY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > clipRadius) continue;

          // Ripple ring size modulation (same as LoopRippleManager.getRippleDisplacement)
          let sizeMod = 0.3;
          const dFromRipple = Math.abs(dist - rippleRadius);
          if (dFromRipple < ringWidth) {
            const norm = dFromRipple / ringWidth;
            const gaussianFalloff = Math.exp(-((norm * 2.5) ** 2));
            sizeMod = Math.max(sizeMod, 0.3 + (ringIntensity - 0.3) * gaussianFalloff);
          }
          sizeMod = Math.max(0.2, Math.min(3.0, sizeMod));
          const dotSize = params.maxDotSize * sizeMod;
          if (dist + dotSize / 2 > clipRadius) continue;
          if (dotSize > 0.1) {
            targetCtx.moveTo(x + dotSize / 2, y);
            targetCtx.arc(x, y, dotSize / 2, 0, Math.PI * 2);
          }
        }
      }
      targetCtx.fill();

      // Apply mask if enabled
      if (params.maskEnabled && maskImageRef.current) {
        const originalCompositeOperation = targetCtx.globalCompositeOperation;
        targetCtx.save();
        targetCtx.globalCompositeOperation = 'destination-out';
        
        // Calculate mask center position
        const halftoneX = (params.centerX / 100) * width;
        const halftoneY = (params.centerY / 100) * height;
        
        // Apply rotation if in thinking state
        if (params.isThinking && params.maskRotationStartTime) {
          const rotation = calculateMaskRotation(params.maskRotationStartTime);
          const rotationRadians = (rotation * Math.PI) / 180;
          
          // Translate to mask center, rotate, then translate back
          targetCtx.translate(halftoneX, halftoneY);
          targetCtx.rotate(rotationRadians);
          targetCtx.translate(-params.maskSize / 2, -params.maskSize / 2);
        } else {
          // No rotation, just position normally
          targetCtx.translate(halftoneX - params.maskSize / 2, halftoneY - params.maskSize / 2);
        }
        
        // Draw the mask image at origin (transforms already applied)
        targetCtx.drawImage(maskImageRef.current, 0, 0, params.maskSize, params.maskSize);
        
        // Restore context and composite operation
        targetCtx.restore();
        targetCtx.globalCompositeOperation = originalCompositeOperation;
      }
    }

    // Setup MediaStreamTrackGenerator and recorder for muxing
    const generator: any = new (window as any).MediaStreamTrackGenerator({ kind: 'video' });
    const writable: WritableStreamDefaultWriter = (generator.writable as any).getWriter();
    const stream = new MediaStream([generator]);

    // Choose codec and bitrate
    const bitsPerPixelPerFrame = fps > 45 ? 0.08 : 0.06;
    let bitrate = Math.floor(width * height * fps * bitsPerPixelPerFrame);
    bitrate = Math.max(4_000_000, Math.min(bitrate, 45_000_000));
    const codecs = [
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm'
    ];

    let rec: MediaRecorder | null = null;
    for (const mt of codecs) {
      if ((window as any).MediaRecorder && MediaRecorder.isTypeSupported(mt)) {
        rec = new MediaRecorder(stream, { mimeType: mt, videoBitsPerSecond: bitrate });
        break;
      }
    }
    if (!rec) rec = new MediaRecorder(stream);

    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunks.push(e.data); };
    const stopped = new Promise<void>((resolve) => { rec!.onstop = () => resolve(); });
    // Start without timeslice so timestamps drive duration
    rec.start();
    onRecordingProgress(0, 'Offline encoding…');

    // Produce frames deterministically, but pace in wall time for MediaRecorder
    const frameDurationMs = 1000 / fps;
    const startedAt = performance.now();
    const samples = Math.max(1, Math.min(4, Math.floor(params.offlineTemporalSamples || 2))); // temporal supersampling 1-4
    for (let i = 0; i < totalFrames; i++) {
      // Accumulate samples into acc canvas (running average to keep full opacity)
      (accCtx as any).clearRect(0, 0, width, height);
      for (let s = 0; s < samples; s++) {
        const t = (i + (s + 0.5) / samples) / fps; // centered sampling
        renderAtTime(samCtx as any, t);
        if (s === 0) {
          (accCtx as any).globalCompositeOperation = 'copy';
          (accCtx as any).globalAlpha = 1;
          (accCtx as any).drawImage(sam as any, 0, 0);
        } else {
          (accCtx as any).globalCompositeOperation = 'source-over';
          (accCtx as any).globalAlpha = 1 / (s + 1); // running average weight
          (accCtx as any).drawImage(sam as any, 0, 0);
        }
      }
      (accCtx as any).globalAlpha = 1;
      (accCtx as any).globalCompositeOperation = 'source-over';

      const tsUs = Math.round((i / fps) * 1_000_000); // microseconds
      // Construct VideoFrame from canvas; fall back to ImageBitmap if needed
      let vf: any;
      try {
        vf = new (window as any).VideoFrame(acc as any, { timestamp: tsUs });
      } catch {
        const bmp = await createImageBitmap(acc as any);
        vf = new (window as any).VideoFrame(bmp, { timestamp: tsUs });
        (bmp as any).close?.();
      }
      await writable.write(vf);
      vf.close();

      // Progress update
      if (i % Math.max(1, Math.floor(totalFrames / 100)) === 0) {
        onRecordingProgress(Math.round((i / totalFrames) * 100), `Offline encoding… ${i}/${totalFrames}`);
      }

      // Pace frames in real time so MediaRecorder encodes at correct duration
      const targetTime = startedAt + (i + 1) * frameDurationMs;
      let now2 = performance.now();
      const sleepMs = targetTime - now2;
      if (sleepMs > 0) {
        await new Promise(r => setTimeout(r, sleepMs));
      } else {
        // If we are behind, yield at least a tick
        await new Promise(r => setTimeout(r, 0));
      }
    }

    await writable.close();
    rec.stop();
    await stopped;

    const blob = new Blob(chunks, { type: 'video/webm' });
    onRecordingComplete(blob);
    onRecordingProgress(100, 'Offline export complete');
  }, [params, width, height, onRecordingComplete, onRecordingProgress]);

  useEffect(() => {
    if (onExportSVG) {
      // Expose the generateSVG function to parent component
      (window as any).exportHalftoneSVG = async (optimize: boolean = false) => {
        const svgString = await generateSVG(optimize);
        onExportSVG(svgString);
      };
    }
  }, [generateSVG, onExportSVG]);

  useEffect(() => {
    // Expose recording functions to parent component
    (window as any).startHalftoneRecording = () => {
      if (params.loopingMode) {
        // Reset loop managers when starting recording
        if (loopPulseManagerRef.current) {
          loopPulseManagerRef.current.reset();
        }
        if (loopRippleManagerRef.current) {
          loopRippleManagerRef.current.reset();
        }
      }
      startRecording();
    };

    (window as any).stopHalftoneRecording = stopRecording;

    // Expose offline export function
    (window as any).startHalftoneOfflineExport = startOfflineExport;
    
    // Expose play control functions
    (window as any).playHalftoneLoop = () => {
      if (params.loopingMode) {
        // Reset loop managers when starting playback
        if (loopPulseManagerRef.current) {
          loopPulseManagerRef.current.reset();
        }
        if (loopRippleManagerRef.current) {
          loopRippleManagerRef.current.reset();
        }
      }
    };
    
    (window as any).pauseHalftoneLoop = () => {
      // Currently we don't pause the animation, but we could implement
      // pause functionality by stopping the animation loop if needed
    };
    
    // Expose color transition function
    (window as any).startColorTransition = startColorTransition;
  }, [startRecording, stopRecording, startOfflineExport, params.loopingMode, startColorTransition]);

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="halftone-canvas"
        style={{ width: '100vw', height: '100vh' }}
      />
      
      {/* Optimization Progress */}
      {isOptimizing && (
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm rounded-lg flex items-center justify-center">
          <div className="bg-card border border-border rounded-lg p-6 max-w-sm w-full mx-4 shadow-lg">
            <div className="text-center space-y-4">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
              <div>
                <h3 className="font-semibold text-lg">Optimizing SVG</h3>
                <p className="text-muted-foreground text-sm mt-1">
                  Creating precise shape unions while preserving holes...
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
