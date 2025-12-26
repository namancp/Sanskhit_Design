
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI } from "@google/genai";

// --- TYPES & INTERFACES ---
export enum AspectRatio {
  SQUARE = "1:1",
  STORY = "9:16",
  LANDSCAPE = "16:9",
  LINKEDIN = "4:3"
}

export interface ElementPos {
  x: number;
  y: number;
  scale: number;
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

// --- GEMINI SERVICE ---
const generatePosterBackground = async (
  prompt: string,
  aspectRatio: AspectRatio
): Promise<string> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey || apiKey === "YOUR_API_KEY_HERE") {
    throw new Error("Missing API Key. Please update YOUR_API_KEY_HERE in index.html.");
  }

  const ai = new GoogleGenAI({ apiKey });
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [{
          text: `High-quality cinematic background for a professional event poster. Scene: ${prompt}. Vibe: Ultra-modern, Dubai luxury, technology-centric. Composition: Negative space at top and bottom. No text in image.`
        }],
      },
      config: { imageConfig: { aspectRatio: aspectRatio as any } },
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
    }
    throw new Error("No image generated.");
  } catch (error: any) {
    throw error;
  }
};

// --- APP COMPONENT ---
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
      const d = Math.sqrt(Math.pow(pos.x - item.x, 2) + Math.pow(pos.y - item.y, 2));
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
      ctx.save();
      if (key === 'posLogo' && logoImgRef.current?.complete) {
        const lw = (canvas.width * 0.18) * pos.scale;
        const lh = (logoImgRef.current.height / logoImgRef.current.width) * lw;
        ctx.drawImage(logoImgRef.current, px(pos.x), py(pos.y), lw, lh);
        if(!isExporting && selectedElement === key) { ctx.strokeStyle = "#3b82f6"; ctx.lineWidth = 4; ctx.strokeRect(px(pos.x)-5, py(pos.y)-5, lw+10, lh+10); }
      } else if (key === 'posBrand') {
        ctx.textAlign = "center"; ctx.fillStyle = config.colorBrand; ctx.font = getFontStyle(pos, 0.04, canvas.width);
        ctx.fillText(config.brandName.toUpperCase(), px(pos.x), py(pos.y));
        if(!isExporting && selectedElement === key) { const tw = ctx.measureText(config.brandName.toUpperCase()).width; ctx.strokeStyle = "#3b82f6"; ctx.lineWidth = 4; ctx.strokeRect(px(pos.x) - (tw/2) - 10, py(pos.y) - 40, tw+20, 60); }
      } else if (key === 'posEventName') {
        ctx.textAlign = "center"; ctx.fillStyle = config.colorEvent; ctx.font = getFontStyle(pos, 0.03, canvas.width);
        ctx.fillText(config.eventName.toUpperCase(), px(pos.x), py(pos.y));
        if(!isExporting && selectedElement === key) { const tw = ctx.measureText(config.eventName.toUpperCase()).width; ctx.strokeStyle = "#3b82f6"; ctx.lineWidth = 4; ctx.strokeRect(px(pos.x) - (tw/2) - 10, py(pos.y) - 30, tw+20, 45); }
      } else if (key === 'posBadges') {
        ctx.textAlign = "left"; const scale = pos.scale; ctx.font = getFontStyle(pos, 0.026, canvas.width);
        ctx.fillStyle = config.bgColorBadge1; const dW = (ctx.measureText(config.duration).width + 34); const bH = (canvas.width * 0.055) * scale;
        ctx.beginPath(); ctx.roundRect(px(pos.x), py(pos.y), dW, bH, 10 * scale); ctx.fill();
        ctx.fillStyle = config.colorBadges; ctx.fillText(config.duration, px(pos.x) + (17 * scale), py(pos.y) + (bH/2) + (10 * scale));
        ctx.fillStyle = config.bgColorBadge2; const pW = (ctx.measureText(config.price).width + 34);
        ctx.beginPath(); ctx.roundRect(px(pos.x) + dW + (15 * scale), py(pos.y), pW, bH, 10 * scale); ctx.fill();
        ctx.fillStyle = config.colorBadges; ctx.fillText(config.price, px(pos.x) + dW + (32 * scale), py(pos.y) + (bH/2) + (10 * scale));
        if(!isExporting && selectedElement === key) { ctx.strokeStyle = "#3b82f6"; ctx.lineWidth = 4; ctx.strokeRect(px(pos.x)-5, py(pos.y)-5, dW + pW + (15*scale) + 10, bH + 10); }
      } else if (key === 'posHeadline') {
        ctx.textAlign = "center"; ctx.fillStyle = config.colorHeadline; ctx.font = getFontStyle(pos, 0.08, canvas.width);
        if(isExporting) { ctx.shadowBlur = 20; ctx.shadowColor = "rgba(0,0,0,0.5)"; }
        ctx.fillText(config.headline, px(pos.x), py(pos.y));
        if(!isExporting && selectedElement === key) { const tw = ctx.measureText(config.headline).width; ctx.strokeStyle = "#3b82f6"; ctx.lineWidth = 4; ctx.strokeRect(px(pos.x) - (tw/2) - 10, py(pos.y) - 60, tw+20, 80); }
      } else if (key === 'posSubHeadline') {
        ctx.textAlign = "center"; ctx.fillStyle = config.colorSubHeadline; ctx.font = getFontStyle(pos, 0.038, canvas.width);
        wrapText(ctx, config.subHeadline, px(pos.x), py(pos.y), canvas.width * 0.85, canvas.width * 0.055 * pos.scale);
        if(!isExporting && selectedElement === key) { ctx.strokeStyle = "#3b82f6"; ctx.lineWidth = 4; ctx.strokeRect(px(pos.x) - (canvas.width * 0.425), py(pos.y) - 30, canvas.width * 0.85, 100); }
      } else if (key === 'posQR' && qrImgRef.current?.complete) {
        const qw = (canvas.width * 0.14) * pos.scale;
        ctx.fillStyle = "white"; ctx.fillRect(px(pos.x) - (6 * pos.scale), py(pos.y) - (6 * pos.scale), qw + (12 * pos.scale), qw + (12 * pos.scale));
        ctx.drawImage(qrImgRef.current, px(pos.x), py(pos.y), qw, qw);
        if(!isExporting && selectedElement === key) { ctx.strokeStyle = "#3b82f6"; ctx.lineWidth = 4; ctx.strokeRect(px(pos.x)-10, py(pos.y)-10, qw+20, qw+20); }
      } else if (key === 'posCTA') {
        ctx.textAlign = "center"; const scale = pos.scale; ctx.font = getFontStyle(pos, 0.045, canvas.width);
        const txt = config.ctaText.toUpperCase(); const cW = (ctx.measureText(txt).width + 80); const cH = (canvas.width * 0.11) * scale;
        ctx.fillStyle = config.bgColorCTA; ctx.beginPath(); ctx.roundRect(px(pos.x) - (cW/2), py(pos.y), cW, cH, 20 * scale); ctx.fill();
        ctx.fillStyle = config.colorCTA; ctx.fillText(txt, px(pos.x), py(pos.y) + (cH/2) + (12 * scale));
        if(!isExporting && selectedElement === key) { ctx.strokeStyle = "#3b82f6"; ctx.lineWidth = 4; ctx.strokeRect(px(pos.x) - (cW/2) - 5, py(pos.y) - 5, cW + 10, cH + 10); }
      }
      ctx.restore();
    };
    ['posLogo', 'posBrand', 'posEventName', 'posBadges', 'posHeadline', 'posSubHeadline', 'posQR', 'posCTA'].forEach(k => drawElement(k as keyof PosterConfig));
  }, [config, selectedElement, activeDrag]);

  useEffect(() => {
    const l = new Image(); l.crossOrigin = "anonymous"; l.src = config.logoUrl; l.onload = () => { logoImgRef.current = l; drawCanvas(); };
    if (config.qrUrl) { const q = new Image(); q.crossOrigin = "anonymous"; q.src = config.qrUrl; q.onload = () => { qrImgRef.current = q; drawCanvas(); }; }
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

  const updateScale = (key: keyof PosterConfig, val: string) => {
    setConfig(prev => ({ ...prev, [key]: { ...(prev[key] as ElementPos), scale: parseFloat(val) } }));
  };

  const toggleStyle = (key: keyof PosterConfig, style: 'bold' | 'italic') => {
    setConfig(prev => ({ ...prev, [key]: { ...(prev[key] as ElementPos), [style]: !(prev[key] as any)[style] } }));
  };

  const handleExport = () => {
    drawCanvas(true); const canvas = canvasRef.current; if (!canvas) return;
    const link = document.createElement('a'); link.download = `aaiena-poster-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png', 1.0); link.click();
    setTimeout(() => drawCanvas(false), 100);
  };

  useEffect(() => { drawCanvas(false); }, [config, drawCanvas]);

  return (
    <div className="h-screen bg-[#050505] text-slate-300 font-sans flex flex-col overflow-hidden">
      <header className="h-16 px-6 flex items-center justify-between border-b border-white/5 bg-black/40 backdrop-blur-md z-50">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">A</div>
          <h1 className="text-xs font-black text-white uppercase tracking-tighter">Aaiena Design Studio</h1>
        </div>
        <div className="flex items-center gap-2 bg-white/5 p-1 rounded-xl">
          {Object.values(AspectRatio).map(ratio => (
            <button key={ratio} onClick={() => setConfig({...config, aspectRatio: ratio})} className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${config.aspectRatio === ratio ? 'bg-white text-black' : 'text-slate-500'}`}>{ratio}</button>
          ))}
        </div>
        <div className="flex gap-3">
          <button onClick={() => setShowDeployModal(true)} className="text-[10px] font-black uppercase text-slate-500 hover:text-white px-3 transition-all">Deployment</button>
          <button onClick={handleExport} className="bg-blue-600 text-white px-5 py-2 rounded-xl text-xs font-black uppercase shadow-lg shadow-blue-500/20 active:scale-95 transition-all">Export</button>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        <section className="flex-1 bg-[#0a0a0a] flex items-center justify-center p-8 relative overflow-hidden">
          <div className="absolute inset-0 opacity-5 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, #475569 1px, transparent 0)', backgroundSize: '32px 32px' }}></div>
          <div className="relative bg-black p-1 rounded-[2.5rem] border border-white/10 shadow-2xl">
            <canvas ref={canvasRef} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={() => setActiveDrag(null)} className="max-w-[calc(100vw-480px)] max-h-[calc(100vh-160px)] rounded-[2.2rem] cursor-grab active:cursor-grabbing shadow-2xl" />
            {isGenerating && <div className="absolute inset-0 bg-black/80 flex items-center justify-center rounded-[2.2rem] z-50 text-[10px] font-black uppercase text-white animate-pulse">Synthesizing Vision...</div>}
            {errorMsg && <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-red-600/90 text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase shadow-2xl z-[60]">⚠️ {errorMsg}</div>}
          </div>
        </section>

        <aside className="w-[420px] bg-[#0d0d0d] border-l border-white/5 flex flex-col overflow-hidden shadow-2xl">
          <div className="flex-1 overflow-y-auto p-6 space-y-8 pb-20">
            <section className="space-y-4">
              <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2"><span className="w-1 h-1 bg-blue-500 rounded-full"></span>Creative AI Vision</h3>
              <div className="bg-white/[0.03] border border-white/5 p-4 rounded-2xl space-y-3">
                <textarea className="w-full bg-black/40 border border-white/5 rounded-xl p-3 text-xs text-slate-300 min-h-[70px] outline-none" value={config.theme} onChange={e => setConfig({...config, theme: e.target.value})} />
                <button onClick={handleGenerate} disabled={isGenerating} className="w-full py-3 bg-blue-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all">Regenerate Background</button>
              </div>
            </section>

            <section className="space-y-4">
              <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Campaign Variables</h3>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                   <input type="text" className="w-full bg-white/5 border border-white/5 rounded-xl p-3 text-xs text-white outline-none" placeholder="Brand" value={config.brandName} onChange={e => setConfig({...config, brandName: e.target.value})} />
                   <input type="text" className="w-full bg-white/5 border border-white/5 rounded-xl p-3 text-xs text-white outline-none" placeholder="Event" value={config.eventName} onChange={e => setConfig({...config, eventName: e.target.value})} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                   <input type="text" className="w-full bg-white/5 border border-white/5 rounded-xl p-3 text-xs text-white outline-none" placeholder="Badge 1" value={config.duration} onChange={e => setConfig({...config, duration: e.target.value})} />
                   <input type="text" className="w-full bg-white/5 border border-white/5 rounded-xl p-3 text-xs text-white outline-none" placeholder="Badge 2" value={config.price} onChange={e => setConfig({...config, price: e.target.value})} />
                </div>
                <input type="text" className="w-full bg-white/5 border border-white/5 rounded-xl p-3 text-xs text-white font-bold outline-none" placeholder="Headline" value={config.headline} onChange={e => setConfig({...config, headline: e.target.value})} />
                <textarea className="w-full bg-white/5 border border-white/5 rounded-xl p-3 text-xs text-slate-400 outline-none resize-none" placeholder="Description" value={config.subHeadline} onChange={e => setConfig({...config, subHeadline: e.target.value})} />
              </div>
            </section>

            <section className="space-y-4">
              <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Studio Layer Mastery</h3>
              <div className="space-y-3">
                {[
                  { key: 'posLogo', label: 'Primary Logo' },
                  { key: 'posBrand', label: 'Brand Name', color: 'colorBrand' },
                  { key: 'posEventName', label: 'Event Identifier', color: 'colorEvent' },
                  { key: 'posHeadline', label: 'Headline Layer', color: 'colorHeadline' },
                  { key: 'posBadges', label: 'Info Badges', color: 'colorBadges', extra: [{k:'bgColorBadge1', l:'Fill 1'}, {k:'bgColorBadge2', l:'Fill 2'}] },
                  { key: 'posSubHeadline', label: 'Sub Headline', color: 'colorSubHeadline' },
                  { key: 'posCTA', label: 'Conversion Button', color: 'colorCTA', bg: 'bgColorCTA' },
                  { key: 'posQR', label: 'QR Destination' }
                ].map(({key, label, color, bg, extra}) => (
                  <div key={key} onClick={() => setSelectedElement(key as any)} className={`p-4 rounded-2xl border transition-all cursor-pointer ${selectedElement === key ? 'bg-blue-600/10 border-blue-500/50 scale-[1.02]' : 'bg-white/[0.02] border-white/5 hover:border-white/10'}`}>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[10px] font-black uppercase text-slate-300">{label}</span>
                      <div className="flex gap-2">
                        {key !== 'posLogo' && key !== 'posQR' && (
                          <div className="flex gap-1">
                            <button onClick={(e) => { e.stopPropagation(); toggleStyle(key as any, 'bold'); }} className={`w-5 h-5 text-[9px] font-bold border rounded ${(config[key as any] as any).bold ? 'bg-white text-black' : 'text-slate-500 border-white/10'}`}>B</button>
                            <button onClick={(e) => { e.stopPropagation(); toggleStyle(key as any, 'italic'); }} className={`w-5 h-5 text-[9px] italic border rounded ${(config[key as any] as any).italic ? 'bg-white text-black' : 'text-slate-500 border-white/10'}`}>I</button>
                          </div>
                        )}
                        <button onClick={(e) => { e.stopPropagation(); setConfig(p => ({...p, [key]: {...(p[key as any] as any), visible: !(p[key as any] as any).visible}})); }} className={`text-[8px] font-black px-2 py-0.5 rounded-full transition-all ${(config[key as any] as any).visible ? 'bg-blue-500 text-white' : 'bg-white/5 text-slate-600'}`}>{(config[key as any] as any).visible ? 'VISIBLE' : 'HIDDEN'}</button>
                      </div>
                    </div>
                    {(config[key as any] as any).visible && (
                      <div className="space-y-4 pt-2">
                        <div className="space-y-1">
                          <div className="flex justify-between text-[8px] font-bold text-slate-600 uppercase"><span>Scale Modifier</span><span>{(config[key as any] as any).scale.toFixed(1)}x</span></div>
                          <input type="range" min="0.2" max="3" step="0.1" value={(config[key as any] as any).scale} onChange={(e) => updateScale(key as any, e.target.value)} className="w-full accent-blue-500 h-1 bg-white/5 rounded-full appearance-none" />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          {color && (
                            <div className="space-y-1">
                              <span className="text-[8px] font-bold text-slate-600 uppercase">Tint</span>
                              <input type="color" value={(config as any)[color]} onChange={(e) => setConfig({...config, [color]: e.target.value})} className="w-full h-6 bg-transparent border border-white/10 rounded cursor-pointer" />
                            </div>
                          )}
                          {bg && (
                            <div className="space-y-1">
                              <span className="text-[8px] font-bold text-slate-600 uppercase">Fill</span>
                              <input type="color" value={(config as any)[bg]} onChange={(e) => setConfig({...config, [bg]: e.target.value})} className="w-full h-6 bg-transparent border border-white/10 rounded cursor-pointer" />
                            </div>
                          )}
                          {extra?.map(ex => (
                            <div key={ex.k} className="space-y-1">
                              <span className="text-[8px] font-bold text-slate-600 uppercase">{ex.l}</span>
                              <input type="color" value={(config as any)[ex.k]} onChange={(e) => setConfig({...config, [ex.k]: e.target.value})} className="w-full h-6 bg-transparent border border-white/10 rounded cursor-pointer" />
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
          <div className="bg-[#121212] border border-white/10 max-w-md w-full rounded-3xl p-8 space-y-6">
            <h2 className="text-xl font-black uppercase text-white">Deployment Tips</h2>
            <div className="text-xs text-slate-400 space-y-3 leading-relaxed">
              <p>1. Go to your GitHub Repository Settings.</p>
              <p>2. Click <strong>Pages</strong> in the sidebar.</p>
              <p>3. Select <strong>Deploy from branch</strong> (main/root).</p>
              <p>4. Save and wait 2 minutes.</p>
            </div>
            <button onClick={() => setShowDeployModal(false)} className="w-full py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl font-bold uppercase text-[10px]">Close</button>
          </div>
        </div>
      )}
    </div>
  );
};

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
