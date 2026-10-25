import React from 'react';
import ReactDOM from 'react-dom/client';
import './style.css';
import App from './App';

// No StrictMode: the original app inits exactly once (glitchNoise/resetTimeline/tick).
ReactDOM.createRoot(document.getElementById('root')!).render(
  <App />
);
