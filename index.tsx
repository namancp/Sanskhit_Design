
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

const container = document.getElementById('root');

if (!container) {
  console.error("Critical Error: Root element not found.");
} else {
  try {
    const root = createRoot(container);
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  } catch (error) {
    console.error("Rendering Error:", error);
    container.innerHTML = `
      <div style="padding: 20px; color: white; font-family: sans-serif; text-align: center; margin-top: 20vh;">
        <h1 style="color: #ef4444;">Initialization Failed</h1>
        <p style="color: #64748b;">The design engine encountered a startup error.</p>
        <pre style="background: #1e293b; padding: 15px; border-radius: 8px; font-size: 12px; display: inline-block; text-align: left;">${error.message}</pre>
        <p style="font-size: 10px; margin-top: 20px; color: #475569;">Check Browser Console for more details.</p>
      </div>
    `;
  }
}
