import React from 'react';
import { HalftoneParams } from './HalftoneCanvas';

interface SimpleControlPanelProps {
  params: HalftoneParams;
  onParamsChange: (params: HalftoneParams) => void;
  onAudioToggle?: (enabled: boolean) => void;
  onEnd: () => void;
}

const SimpleControlPanel: React.FC<SimpleControlPanelProps> = ({
  params,
  onParamsChange,
  onAudioToggle,
  onEnd
}) => {
  const updateParam = <K extends keyof HalftoneParams>(
    key: K,
    value: HalftoneParams[K]
  ) => {
    onParamsChange({ ...params, [key]: value });
  };

  return (
    <div className="control-panel">
      <h3>Halftone Controls</h3>
      
      <div className="control-group">
        <label>
          Center X: {params.centerX}%
          <input
            type="range"
            min="0"
            max="100"
            value={params.centerX}
            onChange={(e) => updateParam('centerX', parseInt(e.target.value))}
          />
        </label>
      </div>

      <div className="control-group">
        <label>
          Center Y: {params.centerY}%
          <input
            type="range"
            min="0"
            max="100"
            value={params.centerY}
            onChange={(e) => updateParam('centerY', parseInt(e.target.value))}
          />
        </label>
      </div>

      <div className="control-group">
        <label>
          Grid Density: {params.gridDensity}
          <input
            type="range"
            min="10"
            max="100"
            value={params.gridDensity}
            onChange={(e) => updateParam('gridDensity', parseInt(e.target.value))}
          />
        </label>
      </div>

      <div className="control-group">
        <label>
          Max Dot Size: {params.maxDotSize}px
          <input
            type="range"
            min="1"
            max="100"
            value={params.maxDotSize}
            onChange={(e) => updateParam('maxDotSize', parseInt(e.target.value))}
          />
        </label>
      </div>

      <div className="control-group">
        <label>
          Falloff Type
          <select 
            value={params.falloffType}
            onChange={(e) => updateParam('falloffType', e.target.value as any)}
            style={{
              width: '100%',
              padding: '4px',
              marginTop: '5px',
              background: '#333',
              color: 'white',
              border: '1px solid #555',
              borderRadius: '4px'
            }}
          >
            <option value="linear">Linear</option>
            <option value="exponential">Exponential</option>
            <option value="inverse-square">Inverse Square</option>
          </select>
        </label>
      </div>

      <div className="control-group">
        <label>
          Falloff Intensity: {params.falloffIntensity.toFixed(1)}
          <input
            type="range"
            min="0.1"
            max="10"
            step="0.1"
            value={params.falloffIntensity}
            onChange={(e) => updateParam('falloffIntensity', parseFloat(e.target.value))}
          />
        </label>
      </div>

      <div className="control-group">
        <label>
          Circular Radius: {params.circularRadius}px
          <input
            type="range"
            min="100"
            max="800"
            value={params.circularRadius}
            onChange={(e) => updateParam('circularRadius', parseInt(e.target.value))}
          />
        </label>
      </div>

      <div className="control-group">
        <label>
          <input
            type="checkbox"
            checked={params.audioEnabled}
            onChange={(e) => {
              updateParam('audioEnabled', e.target.checked);
              if (onAudioToggle) {
                onAudioToggle(e.target.checked);
              }
            }}
          />
          Enable Audio Reactive
        </label>
      </div>

      {params.audioEnabled && (
        <>
          <div className="control-group">
            <label>
              Animation Mode
              <select 
                value={params.audioAnimationMode}
                onChange={(e) => updateParam('audioAnimationMode', e.target.value as any)}
                style={{
                  width: '100%',
                  padding: '4px',
                  marginTop: '5px',
                  background: '#333',
                  color: 'white',
                  border: '1px solid #555',
                  borderRadius: '4px'
                }}
              >
                <option value="pulse">Pulse - Breathing effect</option>
                <option value="ripple">Ripple - Water-like waves</option>
                <option value="wave">Wave - Expanding circles</option>
                <option value="combined">Combined - All effects</option>
              </select>
            </label>
          </div>

          <div className="control-group">
            <label>
              Audio Sensitivity: {params.audioSensitivity.toFixed(1)}
              <input
                type="range"
                min="0.1"
                max="5"
                step="0.1"
                value={params.audioSensitivity}
                onChange={(e) => updateParam('audioSensitivity', parseFloat(e.target.value))}
              />
            </label>
          </div>

          {/* Frequency Controls - Show all for most modes */}
          <div className="control-group">
            <label>
              Bass Influence: {params.bassInfluence.toFixed(1)}
              <input
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={params.bassInfluence}
                onChange={(e) => updateParam('bassInfluence', parseFloat(e.target.value))}
              />
            </label>
          </div>

          {(params.audioAnimationMode === 'ripple' || params.audioAnimationMode === 'wave' || params.audioAnimationMode === 'combined') && (
            <>
              <div className="control-group">
                <label>
                  Mid Influence: {params.midInfluence.toFixed(1)}
                  <input
                    type="range"
                    min="0"
                    max="2"
                    step="0.1"
                    value={params.midInfluence}
                    onChange={(e) => updateParam('midInfluence', parseFloat(e.target.value))}
                  />
                </label>
              </div>

              <div className="control-group">
                <label>
                  Treble Influence: {params.trebleInfluence.toFixed(1)}
                  <input
                    type="range"
                    min="0"
                    max="2"
                    step="0.1"
                    value={params.trebleInfluence}
                    onChange={(e) => updateParam('trebleInfluence', parseFloat(e.target.value))}
                  />
                </label>
              </div>
            </>
          )}

          <div className="control-group">
            <label>
              Audio Smoothing: {params.audioSmoothing.toFixed(1)}
              <input
                type="range"
                min="0.1"
                max="0.95"
                step="0.05"
                value={params.audioSmoothing}
                onChange={(e) => updateParam('audioSmoothing', parseFloat(e.target.value))}
              />
            </label>
          </div>
        </>
      )}

      <div className="control-group">
        <label>
          <input
            type="checkbox"
            checked={params.loopingMode}
            onChange={(e) => updateParam('loopingMode', e.target.checked)}
          />
          Enable Looping Mode
        </label>
      </div>

      {params.loopingMode && (
        <>
          <div className="control-group">
            <label>
              Animation Type
              <select 
                value={params.loopAnimationType}
                onChange={(e) => updateParam('loopAnimationType', e.target.value as any)}
                style={{
                  width: '100%',
                  padding: '4px',
                  marginTop: '5px',
                  background: '#333',
                  color: 'white',
                  border: '1px solid #555',
                  borderRadius: '4px'
                }}
              >
                <option value="pulse">Pulse - Breathing effect from center</option>
                <option value="ripple">Ripple - Water-like waves</option>
              </select>
            </label>
          </div>

          <div className="control-group">
            <label>
              Cycle Duration: {params.loopDuration.toFixed(1)}s
              <input
                type="range"
                min="0.5"
                max="10"
                step="0.1"
                value={params.loopDuration}
                onChange={(e) => updateParam('loopDuration', parseFloat(e.target.value))}
              />
            </label>
          </div>

          <div className="control-group">
            <label>
              Number of Cycles: {params.loopCycles}
              <input
                type="range"
                min="1"
                max="10"
                step="1"
                value={params.loopCycles}
                onChange={(e) => updateParam('loopCycles', parseInt(e.target.value))}
              />
            </label>
          </div>

          {params.loopAnimationType === 'pulse' && (
            <>
              <div className="control-group">
                <label>
                  Pulse Reach: {params.pulseMaxRadius}%
                  <input
                    type="range"
                    min="10"
                    max="100"
                    step="5"
                    value={params.pulseMaxRadius}
                    onChange={(e) => updateParam('pulseMaxRadius', parseInt(e.target.value))}
                  />
                </label>
              </div>

              <div className="control-group">
                <label>
                  Pulse Falloff: {params.pulseFalloffWidth}%
                  <input
                    type="range"
                    min="5"
                    max="50"
                    step="1"
                    value={params.pulseFalloffWidth}
                    onChange={(e) => updateParam('pulseFalloffWidth', parseInt(e.target.value))}
                  />
                </label>
              </div>
            </>
          )}

          {params.loopAnimationType === 'ripple' && (
            <>
              <div className="control-group">
                <label>
                  Ring Width: {params.rippleRingWidth}px
                  <input
                    type="range"
                    min="10"
                    max="200"
                    step="5"
                    value={params.rippleRingWidth}
                    onChange={(e) => updateParam('rippleRingWidth', parseInt(e.target.value))}
                  />
                </label>
              </div>

              <div className="control-group">
                <label>
                  Ripple Boost: {params.rippleBoostAmount.toFixed(2)}
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={params.rippleBoostAmount}
                    onChange={(e) => updateParam('rippleBoostAmount', parseFloat(e.target.value))}
                  />
                </label>
              </div>

              <div className="control-group">
                <label>
                  Ripple Falloff: {params.rippleFalloffSharpness.toFixed(1)}
                  <input
                    type="range"
                    min="0.5"
                    max="5.0"
                    step="0.1"
                    value={params.rippleFalloffSharpness}
                    onChange={(e) => updateParam('rippleFalloffSharpness', parseFloat(e.target.value))}
                  />
                </label>
              </div>

              <div className="control-group">
                <label>
                  Cycle Pause: {params.rippleCyclePause.toFixed(1)}s
                  <input
                    type="range"
                    min="0"
                    max="5.0"
                    step="0.1"
                    value={params.rippleCyclePause}
                    onChange={(e) => updateParam('rippleCyclePause', parseFloat(e.target.value))}
                  />
                </label>
              </div>
            </>
          )}

          <div className="control-group">
            <button 
              onClick={() => {
                if ((window as any).playHalftoneLoop) {
                  (window as any).playHalftoneLoop();
                }
              }}
              style={{
                width: '100%',
                padding: '8px',
                background: '#21BCF4',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 'bold'
              }}
            >
              ▶ RESTART LOOP
            </button>
          </div>
        </>
      )}

      <div className="control-group">
        <label>
          <input
            type="checkbox"
            checked={params.maskEnabled}
            onChange={(e) => updateParam('maskEnabled', e.target.checked)}
          />
          Enable Star Mask
        </label>
      </div>

      {params.maskEnabled && (
        <div className="control-group">
          <label>
            Mask Size: {params.maskSize}px
            <input
              type="range"
              min="20"
              max="200"
              value={params.maskSize}
              onChange={(e) => updateParam('maskSize', parseInt(e.target.value))}
            />
          </label>
        </div>
      )}

      <button className="end-button" onClick={onEnd}>
        End
      </button>
    </div>
  );
};

export default SimpleControlPanel;