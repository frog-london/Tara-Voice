import React, { useEffect } from 'react';
import VoiceChatStage from './components/VoiceChatStage';
import issImage from './assets/iss-voice.png';
import './styles/App.css';

const App: React.FC = () => {
  // Handle fullscreen toggle with Cmd+F or Ctrl+F
  useEffect(() => {
    const handleFullscreenToggle = (event: KeyboardEvent) => {
      // Check for Cmd+F (Mac) or Ctrl+F (Windows/Linux)
      if ((event.metaKey || event.ctrlKey) && event.key === 'f') {
        event.preventDefault();
        
        const appContainer = document.querySelector('.fullscreen-wrapper');
        if (!appContainer) return;
        
        if (!document.fullscreenElement) {
          (appContainer as HTMLElement).requestFullscreen().catch((err) => {
            console.error('Error attempting to enable fullscreen:', err);
          });
        } else {
          document.exitFullscreen().catch((err) => {
            console.error('Error attempting to exit fullscreen:', err);
          });
        }
      }
    };
    
    document.addEventListener('keydown', handleFullscreenToggle);
    
    return () => {
      document.removeEventListener('keydown', handleFullscreenToggle);
    };
  }, []);

  return (
    <div className="fullscreen-wrapper">
      <img src={issImage} alt="" className="background-image" />
      <div className="app-container">
        <VoiceChatStage />
      </div>
    </div>
  );
};

export default App;