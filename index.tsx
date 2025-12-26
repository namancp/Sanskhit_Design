
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI } from "@google/genai";

// --- FROM types.ts (EXACT) ---
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

// --- FROM services/gemini.ts (EXACT) ---
const generatePosterBackground = async (
  prompt: string,
  aspectRatio: AspectRatio
): Promise<string> => {
  const apiKey = (process.env as any).API_KEY;
  
  if (!apiKey) {
    console.warn("API_KEY is missing. Background generation will fail.");
    throw new Error("Missing API_KEY. Please set your Gemini API key.");
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
    
    throw new Error("Empty model response");
  } catch (error) {
    console.error("Gemini Image Gen Error:", error);
    throw error;
  }
};

// --- FROM App.tsx (EXACT UI & LOGIC) ---
const SNAP_SIZE = 2; // Grid snap percentage

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
        if (type === 'logo') {
          setConfig(prev => ({ ...prev, logoUrl: dataUrl }));
        } else {
          setConfig(prev => ({ 
            ...prev, 
            qrUrl: dataUrl, 
            posQR: { ...prev.posQR, visible: true } 
          }));
        }
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
      
      const dx = pos.x - item.x;
      const dy = pos.y - item.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      
      if (d < minDist) {
        minDist = d;
        closest = key;
      }
    });
    
    if (closest) {
      const item = config[closest] as ElementPos;
      setSelectedElement(closest);
      setActiveDrag({
        key: closest,
        offsetX: pos.x - item.x,
        offsetY: pos.y - item.y
      });
      e.preventDefault();
    } else {
      setSelectedElement(null);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!activeDrag) return;
    const pos = getCanvasMousePos(e);
    
    let newX = pos.x - activeDrag.offsetX;
    let newY = pos.y - activeDrag.offsetY;

    newX = Math.round(newX / SNAP_SIZE) * SNAP_SIZE;
    newY = Math.round(newY / SNAP_SIZE) * SNAP_SIZE;

    newX = Math.max(0, Math.min(100, newX));
    newY = Math.max(0, Math.min(100, newY));
    
    setConfig(prev => ({
      ...prev,
      [activeDrag.key]: { 
        ...(prev[activeDrag.key] as ElementPos), 
        x: newX, 
        y: newY
      }
    }));
  };

  const wrapText = (ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) => {
    const words = text.split(' ');
    let line = '';
    let curY = y;
    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + ' ';
      if (ctx.measureText(testLine).width > maxWidth && n > 0) {
        ctx.fillText(line, x, curY);
        line = words[n] + ' ';
        curY += lineHeight;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, x, curY);
  };

  const getFontStyle = (pos: ElementPos, baseSize: number, canvasWidth: number) => {
    const italic = pos.italic ? 'italic ' : '';
    const bold = pos.bold ? 'bold ' : '';
    return `${italic}${bold}${canvasWidth * baseSize * pos.scale}px Inter`;
  };

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

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    if (bgImgRef.current && bgImgRef.current.complete) {
      ctx.drawImage(bgImgRef.current, 0, 0, canvas.width, canvas.height);
    } else {
      const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
      grad.addColorStop(0, '#0f172a');
      grad.addColorStop(1, '#020617');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    if (!isExporting) {
      ctx.strokeStyle = "rgba(255,255,255,0.05)";
      ctx.lineWidth = 1;
      for(let i=0; i<=100; i+=SNAP_SIZE) {
        ctx.beginPath(); ctx.moveTo(px(i), 0); ctx.lineTo(px(i), canvas.height); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, py(i)); ctx.lineTo(canvas.width, py(i)); ctx.stroke();
      }
    }

    const drawElement = (key: keyof PosterConfig) => {
      const pos = config[key] as ElementPos;
      if (!pos || !pos.visible) return;

      if (key === 'posLogo' && logoImgRef.current?.complete) {
        const lw = (canvas.width * 0.18) * pos.scale;
        const lh = (logoImgRef.current.height / logoImgRef.current.width) * lw;
        ctx.drawImage(logoImgRef.current, px(pos.x), py(pos.y), lw, lh);
        if(!isExporting && selectedElement === key) {
          ctx.strokeStyle = "#3b82f6"; ctx.lineWidth = 4;
          ctx.strokeRect(px(pos.x)-5, py(pos.y)-5, lw+10, lh+10);
        }
      } else if (key === 'posBrand') {
        ctx.textAlign = "center";
        ctx.fillStyle = config.colorBrand;
        ctx.font = getFontStyle(pos, 0.04, canvas.width);
        ctx.fillText(config.brandName.toUpperCase(), px(pos.x), py(pos.y));
        if(!isExporting && selectedElement === key) {
          const tw = ctx.measureText(config.brandName.toUpperCase()).width;
          ctx.strokeStyle = "#3b82f6"; ctx.lineWidth = 4;
          ctx.strokeRect(px(pos.x) - (tw/2) - 10, py(pos.y) - 40, tw+20, 60);
        }
      } else if (key === 'posEventName') {
        ctx.textAlign = "center";
        ctx.fillStyle = config.colorEvent;
        ctx.font = getFontStyle(pos, 0.03, canvas.width);
        ctx.fillText(config.eventName.toUpperCase(), px(pos.x), py(pos.y));
        if(!isExporting && selectedElement === key) {
          const tw = ctx.measureText(config.eventName.toUpperCase()).width;
          ctx.strokeStyle = "#3b82f6"; ctx.lineWidth = 4;
          ctx.strokeRect(px(pos.x) - (tw/2) - 10, py(pos.y) - 30, tw+20, 45);
        }
      } else if (key === 'posBadges') {
        ctx.textAlign = "left";
        const scale = pos.scale;
        ctx.font = getFontStyle(pos, 0.026, canvas.width);
        const durTxt = config.duration;
        const prTxt = config.price;
        
        ctx.fillStyle = config.bgColorBadge1;
        const dW = (ctx.measureText(durTxt).width + 34);
        const bH = (canvas.width * 0.055) * scale;
        ctx.beginPath(); ctx.roundRect(px(pos.x), py(pos.y), dW, bH, 10 * scale); ctx.fill();
        ctx.fillStyle = config.colorBadges; ctx.fillText(durTxt, px(pos.x) + (17 * scale), py(pos.y) + (bH/2) + (10 * scale));

        ctx.fillStyle = config.bgColorBadge2;
        const pW = (ctx.measureText(prTxt).width + 34);
        ctx.beginPath(); ctx.roundRect(px(pos.x) + dW + (15 * scale), py(pos.y), pW, bH, 10 * scale); ctx.fill();
        ctx.fillStyle = config.colorBadges; ctx.fillText(prTxt, px(pos.x) + dW + (32 * scale), py(pos.y) + (bH/2) + (10 * scale));
        
        if(!isExporting && selectedElement === key) {
          ctx.strokeStyle = "#3b82f6"; ctx.lineWidth = 4;
          ctx.strokeRect(px(pos.x)-5, py(pos.y)-5, dW + pW + (15*scale) + 10, bH + 10);
        }
      } else if (key === 'posHeadline') {
        ctx.textAlign = "center";
        ctx.fillStyle = config.colorHeadline;
        ctx.font = getFontStyle(pos, 0.08, canvas.width);
        ctx.shadowBlur = isExporting ? 20 : 0; ctx.shadowColor = "rgba(0,0,0,0.5)";
        ctx.fillText(config.headline, px(pos.x), py(pos.y));
        ctx.shadowBlur = 0;
        if(!isExporting && selectedElement === key) {
          const tw = ctx.measureText(config.headline).width;
          ctx.strokeStyle = "#3b82f6"; ctx.lineWidth = 4;
          ctx.strokeRect(px(pos.x) - (tw/2) - 10, py(pos.y) - 60, tw+20, 80);
        }
      } else if (key === 'posSubHeadline') {
        ctx.textAlign = "center";
        ctx.fillStyle = config.colorSubHeadline;
        const scale = pos.scale;
        ctx.font = getFontStyle(pos, 0.038, canvas.width);
        wrapText(ctx, config.subHeadline, px(pos.x), py(pos.y), canvas.width * 0.85, canvas.width * 0.055 * scale);
        if(!isExporting && selectedElement === key) {
          ctx.strokeStyle = "#3b82f6"; ctx.lineWidth = 4;
          ctx.strokeRect(px(pos.x) - (canvas.width * 0.425), py(pos.y) - 30, canvas.width * 0.85, 100);
        }
      } else if (key === 'posQR' && qrImgRef.current?.complete) {
        const qw = (canvas.width * 0.14) * pos.scale;
        ctx.fillStyle = "white";
        ctx.fillRect(px(pos.x) - (6 * pos.scale), py(pos.y) - (6 * pos.scale), qw + (12 * pos.scale), qw + (12 * pos.scale));
        ctx.drawImage(qrImgRef.current, px(pos.x), py(pos.y), qw, qw);
        if(!isExporting && selectedElement === key) {
          ctx.strokeStyle = "#3b82f6"; ctx.lineWidth = 4;
          ctx.strokeRect(px(pos.x)-10, py(pos.y)-10, qw+20, qw+20);
        }
      } else if (key === 'posCTA') {
        ctx.textAlign = "center";
        const scale = pos.scale;
        ctx.font = getFontStyle(pos, 0.045, canvas.width);
        const txt = config.ctaText.toUpperCase();
        const cW = (ctx.measureText(txt).width + 80);
        const cH = (canvas.width * 0.11) * scale;
        
        ctx.fillStyle = config.bgColorCTA;
        ctx.beginPath(); ctx.roundRect(px(pos.x) - (cW/2), py(pos.y), cW, cH, 20 * scale); ctx.fill();
        ctx.fillStyle = config.colorCTA; ctx.fillText(txt, px(pos.x), py(pos.y) + (cH/2) + (12 * scale));
        
        if(!isExporting && selectedElement === key) {
          ctx.strokeStyle = "#3b82f6"; ctx.lineWidth = 4;
          ctx.strokeRect(px(pos.x) - (cW/2) - 5, py(pos.y) - 5, cW + 10, cH + 10);
        }
      }
    };

    ['posLogo', 'posBrand', 'posEventName', 'posBadges', 'posHeadline', 'posSubHeadline', 'posQR', 'posCTA'].forEach(k => drawElement(k as keyof PosterConfig));

    if (!isExporting && activeDrag) {
      const pos = config[activeDrag.key] as ElementPos;
      ctx.strokeStyle = "rgba(59, 130, 246, 0.5)";
      ctx.setLineDash([5, 5]);
      ctx.beginPath(); ctx.moveTo(px(pos.x), 0); ctx.lineTo(px(pos.x), canvas.height); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, py(pos.y)); ctx.lineTo(canvas.width, py(pos.y)); ctx.stroke();
      ctx.setLineDash([]);
    }

  }, [config, selectedElement, activeDrag]);

  useEffect(() => {
    const l = new Image(); l.crossOrigin = "anonymous"; l.src = config.logoUrl;
    l.onload = () => { logoImgRef.current = l; drawCanvas(); };
    l.onerror = () => drawCanvas();
    if (config.qrUrl) {
      const q = new Image(); q.crossOrigin = "anonymous"; q.src = config.qrUrl;
      q.onload = () => { qrImgRef.current = q; drawCanvas(); };
      q.onerror = () => drawCanvas();
    }
  }, [config.logoUrl, config.qrUrl, drawCanvas]);

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const data = await generatePosterBackground(config.theme, config.aspectRatio);
      if (!data) throw new Error("No image data received");
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        bgImgRef.current = img;
        drawCanvas();
        setIsGenerating(false);
      };
      img.onerror = () => setIsGenerating(false);
      img.src = data;
    } catch (e) {
      console.error(e);
      setIsGenerating(false);
    }
  };

  const updateScale = (key: keyof PosterConfig, scaleValue: string) => {
    const val = parseFloat(scaleValue);
    setConfig(prev => ({
      ...prev,
      [key]: { ...(prev[key] as ElementPos), scale: val }
    }));
  };

  const toggleStyle = (key: keyof PosterConfig, style: 'bold' | 'italic') => {
    setConfig(prev => {
      const current = prev[key] as ElementPos;
      return {
        ...prev,
        [key]: { ...current, [style]: !current[style] }
      };
    });
  };

  const handleExport = () => {
    drawCanvas(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `aaiena-poster-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png', 1.0);
    link.click();
    setTimeout(() => drawCanvas(false), 100);
  };

  useEffect(() => { drawCanvas(false); }, [config, drawCanvas]);

  return (
    <div className="h-screen bg-[#050505] text-slate-300 font-sans flex flex-col overflow-hidden">
      <header className="h-16 px-6 flex items-center justify-between border-b border-white/5 bg-black/40 backdrop-blur-md z-50">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold shadow-lg shadow-blue-500/20">A</div>
          <div className="hidden sm:block">
            <h1 className="text-xs font-black text-white uppercase tracking-tighter">Aaiena Design Studio</h1>
            <p className="text-[9px] text-slate-500 uppercase font-bold tracking-[0.2em]">Creative Hub</p>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-white/5 p-1 rounded-xl border border-white/5">
          {Object.values(AspectRatio).map(ratio => (
            <button 
              key={ratio} 
              onClick={() => setConfig({...config, aspectRatio: ratio})}
              className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${config.aspectRatio === ratio ? 'bg-white text-black shadow-lg scale-105' : 'text-slate-500 hover:text-white'}`}
            >
              {ratio}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={() => setShowDeployModal(true)}
            className="flex items-center gap-2 bg-white/5 text-slate-400 border border-white/10 px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all hover:bg-white/10 hover:text-white"
          >
            <span>Deployment Guide</span>
          </button>
          <button 
            onClick={handleExport}
            className="bg-blue-600 text-white px-5 py-2 rounded-xl text-xs font-black uppercase transition-all shadow-[0_0_20px_rgba(37,99,235,0.4)] hover:bg-blue-500 active:scale-95"
          >
            Export Image
          </button>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        <section className="flex-1 bg-[#0a0a0a] flex flex-col items-center justify-center p-8 relative overflow-hidden">
          <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, #475569 1px, transparent 0)', backgroundSize: '32px 32px' }}></div>
          <div className="relative w-full h-full flex items-center justify-center">
            <div className="relative bg-black p-1 rounded-[2.5rem] shadow-[0_0_100px_rgba(0,0,0,0.6)] border border-white/10 group">
              <canvas
                ref={canvasRef}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={() => setActiveDrag(null)}
                onMouseLeave={() => setActiveDrag(null)}
                className="max-w-[calc(100vw-480px)] max-h-[calc(100vh-160px)] rounded-[2.2rem] cursor-grab active:cursor-grabbing touch-none shadow-2xl transition-all"
                style={{ width: 'auto', height: 'auto' }}
              />
              {activeDrag && (
                <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-4 py-1.5 rounded-full text-[9px] font-black uppercase shadow-2xl animate-pulse">
                  Snapping to {(config[activeDrag.key] as ElementPos).x}%, {(config[activeDrag.key] as ElementPos).y}%
                </div>
              )}
              {isGenerating && (
                <div className="absolute inset-0 bg-black/80 backdrop-blur-xl flex flex-col items-center justify-center z-50 rounded-[2.2rem]">
                  <div className="w-10 h-10 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mb-4"></div>
                  <p className="text-white font-black uppercase tracking-[0.4em] text-[10px]">Processing AI Vision</p>
                </div>
              )}
            </div>
          </div>
        </section>

        <aside className="w-[420px] bg-[#0d0d0d] border-l border-white/5 flex flex-col overflow-hidden shadow-2xl">
          <div className="flex-1 overflow-y-auto scrollbar-hide p-6 space-y-8">
            <section className="space-y-4">
              <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <span className="w-1 h-1 bg-blue-500 rounded-full"></span>
                Creative AI vision
              </h3>
              <div className="bg-white/[0.03] border border-white/5 p-4 rounded-2xl space-y-3">
                <textarea 
                  className="w-full bg-black/40 border border-white/5 rounded-xl p-3 text-xs text-slate-300 min-h-[70px] focus:border-blue-500/50 outline-none transition-all resize-none" 
                  value={config.theme} 
                  onChange={e => setConfig({...config, theme: e.target.value})}
                  placeholder="Describe your background..."
                />
                <button
                  onClick={handleGenerate}
                  disabled={isGenerating}
                  className="w-full py-3 bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-blue-500/10"
                >
                  {isGenerating ? "Synthesizing..." : "Regenerate Background"}
                </button>
              </div>
            </section>

            <section className="space-y-4">
              <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Campaign Variables</h3>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[8px] font-bold text-slate-600 uppercase ml-1">Brand Name</label>
                    <input type="text" className="w-full bg-white/[0.03] border border-white/5 rounded-xl p-3 text-xs text-white outline-none focus:border-white/20" value={config.brandName} onChange={e => setConfig({...config, brandName: e.target.value})} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[8px] font-bold text-slate-600 uppercase ml-1">Event Name</label>
                    <input type="text" className="w-full bg-white/[0.03] border border-white/5 rounded-xl p-3 text-xs text-white outline-none focus:border-white/20" value={config.eventName} onChange={e => setConfig({...config, eventName: e.target.value})} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[8px] font-bold text-slate-600 uppercase ml-1">Badge 1</label>
                    <input type="text" className="w-full bg-white/[0.03] border border-white/5 rounded-xl p-3 text-xs text-white outline-none focus:border-white/20" value={config.duration} onChange={e => setConfig({...config, duration: e.target.value})} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[8px] font-bold text-slate-600 uppercase ml-1">Badge 2</label>
                    <input type="text" className="w-full bg-white/[0.03] border border-white/5 rounded-xl p-3 text-xs text-white outline-none focus:border-white/20" value={config.price} onChange={e => setConfig({...config, price: e.target.value})} />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[8px] font-bold text-slate-600 uppercase ml-1">Headline</label>
                  <input type="text" className="w-full bg-white/[0.03] border border-white/5 rounded-xl p-3 text-xs font-black text-white outline-none focus:border-white/20" value={config.headline} onChange={e => setConfig({...config, headline: e.target.value})} />
                </div>
                <div className="space-y-1">
                  <label className="text-[8px] font-bold text-slate-600 uppercase ml-1">Description</label>
                  <textarea className="w-full bg-white/[0.03] border border-white/5 rounded-xl p-3 text-xs min-h-[60px] text-slate-400 outline-none focus:border-white/20 resize-none" value={config.subHeadline} onChange={e => setConfig({...config, subHeadline: e.target.value})} />
                </div>
                <div className="space-y-1">
                  <label className="text-[8px] font-bold text-slate-600 uppercase ml-1">CTA Label</label>
                  <input type="text" className="w-full bg-white/[0.03] border border-white/5 rounded-xl p-3 text-xs text-white outline-none focus:border-white/20" value={config.ctaText} onChange={e => setConfig({...config, ctaText: e.target.value})} />
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Brand Assets</h3>
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-white/5 bg-white/[0.02] rounded-2xl cursor-pointer hover:bg-white/10 hover:border-white/20 transition-all group text-center">
                   <div className="text-[18px] mb-1 opacity-40 group-hover:opacity-100">🛡️</div>
                   <span className="text-[8px] font-black uppercase text-slate-500 group-hover:text-white">Replace Logo</span>
                   <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, 'logo')} />
                </label>
                <label className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-white/5 bg-white/[0.02] rounded-2xl cursor-pointer hover:bg-white/10 hover:border-white/20 transition-all group text-center">
                   <div className="text-[18px] mb-1 opacity-40 group-hover:opacity-100">🧬</div>
                   <span className="text-[8px] font-black uppercase text-slate-500 group-hover:text-white">Embed QR</span>
                   <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, 'qr')} />
                </label>
              </div>
            </section>

            <section className="space-y-4 pb-12">
              <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Studio Layer Mastery</h3>
              <div className="space-y-3">
                {[
                  { key: 'posLogo', label: 'Primary Logo', color: null },
                  { key: 'posBrand', label: 'Brand Name', color: 'colorBrand' },
                  { key: 'posEventName', label: 'Event Identifier', color: 'colorEvent' },
                  { key: 'posHeadline', label: 'Headline Layer', color: 'colorHeadline' },
                  { 
                    key: 'posBadges', 
                    label: 'Dynamic Info Badges', 
                    color: 'colorBadges',
                    extraColors: [
                      { key: 'bgColorBadge1', label: 'Badge 1 Fill' },
                      { key: 'bgColorBadge2', label: 'Badge 2 Fill' }
                    ]
                  },
                  { key: 'posSubHeadline', label: 'Sub Headline', color: 'colorSubHeadline' },
                  { key: 'posCTA', label: 'Conversion Button', color: 'colorCTA', bg: 'bgColorCTA' },
                  { key: 'posQR', label: 'QR Destination', color: null }
                ].map(({key, label, color, bg, extraColors}) => (
                  <div 
                    key={key} 
                    onClick={() => setSelectedElement(key as keyof PosterConfig)}
                    className={`p-5 rounded-2xl border transition-all cursor-pointer ${selectedElement === key ? 'bg-blue-600/10 border-blue-500/50 scale-[1.02]' : 'bg-white/[0.02] border-white/5 hover:border-white/20'}`}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                         <div className={`w-1.5 h-1.5 rounded-full ${selectedElement === key ? 'bg-blue-500 animate-pulse' : 'bg-slate-700'}`}></div>
                         <span className="text-[10px] font-black uppercase text-slate-300 tracking-tight">{label}</span>
                      </div>
                      <div className="flex gap-2">
                        {key !== 'posLogo' && key !== 'posQR' && (
                          <>
                            <button 
                              onClick={(e) => { e.stopPropagation(); toggleStyle(key as keyof PosterConfig, 'bold'); }}
                              className={`w-6 h-6 flex items-center justify-center rounded-md text-[10px] font-bold border ${ (config[key as keyof PosterConfig] as ElementPos)?.bold ? 'bg-white text-black border-white' : 'border-white/20 text-slate-500 hover:text-white' }`}
                            >
                              B
                            </button>
                            <button 
                              onClick={(e) => { e.stopPropagation(); toggleStyle(key as keyof PosterConfig, 'italic'); }}
                              className={`w-6 h-6 flex items-center justify-center rounded-md text-[10px] italic font-serif border ${ (config[key as keyof PosterConfig] as ElementPos)?.italic ? 'bg-white text-black border-white' : 'border-white/20 text-slate-500 hover:text-white' }`}
                            >
                              I
                            </button>
                          </>
                        )}
                        <button 
                          onClick={(e) => { e.stopPropagation(); setConfig(prev => ({ ...prev, [key]: { ...(prev[key] as ElementPos), visible: !(prev[key] as ElementPos).visible } })); }}
                          className={`text-[8px] px-3 py-1 rounded-full font-black transition-all ${ (config[key as keyof PosterConfig] as ElementPos)?.visible ? 'bg-white text-black' : 'bg-white/5 text-slate-600' }`}
                        >
                          { (config[key as keyof PosterConfig] as ElementPos)?.visible ? 'ACTIVE' : 'MUTED' }
                        </button>
                      </div>
                    </div>
                    { (config[key as keyof PosterConfig] as ElementPos)?.visible && (
                      <div className="space-y-5">
                        <div className="space-y-1.5">
                          <div className="flex justify-between text-[8px] font-bold text-slate-600 uppercase px-1">
                             <span>Scale Modifier</span>
                             <span className="text-slate-400">{(config[key as keyof PosterConfig] as ElementPos).scale.toFixed(1)}x</span>
                          </div>
                          <input 
                            type="range" min="0.2" max="2.5" step="0.1" 
                            value={(config[key as keyof PosterConfig] as ElementPos).scale}
                            onChange={(e) => updateScale(key as keyof PosterConfig, e.target.value)}
                            className="w-full accent-white h-1.5 bg-white/5 rounded-full appearance-none cursor-pointer"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          {color && (
                            <div className="flex flex-col gap-1.5">
                              <span className="text-[8px] font-bold text-slate-600 uppercase ml-1">Tint</span>
                              <input type="color" value={config[color as keyof PosterConfig] as string} onChange={(e) => setConfig({...config, [color]: e.target.value})} className="w-full h-8 bg-black border border-white/10 rounded-lg cursor-pointer opacity-80 hover:opacity-100 transition-all" />
                            </div>
                          )}
                          {bg && (
                            <div className="flex flex-col gap-1.5">
                              <span className="text-[8px] font-bold text-slate-600 uppercase ml-1">Fill</span>
                              <input type="color" value={config[bg as keyof PosterConfig] as string} onChange={(e) => setConfig({...config, [bg]: e.target.value})} className="w-full h-8 bg-black border border-white/10 rounded-lg cursor-pointer opacity-80 hover:opacity-100 transition-all" />
                            </div>
                          )}
                          {extraColors && extraColors.map(ec => (
                            <div key={ec.key} className="flex flex-col gap-1.5">
                              <span className="text-[8px] font-bold text-slate-600 uppercase ml-1">{ec.label}</span>
                              <input type="color" value={config[ec.key as keyof PosterConfig] as string} onChange={(e) => setConfig({...config, [ec.key]: e.target.value})} className="w-full h-8 bg-black border border-white/10 rounded-lg cursor-pointer opacity-80 hover:opacity-100 transition-all" />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          </div>
        </aside>
      </main>

      {showDeployModal && (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-[#121212] border border-white/10 max-w-2xl w-full rounded-[2.5rem] p-8 space-y-8 shadow-[0_0_100px_rgba(0,0,0,0.8)] max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-black text-white uppercase tracking-tighter">GitHub Deployment Center</h2>
                <p className="text-xs text-slate-500 uppercase font-bold tracking-widest mt-1">Setup Instructions</p>
              </div>
              <button onClick={() => setShowDeployModal(false)} className="w-10 h-10 bg-white/5 hover:bg-white/10 rounded-full flex items-center justify-center text-xl">✕</button>
            </div>

            <div className="grid gap-6">
              <div className="bg-blue-600/10 border border-blue-500/20 p-6 rounded-3xl space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">1</div>
                  <h3 className="text-sm font-black text-white uppercase">Critical Step (From your screenshot)</h3>
                </div>
                <div className="text-xs text-slate-400 space-y-3 leading-relaxed">
                  <p>In your GitHub repository settings, you are currently on the <strong>"Runners"</strong> tab. You need to switch to the <strong>"Pages"</strong> tab.</p>
                  <ol className="list-decimal ml-5 space-y-2">
                    <li>Look at the sidebar on the left side of your GitHub screen.</li>
                    <li>Scroll down and click on <strong>"Pages"</strong> (located under the 'Code and automation' section).</li>
                    <li>Ensure <strong>"Deploy from a branch"</strong> is selected.</li>
                    <li>Select <strong>Branch: main</strong> and folder <strong>/(root)</strong>.</li>
                    <li>Click <strong>Save</strong>.</li>
                  </ol>
                </div>
              </div>
              <div className="bg-white/5 border border-white/10 p-6 rounded-3xl space-y-4 text-xs text-slate-500">
                <p>Wait about 2 minutes after saving for the link to appear at the top of that screen.</p>
              </div>
            </div>
            <p className="text-center text-[9px] text-slate-600 font-bold uppercase tracking-widest">Aaiena Design Studio Support</p>
          </div>
        </div>
      )}
    </div>
  );
};

// --- MOUNTING (EXACT) ---
const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
