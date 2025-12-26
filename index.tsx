
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI } from "@google/genai";

// --- FROM types.ts (CONSOLIDATED) ---
export enum AspectRatio {
  SQUARE = "1:1",
  STORY = "9:16",
  LANDSCAPE = "16:9",
  LINKEDIN = "4:3"
}

export interface ElementPos {
  x: number; // percentage 0-100
  y: number; // percentage 0-100
  scale: number; // multiplier 0.1 to 3.0
  visible: boolean;
  bold?: boolean;
  italic?: boolean;
}

export interface PosterConfig {
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

export const AAINEA_LOGO_DEFAULT = "https://aaiena.com/wp-content/uploads/2023/12/aaiena-logo-01.png";

// --- FROM services/gemini.ts ---
const generatePosterBackground = async (
  prompt: string,
  aspectRatio: AspectRatio
): Promise<string> => {
  // Obtain the API Key exclusively from the environment variable process.env.API_KEY
  const apiKey = process.env.API_KEY;
  
  if (!apiKey || apiKey === "AIzaSyA41f3i98OZfGIQONrz7Co59XMKnTDv_2Y") {
    throw new Error("Missing API Key. Please update YOUR_API_KEY_HERE in index.html.");
  }

  const ai = new GoogleGenAI({ apiKey });
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          {
            text: `High-quality cinematic background for a professional event poster. 
            Scene: ${prompt}. 
            Vibe: Ultra-modern, Dubai luxury, technology-centric. 
            Composition: Ensure the lower 40% and top 20% of the image has relative negative space (dark or soft focus) to allow for white text and logos to be clearly visible. 
            Do not include any pre-written text in the image. 
            Use professional architectural lighting.`
          },
        ],
      },
      config: {
        imageConfig: {
          aspectRatio: aspectRatio as any,
        },
      },
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
    }
    
    throw new Error("The model did not return an image. Please try a different description.");
  } catch (error: any) {
    console.error("Gemini Image Gen Error:", error);
    throw error;
  }
};

// --- FROM App.tsx ---
const SNAP_SIZE = 2;

interface DragState {
  key: keyof PosterConfig;
  offsetX: number;
  offsetY: number;
}

const App: React.FC = () => {
  const [config, setConfig] = useState<PosterConfig>({
    aspectRatio: AspectRatio.STORY,
    theme: "Futuristic Dubai skyline, sunset, ultra high tech bridge, glowing nodes, 8k professional render",
    brandName: "Aaiena",
    eventName: "Dubai Bridge Showcase",
    duration: "22nd - 29th Dec",
    price: "Dubai Bridge",
    headline: "Master AI Tools Today",
    subHeadline: "Join our comprehensive workshop to boost your productivity 10x with AI.",
    ctaText: "Sign Up Now",
    logoUrl: AAINEA_LOGO_DEFAULT,
    qrUrl: null,
    colorBrand: "#ffffff",
    colorEvent: "#3b82f6",
    colorHeadline: "#ffffff",
    colorSubHeadline: "#e2e8f0",
    colorCTA: "#ffffff",
    bgColorCTA: "#2563eb",
    colorBadges: "#ffffff",
    bgColorBadge1: "rgba(0, 0, 0, 0.6)",
    bgColorBadge2: "rgba(37, 99, 235, 0.6)",
    posLogo: { x: 5, y: 5, scale: 1.0, visible: true },
    posBrand: { x: 50, y: 10, scale: 1.0, visible: true, bold: true, italic: false },
    posEventName: { x: 50, y: 62, scale: 1.0, visible: true, bold: true, italic: false },
    posBadges: { x: 5, y: 15, scale: 1.0, visible: true, bold: true, italic: false },
    posHeadline: { x: 50, y: 70, scale: 1.0, visible: true, bold: true, italic: false },
    posSubHeadline: { x: 50, y: 78, scale: 1.0, visible: true, bold: false, italic: false },
    posCTA: { x: 50, y: 90, scale: 1.0, visible: true, bold: true, italic: false },
    posQR: { x: 85, y: 85, scale: 1.0, visible: false }
  });

  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activeDrag, setActiveDrag] = useState<DragState | null>(null);
  const [selectedElement, setSelectedElement] = useState<keyof PosterConfig | null>(null);
  const [showDeployModal, setShowDeployModal] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bgImgRef = useRef<HTMLImageElement | null>(null);
  const logoImgRef = useRef<HTMLImageElement | null>(null);
  const qrImgRef = useRef<HTMLImageElement | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'logo' | 'qr') => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        if (type === 'logo') setConfig(prev => ({ ...prev, logoUrl: dataUrl }));
        else setConfig(prev => ({ ...prev, qrUrl: dataUrl, posQR: { ...prev.posQR, visible: true } }));
      };
      reader.readAsDataURL(file);
    }
  };

  const getCanvasMousePos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? (e as any).touches[0].clientX : (e as any).clientX;
    const clientY = 'touches' in e ? (e as any).touches[0].clientY : (e as any).clientY;
    return {
      x: ((clientX - rect.left) / rect.width) * 100,
      y: ((clientY - rect.top) / rect.height) * 100
    };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    const pos = getCanvasMousePos(e);
    const elements: (keyof PosterConfig)[] = ['posLogo', 'posBrand', 'posEventName', 'posBadges', 'posHeadline', 'posSubHeadline', 'posCTA', 'posQR'];
    let closest: keyof PosterConfig | null = null;
    let minDist = 10; 
    elements.forEach(key => {
      const item = config[key] as ElementPos;
      if (!item || !item.visible) return;
      const dx = pos.x - item.x; const dy = pos.y - item.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < minDist) { minDist = d; closest = key; }
    });
    if (closest) {
      const item = config[closest] as ElementPos;
      setSelectedElement(closest);
      setActiveDrag({ key: closest, offsetX: pos.x - item.x, offsetY: pos.y - item.y });
      e.preventDefault();
    } else setSelectedElement(null);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!activeDrag) return;
    const pos = getCanvasMousePos(e);
    let newX = Math.round((pos.x - activeDrag.offsetX) / SNAP_SIZE) * SNAP_SIZE;
    let newY = Math.round((pos.y - activeDrag.offsetY) / SNAP_SIZE) * SNAP_SIZE;
    newX = Math.max(0, Math.min(100, newX));
    newY = Math.max(0, Math.min(100, newY));
    setConfig(prev => ({ ...prev, [activeDrag.key]: { ...(prev[activeDrag.key] as ElementPos), x: newX, y: newY } }));
  };

  const wrapText = (ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) => {
    const words = text.split(' ');
    let line = ''; let curY = y;
    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + ' ';
      if (ctx.measureText(testLine).width > maxWidth && n > 0) {
        ctx.fillText(line, x, curY);
        line = words[n] + ' '; curY += lineHeight;
      } else line = testLine;
    }
    ctx.fillText(line, x, curY);
  };

  const getFontStyle = (pos: ElementPos, baseSize: number, canvasWidth: number) => {
    const italic = pos.italic ? 'italic ' : '';
    const bold = pos.bold ? 'bold ' : '';
    return `${italic}${bold}${canvasWidth * baseSize * pos.scale}px Inter`;
  };

  const drawCanvas = useCallback((isExporting = false) => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const [wRatio, hRatio] = config.aspectRatio.split(':').map(Number);
    canvas.width = 1080; canvas.height = (1080 / wRatio) * hRatio;
    const px = (pct: number) => (pct / 100) * canvas.width;
    const py = (pct: number) => (pct / 100) * canvas.height;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (bgImgRef.current?.complete) ctx.drawImage(bgImgRef.current, 0, 0, canvas.width, canvas.height);
    else {
      const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
      grad.addColorStop(0, '#0f172a'); grad.addColorStop(1, '#020617');
      ctx.fillStyle = grad; ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    if (!isExporting) {
      ctx.strokeStyle = "rgba(255,255,255,0.05)"; ctx.lineWidth = 1;
      for(let i=0; i<=100; i+=SNAP_SIZE) {
        ctx.beginPath(); ctx.moveTo(px(i), 0); ctx.lineTo(px(i), canvas.height); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, py(i)); ctx.lineTo(canvas.width, py(i)); ctx.stroke();
      }
    }
    const drawElement = (key: keyof PosterConfig) => {
      const pos = config[key] as ElementPos; if (!pos || !pos.visible) return;
      if (key === 'posLogo' && logoImgRef.current?.complete) {
        const lw = (canvas.width * 0.18) * pos.scale;
        const lh = (logoImgRef.current.height / logoImgRef.current.width) * lw;
        ctx.drawImage(logoImgRef.current, px(pos.x), py(pos.y), lw, lh);
      } else if (key === 'posBrand') {
        ctx.textAlign = "center"; ctx.fillStyle = config.colorBrand;
        ctx.font = getFontStyle(pos, 0.04, canvas.width);
        ctx.fillText(config.brandName.toUpperCase(), px(pos.x), py(pos.y));
      } else if (key === 'posHeadline') {
        ctx.textAlign = "center"; ctx.fillStyle = config.colorHeadline;
        ctx.font = getFontStyle(pos, 0.08, canvas.width);
        ctx.shadowBlur = isExporting ? 20 : 0; ctx.shadowColor = "rgba(0,0,0,0.5)";
        ctx.fillText(config.headline, px(pos.x), py(pos.y)); ctx.shadowBlur = 0;
      } else if (key === 'posCTA') {
        ctx.textAlign = "center"; const scale = pos.scale;
        ctx.font = getFontStyle(pos, 0.045, canvas.width);
        const txt = config.ctaText.toUpperCase();
        const cW = (ctx.measureText(txt).width + 80); const cH = (canvas.width * 0.11) * scale;
        ctx.fillStyle = config.bgColorCTA; ctx.beginPath(); ctx.roundRect(px(pos.x) - (cW/2), py(pos.y), cW, cH, 20 * scale); ctx.fill();
        ctx.fillStyle = config.colorCTA; ctx.fillText(txt, px(pos.x), py(pos.y) + (cH/2) + (12 * scale));
      } else if (key === 'posSubHeadline') {
        ctx.textAlign = "center"; ctx.fillStyle = config.colorSubHeadline;
        ctx.font = getFontStyle(pos, 0.038, canvas.width);
        wrapText(ctx, config.subHeadline, px(pos.x), py(pos.y), canvas.width * 0.85, canvas.width * 0.055 * pos.scale);
      } else if (key === 'posQR' && qrImgRef.current?.complete) {
        const qw = (canvas.width * 0.14) * pos.scale;
        ctx.fillStyle = "white"; ctx.fillRect(px(pos.x) - (6 * pos.scale), py(pos.y) - (6 * pos.scale), qw + (12 * pos.scale), qw + (12 * pos.scale));
        ctx.drawImage(qrImgRef.current, px(pos.x), py(pos.y), qw, qw);
      } else if (key === 'posBadges') {
        ctx.textAlign = "left"; const scale = pos.scale;
        ctx.font = getFontStyle(pos, 0.026, canvas.width);
        ctx.fillStyle = config.bgColorBadge1;
        const dW = (ctx.measureText(config.duration).width + 34); const bH = (canvas.width * 0.055) * scale;
        ctx.beginPath(); ctx.roundRect(px(pos.x), py(pos.y), dW, bH, 10 * scale); ctx.fill();
        ctx.fillStyle = config.colorBadges; ctx.fillText(config.duration, px(pos.x) + (17 * scale), py(pos.y) + (bH/2) + (10 * scale));
        ctx.fillStyle = config.bgColorBadge2;
        const pW = (ctx.measureText(config.price).width + 34);
        ctx.beginPath(); ctx.roundRect(px(pos.x) + dW + (15 * scale), py(pos.y), pW, bH, 10 * scale); ctx.fill();
        ctx.fillStyle = config.colorBadges; ctx.fillText(config.price, px(pos.x) + dW + (32 * scale), py(pos.y) + (bH/2) + (10 * scale));
      } else if (key === 'posEventName') {
        ctx.textAlign = "center"; ctx.fillStyle = config.colorEvent;
        ctx.font = getFontStyle(pos, 0.03, canvas.width);
        ctx.fillText(config.eventName.toUpperCase(), px(pos.x), py(pos.y));
      }
    };
    ['posLogo', 'posBrand', 'posEventName', 'posBadges', 'posHeadline', 'posSubHeadline', 'posQR', 'posCTA'].forEach(k => drawElement(k as keyof PosterConfig));
  }, [config, selectedElement, activeDrag]);

  useEffect(() => {
    const l = new Image(); l.crossOrigin = "anonymous"; l.src = config.logoUrl;
    l.onload = () => { logoImgRef.current = l; drawCanvas(); };
    if (config.qrUrl) {
      const q = new Image(); q.crossOrigin = "anonymous"; q.src = config.qrUrl;
      q.onload = () => { qrImgRef.current = q; drawCanvas(); };
    }
  }, [config.logoUrl, config.qrUrl, drawCanvas]);

  const handleGenerate = async () => {
    setIsGenerating(true); setErrorMsg(null);
    try {
      const data = await generatePosterBackground(config.theme, config.aspectRatio);
      const img = new Image(); img.crossOrigin = "anonymous";
      img.onload = () => { bgImgRef.current = img; drawCanvas(); setIsGenerating(false); };
      img.onerror = () => { setIsGenerating(false); setErrorMsg("Failed to load image."); };
      img.src = data;
    } catch (e: any) { setErrorMsg(e.message); setIsGenerating(false); }
  };

  const handleExport = () => {
    drawCanvas(true); const canvas = canvasRef.current; if (!canvas) return;
    const link = document.createElement('a'); link.download = `poster-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png', 1.0); link.click();
    setTimeout(() => drawCanvas(false), 100);
  };

  useEffect(() => { drawCanvas(false); }, [config, drawCanvas]);

  return (
    <div className="h-screen bg-[#050505] text-slate-300 font-sans flex flex-col overflow-hidden">
      <header className="h-16 px-6 flex items-center justify-between border-b border-white/5 bg-black/40 backdrop-blur-md z-50">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">A</div>
          <h1 className="text-xs font-black text-white uppercase tracking-tighter">Aaiena Studio</h1>
        </div>
        <div className="flex items-center gap-2 bg-white/5 p-1 rounded-xl">
          {Object.values(AspectRatio).map(ratio => (
            <button key={ratio} onClick={() => setConfig({...config, aspectRatio: ratio})} className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase ${config.aspectRatio === ratio ? 'bg-white text-black' : 'text-slate-500'}`}>{ratio}</button>
          ))}
        </div>
        <button onClick={handleExport} className="bg-blue-600 text-white px-5 py-2 rounded-xl text-xs font-black uppercase shadow-lg shadow-blue-500/20">Export</button>
      </header>
      <main className="flex-1 flex overflow-hidden">
        <section className="flex-1 bg-[#0a0a0a] flex items-center justify-center p-8 relative overflow-hidden">
          <div className="relative bg-black p-1 rounded-[2.5rem] border border-white/10">
            <canvas ref={canvasRef} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={() => setActiveDrag(null)} className="max-w-[calc(100vw-480px)] max-h-[calc(100vh-160px)] rounded-[2.2rem] cursor-grab" />
            {isGenerating && <div className="absolute inset-0 bg-black/80 flex items-center justify-center rounded-[2.2rem] z-50 text-[10px] font-black uppercase text-white animate-pulse">Rendering...</div>}
            {errorMsg && <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-red-600/90 text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase shadow-2xl z-50">⚠️ {errorMsg}</div>}
          </div>
        </section>
        <aside className="w-[420px] bg-[#0d0d0d] border-l border-white/5 flex flex-col overflow-y-auto p-6 space-y-8">
          <section className="space-y-4">
            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">AI Vision</h3>
            <textarea className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-xs text-white min-h-[70px] outline-none" value={config.theme} onChange={e => setConfig({...config, theme: e.target.value})} />
            <button onClick={handleGenerate} disabled={isGenerating} className="w-full py-3 bg-blue-600 rounded-xl text-[10px] font-black uppercase transition-all active:scale-95">{isGenerating ? "Synthesizing..." : "Regenerate Background"}</button>
          </section>
          <section className="space-y-4">
            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Properties</h3>
            <input type="text" className="w-full bg-white/5 rounded-xl p-3 text-xs text-white" value={config.headline} onChange={e => setConfig({...config, headline: e.target.value})} placeholder="Headline" />
            <input type="text" className="w-full bg-white/5 rounded-xl p-3 text-xs text-white" value={config.brandName} onChange={e => setConfig({...config, brandName: e.target.value})} placeholder="Brand Name" />
          </section>
          <section className="space-y-4">
             <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Assets</h3>
             <div className="grid grid-cols-2 gap-3">
               <label className="p-4 border-2 border-dashed border-white/5 bg-white/5 rounded-2xl cursor-pointer text-center hover:bg-white/10 transition-all">
                 <span className="text-[8px] font-black uppercase text-slate-500">Logo</span>
                 <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, 'logo')} />
               </label>
               <label className="p-4 border-2 border-dashed border-white/5 bg-white/5 rounded-2xl cursor-pointer text-center hover:bg-white/10 transition-all">
                 <span className="text-[8px] font-black uppercase text-slate-500">QR</span>
                 <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, 'qr')} />
               </label>
             </div>
          </section>
        </aside>
      </main>
    </div>
  );
};

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
