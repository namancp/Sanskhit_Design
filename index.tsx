
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI } from "@google/genai";

// --- TYPES & CONSTANTS ---
enum AspectRatio {
  SQUARE = "1:1",
  STORY = "9:16",
  LANDSCAPE = "16:9",
  LINKEDIN = "4:3"
}

interface ElementPos {
  x: number;
  y: number;
  scale: number;
  visible: boolean;
  bold?: boolean;
  italic?: boolean;
}

interface PosterConfig {
  aspectRatio: AspectRatio;
  theme: string;
  brandName: string;
  eventName: string;
  duration: string;
  price: string;
  headline: string;
  subHeadline: string;
  ctaText: string;
  logoUrl: string;
  qrUrl: string | null;
  colorBrand: string;
  colorEvent: string;
  colorHeadline: string;
  colorSubHeadline: string;
  colorCTA: string;
  bgColorCTA: string;
  colorBadges: string;
  bgColorBadge1: string;
  bgColorBadge2: string;
  posLogo: ElementPos;
  posBrand: ElementPos;
  posEventName: ElementPos;
  posBadges: ElementPos;
  posHeadline: ElementPos;
  posSubHeadline: ElementPos;
  posCTA: ElementPos;
  posQR: ElementPos;
}

const AAINEA_LOGO_DEFAULT = "https://aaiena.com/wp-content/uploads/2023/12/aaiena-logo-01.png";
const SNAP_SIZE = 2;

// --- API SERVICE ---
const generatePosterBackground = async (prompt: string, aspectRatio: AspectRatio): Promise<string> => {
  const apiKey = process.env.API_KEY || (window as any).customApiKey;
  if (!apiKey) throw new Error("Missing API Key. Please provide your Gemini API key.");

  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [{
        text: `Cinematic background for a professional poster. Scene: ${prompt}. Composition: Ensure space for white text at bottom. High quality, futuristic.`
      }],
    },
    config: { imageConfig: { aspectRatio: aspectRatio as any } },
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
  }
  throw new Error("Failed to generate image.");
};

// --- MAIN APP COMPONENT ---
const App: React.FC = () => {
  const [config, setConfig] = useState<PosterConfig>({
    aspectRatio: AspectRatio.STORY,
    theme: "Futuristic Dubai skyline, neon lights, tech hub vibe",
    brandName: "Aaiena",
    eventName: "AI Design Summit",
    duration: "DEC 2025",
    price: "FREE ENTRY",
    headline: "Design the Future",
    subHeadline: "Join the world's most advanced AI creative workshop.",
    ctaText: "Register Now",
    logoUrl: AAINEA_LOGO_DEFAULT,
    qrUrl: null,
    colorBrand: "#ffffff",
    colorEvent: "#3b82f6",
    colorHeadline: "#ffffff",
    colorSubHeadline: "#94a3b8",
    colorCTA: "#ffffff",
    bgColorCTA: "#2563eb",
    colorBadges: "#ffffff",
    bgColorBadge1: "rgba(0,0,0,0.7)",
    bgColorBadge2: "rgba(37,99,235,0.7)",
    posLogo: { x: 5, y: 5, scale: 1.0, visible: true },
    posBrand: { x: 50, y: 12, scale: 1.0, visible: true, bold: true },
    posEventName: { x: 50, y: 65, scale: 1.0, visible: true, bold: true },
    posBadges: { x: 50, y: 18, scale: 1.0, visible: true },
    posHeadline: { x: 50, y: 72, scale: 1.2, visible: true, bold: true },
    posSubHeadline: { x: 50, y: 80, scale: 1.0, visible: true },
    posCTA: { x: 50, y: 90, scale: 1.0, visible: true, bold: true },
    posQR: { x: 85, y: 85, scale: 1.0, visible: false }
  });

  const [isGenerating, setIsGenerating] = useState(false);
  const [activeDrag, setActiveDrag] = useState<{key: string, offsetX: number, offsetY: number} | null>(null);
  const [selectedElement, setSelectedElement] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bgImgRef = useRef<HTMLImageElement | null>(null);
  const logoImgRef = useRef<HTMLImageElement | null>(null);

  const drawCanvas = useCallback((isExporting = false) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const [wRatio, hRatio] = config.aspectRatio.split(':').map(Number);
    canvas.width = 1080;
    canvas.height = (1080 / wRatio) * hRatio;

    const px = (pct: number) => (pct / 100) * canvas.width;
    const py = (pct: number) => (pct / 100) * canvas.height;

    // Background
    if (bgImgRef.current?.complete) {
      ctx.drawImage(bgImgRef.current, 0, 0, canvas.width, canvas.height);
    } else {
      ctx.fillStyle = "#020617";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Helper for Font
    const getFont = (pos: ElementPos, size: number) => {
      return `${pos.italic ? 'italic ' : ''}${pos.bold ? 'bold ' : ''}${canvas.width * size * pos.scale}px Inter`;
    };

    // Render Elements (Simplified for brevity)
    ctx.textAlign = "center";
    
    // Brand
    if (config.posBrand.visible) {
      ctx.fillStyle = config.colorBrand;
      ctx.font = getFont(config.posBrand, 0.04);
      ctx.fillText(config.brandName.toUpperCase(), px(config.posBrand.x), py(config.posBrand.y));
    }

    // Headline
    if (config.posHeadline.visible) {
      ctx.fillStyle = config.colorHeadline;
      ctx.font = getFont(config.posHeadline, 0.08);
      ctx.fillText(config.headline, px(config.posHeadline.x), py(config.posHeadline.y));
    }

    // CTA
    if (config.posCTA.visible) {
      const scale = config.posCTA.scale;
      ctx.font = getFont(config.posCTA, 0.045);
      const text = config.ctaText.toUpperCase();
      const metrics = ctx.measureText(text);
      const w = metrics.width + 80;
      const h = (canvas.width * 0.1) * scale;
      ctx.fillStyle = config.bgColorCTA;
      ctx.beginPath();
      ctx.roundRect(px(config.posCTA.x) - w/2, py(config.posCTA.y) - h/2, w, h, 20);
      ctx.fill();
      ctx.fillStyle = config.colorCTA;
      ctx.fillText(text, px(config.posCTA.x), py(config.posCTA.y) + (h/4));
    }

    // Logo
    if (config.posLogo.visible && logoImgRef.current?.complete) {
      const lw = (canvas.width * 0.15) * config.posLogo.scale;
      const lh = (logoImgRef.current.height / logoImgRef.current.width) * lw;
      ctx.drawImage(logoImgRef.current, px(config.posLogo.x), py(config.posLogo.y), lw, lh);
    }
  }, [config]);

  useEffect(() => {
    const l = new Image();
    l.crossOrigin = "anonymous";
    l.src = config.logoUrl;
    l.onload = () => { logoImgRef.current = l; drawCanvas(); };
    drawCanvas();
  }, [config.logoUrl, drawCanvas]);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setErrorMsg(null);
    try {
      const data = await generatePosterBackground(config.theme, config.aspectRatio);
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => { bgImgRef.current = img; drawCanvas(); setIsGenerating(false); };
      img.src = data;
    } catch (e: any) {
      setErrorMsg(e.message);
      setIsGenerating(false);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    
    // Basic hit detection for demo
    const keys = ['posBrand', 'posHeadline', 'posCTA', 'posLogo'];
    for(const key of keys) {
      const pos = (config as any)[key] as ElementPos;
      if (Math.abs(pos.x - x) < 10 && Math.abs(pos.y - y) < 10) {
        setActiveDrag({ key, offsetX: x - pos.x, offsetY: y - pos.y });
        setSelectedElement(key);
        return;
      }
    }
    setSelectedElement(null);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!activeDrag) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    
    let newX = Math.round((x - activeDrag.offsetX) / SNAP_SIZE) * SNAP_SIZE;
    let newY = Math.round((y - activeDrag.offsetY) / SNAP_SIZE) * SNAP_SIZE;
    
    setConfig(prev => ({
      ...prev,
      [activeDrag.key]: { ...(prev as any)[activeDrag.key], x: newX, y: newY }
    }));
  };

  return (
    <div className="flex h-screen overflow-hidden bg-black text-white">
      {/* Editor UI */}
      <main className="flex-1 relative flex items-center justify-center p-12">
        <div className="relative group">
          <canvas 
            ref={canvasRef} 
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={() => setActiveDrag(null)}
            className="rounded-3xl shadow-2xl cursor-crosshair bg-slate-900 max-h-[85vh] w-auto" 
          />
          {isGenerating && (
            <div className="absolute inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center rounded-3xl">
              <div className="text-center">
                <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-[10px] font-black uppercase tracking-widest">AI Rendering...</p>
              </div>
            </div>
          )}
        </div>
      </main>

      <aside className="w-96 border-l border-white/10 bg-[#0a0a0a] p-6 overflow-y-auto">
        <h2 className="text-xs font-black uppercase tracking-widest mb-8 text-blue-500">Aaiena Studio</h2>
        
        <div className="space-y-6">
          <section className="space-y-2">
            <label className="text-[10px] font-bold text-slate-500 uppercase">Creative Theme</label>
            <textarea 
              className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-xs outline-none focus:border-blue-500"
              value={config.theme}
              onChange={e => setConfig({...config, theme: e.target.value})}
            />
            <button 
              onClick={handleGenerate}
              className="w-full py-3 bg-blue-600 rounded-xl font-bold text-xs uppercase hover:bg-blue-500 transition-colors"
            >
              Generate AI Base
            </button>
          </section>

          <section className="space-y-3">
             <label className="text-[10px] font-bold text-slate-500 uppercase">Headline</label>
             <input 
               type="text" 
               className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-xs outline-none"
               value={config.headline}
               onChange={e => setConfig({...config, headline: e.target.value})}
             />
          </section>

          {errorMsg && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-[10px] text-red-400">
              {errorMsg}
              <div className="mt-2 opacity-60">Note: GitHub Pages requires you to enter an API key manually if not pre-configured.</div>
            </div>
          )}
          
          <div className="pt-8 opacity-40 text-[9px] uppercase font-bold text-center">
            Drag elements on canvas to reposition
          </div>
        </div>
      </aside>
    </div>
  );
};

// --- MOUNTING ---
const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
