
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { generatePosterBackground } from './services/gemini';
import { AspectRatio, PosterConfig, AAINEA_LOGO_DEFAULT, ElementPos } from './types';

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
    posBrand: { x: 50, y: 10, scale: 1.0, visible: true },
    posEventName: { x: 50, y: 62, scale: 1.0, visible: true },
    posBadges: { x: 5, y: 15, scale: 1.0, visible: true },
    posHeadline: { x: 50, y: 70, scale: 1.0, visible: true },
    posSubHeadline: { x: 50, y: 78, scale: 1.0, visible: true },
    posCTA: { x: 50, y: 90, scale: 1.0, visible: true },
    posQR: { x: 85, y: 85, scale: 1.0, visible: false }
  });

  const [isGenerating, setIsGenerating] = useState(false);
  const [activeDrag, setActiveDrag] = useState<DragState | null>(null);
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
    const clientX = 'touches' in e ? (e as React.TouchEvent).touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? (e as React.TouchEvent).touches[0].clientY : (e as React.MouseEvent).clientY;
    
    return {
      x: ((clientX - rect.left) / rect.width) * 100,
      y: ((clientY - rect.top) / rect.height) * 100
    };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    const pos = getCanvasMousePos(e);
    const elements: (keyof PosterConfig)[] = ['posLogo', 'posBrand', 'posEventName', 'posBadges', 'posHeadline', 'posSubHeadline', 'posCTA', 'posQR'];
    
    let closest: keyof PosterConfig | null = null;
    let minDist = 12;

    elements.forEach(key => {
      const item = config[key] as ElementPos;
      if (!item || !item.visible) return;
      const d = Math.sqrt(Math.pow(pos.x - item.x, 2) + Math.pow(pos.y - item.y, 2));
      if (d < minDist) {
        minDist = d;
        closest = key;
      }
    });
    
    if (closest) {
      const item = config[closest] as ElementPos;
      setActiveDrag({
        key: closest,
        offsetX: pos.x - item.x,
        offsetY: pos.y - item.y
      });
      e.preventDefault();
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!activeDrag) return;
    const pos = getCanvasMousePos(e);
    
    setConfig(prev => ({
      ...prev,
      [activeDrag.key]: { 
        ...(prev[activeDrag.key] as ElementPos), 
        x: Math.max(0, Math.min(100, pos.x - activeDrag.offsetX)), 
        y: Math.max(0, Math.min(100, pos.y - activeDrag.offsetY))
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

  const drawCanvas = useCallback(() => {
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

    if (config.posLogo.visible && logoImgRef.current?.complete) {
      const lw = (canvas.width * 0.18) * config.posLogo.scale;
      const lh = (logoImgRef.current.height / logoImgRef.current.width) * lw;
      ctx.drawImage(logoImgRef.current, px(config.posLogo.x), py(config.posLogo.y), lw, lh);
    }

    if (config.posBrand.visible) {
      ctx.textAlign = "center";
      ctx.fillStyle = config.colorBrand;
      ctx.font = `bold ${canvas.width * 0.04 * config.posBrand.scale}px Inter`;
      ctx.fillText(config.brandName.toUpperCase(), px(config.posBrand.x), py(config.posBrand.y));
    }

    if (config.posEventName.visible) {
      ctx.textAlign = "center";
      ctx.fillStyle = config.colorEvent;
      ctx.font = `bold ${canvas.width * 0.03 * config.posEventName.scale}px Inter`;
      ctx.fillText(config.eventName.toUpperCase(), px(config.posEventName.x), py(config.posEventName.y));
    }

    if (config.posBadges.visible) {
      ctx.textAlign = "left";
      const scale = config.posBadges.scale;
      ctx.font = `600 ${canvas.width * 0.026 * scale}px Inter`;
      const durTxt = config.duration;
      const prTxt = config.price;
      
      ctx.fillStyle = config.bgColorBadge1;
      const dW = (ctx.measureText(durTxt).width + 34);
      const bH = (canvas.width * 0.055) * scale;
      ctx.beginPath(); ctx.roundRect(px(config.posBadges.x), py(config.posBadges.y), dW, bH, 10 * scale); ctx.fill();
      ctx.fillStyle = config.colorBadges; ctx.fillText(durTxt, px(config.posBadges.x) + (17 * scale), py(config.posBadges.y) + (bH/2) + (10 * scale));

      ctx.fillStyle = config.bgColorBadge2;
      const pW = (ctx.measureText(prTxt).width + 34);
      ctx.beginPath(); ctx.roundRect(px(config.posBadges.x) + dW + (15 * scale), py(config.posBadges.y), pW, bH, 10 * scale); ctx.fill();
      ctx.fillStyle = config.colorBadges; ctx.fillText(prTxt, px(config.posBadges.x) + dW + (32 * scale), py(config.posBadges.y) + (bH/2) + (10 * scale));
    }

    if (config.posHeadline.visible) {
      ctx.textAlign = "center";
      ctx.fillStyle = config.colorHeadline;
      ctx.font = `900 ${canvas.width * 0.08 * config.posHeadline.scale}px Inter`;
      ctx.shadowBlur = 20; ctx.shadowColor = "rgba(0,0,0,0.5)";
      ctx.fillText(config.headline, px(config.posHeadline.x), py(config.posHeadline.y));
      ctx.shadowBlur = 0;
    }

    if (config.posSubHeadline.visible) {
      ctx.textAlign = "center";
      ctx.fillStyle = config.colorSubHeadline;
      const scale = config.posSubHeadline.scale;
      ctx.font = `500 ${canvas.width * 0.038 * scale}px Inter`;
      wrapText(ctx, config.subHeadline, px(config.posSubHeadline.x), py(config.posSubHeadline.y), canvas.width * 0.85, canvas.width * 0.055 * scale);
    }

    if (config.posQR.visible && qrImgRef.current?.complete) {
      const qw = (canvas.width * 0.14) * config.posQR.scale;
      ctx.fillStyle = "white";
      ctx.fillRect(px(config.posQR.x) - (6 * config.posQR.scale), py(config.posQR.y) - (6 * config.posQR.scale), qw + (12 * config.posQR.scale), qw + (12 * config.posQR.scale));
      ctx.drawImage(qrImgRef.current, px(config.posQR.x), py(config.posQR.y), qw, qw);
    }

    if (config.posCTA.visible) {
      ctx.textAlign = "center";
      const scale = config.posCTA.scale;
      ctx.font = `900 ${canvas.width * 0.045 * scale}px Inter`;
      const txt = config.ctaText.toUpperCase();
      const cW = (ctx.measureText(txt).width + 80);
      const cH = (canvas.width * 0.11) * scale;
      
      ctx.fillStyle = config.bgColorCTA;
      ctx.beginPath(); ctx.roundRect(px(config.posCTA.x) - (cW/2), py(config.posCTA.y), cW, cH, 20 * scale); ctx.fill();
      ctx.fillStyle = config.colorCTA; ctx.fillText(txt, px(config.posCTA.x), py(config.posCTA.y) + (cH/2) + (12 * scale));
    }
  }, [config]);

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

  const handleExport = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `aaiena-poster-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png', 1.0);
    link.click();
  };

  const handleShare = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    try {
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
      if (blob && navigator.share) {
        const file = new File([blob], "poster.png", { type: 'image/png' });
        await navigator.share({
          files: [file],
          title: 'Aaiena AdGen Poster',
          text: 'Check out this poster generated with Aaiena Studio!'
        });
      } else {
        handleExport();
      }
    } catch (err) {
      console.error("Share failed:", err);
      handleExport();
    }
  };

  useEffect(() => { drawCanvas(); }, [config, drawCanvas]);

  return (
    <div className="h-screen bg-[#050505] text-slate-300 font-sans flex flex-col overflow-hidden">
      {/* PROFESSIONAL HEADER */}
      <header className="h-16 px-6 flex items-center justify-between border-b border-white/5 bg-black/40 backdrop-blur-md z-50">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold shadow-lg shadow-blue-500/20">A</div>
          <div className="hidden sm:block">
            <h1 className="text-xs font-black text-white uppercase tracking-tighter">Aaiena Design Studio</h1>
            <p className="text-[9px] text-slate-500 uppercase font-bold tracking-[0.2em]">Ready for Production</p>
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
            <span>Deploy Help</span>
          </button>
          <button 
            onClick={handleExport}
            className="bg-blue-600 text-white px-5 py-2 rounded-xl text-xs font-black uppercase transition-all shadow-[0_0_20px_rgba(37,99,235,0.4)] hover:bg-blue-500 active:scale-95"
          >
            Download Final
          </button>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        {/* LEFT: INTERACTIVE CANVAS PREVIEW */}
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
                  Adjusting {activeDrag.key.replace('pos', '')}
                </div>
              )}

              {isGenerating && (
                <div className="absolute inset-0 bg-black/80 backdrop-blur-xl flex flex-col items-center justify-center z-50 rounded-[2.2rem]">
                  <div className="w-10 h-10 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mb-4"></div>
                  <p className="text-white font-black uppercase tracking-[0.4em] text-[10px]">Processing AI Visuals</p>
                </div>
              )}
            </div>
          </div>
          
          <div className="mt-8 flex items-center gap-4">
             <div className="flex items-center gap-2 bg-white/5 border border-white/10 px-4 py-2 rounded-full">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Aaiena Production Studio 1.0</span>
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
             </div>
          </div>
        </section>

        {/* RIGHT: CONTROL CENTER */}
        <aside className="w-[420px] bg-[#0d0d0d] border-l border-white/5 flex flex-col overflow-hidden shadow-2xl">
          <div className="flex-1 overflow-y-auto scrollbar-hide p-6 space-y-8">
            {/* 1. AI Scene Engine */}
            <section className="space-y-4">
              <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <span className="w-1 h-1 bg-blue-500 rounded-full"></span>
                AI Creative Vision
              </h3>
              <div className="bg-white/[0.03] border border-white/5 p-4 rounded-2xl space-y-3">
                <textarea 
                  className="w-full bg-black/40 border border-white/5 rounded-xl p-3 text-xs text-slate-300 min-h-[70px] focus:border-blue-500/50 outline-none transition-all resize-none" 
                  value={config.theme} 
                  onChange={e => setConfig({...config, theme: e.target.value})}
                  placeholder="Describe your scene..."
                />
                <button
                  onClick={handleGenerate}
                  disabled={isGenerating}
                  className="w-full py-3 bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-blue-500/10"
                >
                  {isGenerating ? "Synthesizing Image..." : "Regenerate Background"}
                </button>
              </div>
            </section>

            {/* 2. Content Matrix */}
            <section className="space-y-4">
              <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Campaign Parameters</h3>
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
                    <label className="text-[8px] font-bold text-slate-600 uppercase ml-1">Left Badge (Batch)</label>
                    <input type="text" className="w-full bg-white/[0.03] border border-white/5 rounded-xl p-3 text-xs text-white outline-none focus:border-white/20" value={config.duration} onChange={e => setConfig({...config, duration: e.target.value})} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[8px] font-bold text-slate-600 uppercase ml-1">Right Badge (Price)</label>
                    <input type="text" className="w-full bg-white/[0.03] border border-white/5 rounded-xl p-3 text-xs text-white outline-none focus:border-white/20" value={config.price} onChange={e => setConfig({...config, price: e.target.value})} />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[8px] font-bold text-slate-600 uppercase ml-1">Main Headline</label>
                  <input type="text" className="w-full bg-white/[0.03] border border-white/5 rounded-xl p-3 text-xs font-black text-white outline-none focus:border-white/20" value={config.headline} onChange={e => setConfig({...config, headline: e.target.value})} />
                </div>

                <div className="space-y-1">
                  <label className="text-[8px] font-bold text-slate-600 uppercase ml-1">Sub Headline / Description</label>
                  <textarea className="w-full bg-white/[0.03] border border-white/5 rounded-xl p-3 text-xs min-h-[60px] text-slate-400 outline-none focus:border-white/20 resize-none" value={config.subHeadline} onChange={e => setConfig({...config, subHeadline: e.target.value})} />
                </div>

                <div className="space-y-1">
                  <label className="text-[8px] font-bold text-slate-600 uppercase ml-1">CTA Action Label</label>
                  <input type="text" className="w-full bg-white/[0.03] border border-white/5 rounded-xl p-3 text-xs text-white outline-none focus:border-white/20" value={config.ctaText} onChange={e => setConfig({...config, ctaText: e.target.value})} />
                </div>
              </div>
            </section>

            {/* 3. Assets Forge */}
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

            {/* 4. Layer Stack Mastery */}
            <section className="space-y-4 pb-12">
              <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Studio Layer Styling</h3>
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
                  { key: 'posCTA', label: 'Conversion Button', color: 'colorCTA', bg: 'bgColorCTA' },
                  { key: 'posQR', label: 'QR Destination', color: null }
                ].map(({key, label, color, bg, extraColors}) => (
                  <div key={key} className={`p-5 rounded-2xl border transition-all ${activeDrag?.key === key ? 'bg-blue-600/10 border-blue-500/50 scale-[1.02]' : 'bg-white/[0.02] border-white/5'}`}>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                         <div className={`w-1.5 h-1.5 rounded-full ${activeDrag?.key === key ? 'bg-blue-500 animate-pulse' : 'bg-slate-700'}`}></div>
                         <span className="text-[10px] font-black uppercase text-slate-300 tracking-tight">{label}</span>
                      </div>
                      <button 
                        onClick={() => setConfig(prev => ({ ...prev, [key]: { ...(prev[key] as ElementPos), visible: !(prev[key] as ElementPos).visible } }))}
                        className={`text-[8px] px-3 py-1 rounded-full font-black transition-all ${ (config[key as keyof PosterConfig] as ElementPos)?.visible ? 'bg-white text-black' : 'bg-white/5 text-slate-600' }`}
                      >
                        { (config[key as keyof PosterConfig] as ElementPos)?.visible ? 'ACTIVE' : 'MUTED' }
                      </button>
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
                              <span className="text-[8px] font-bold text-slate-600 uppercase ml-1">Text Tint</span>
                              <input type="color" value={config[color as keyof PosterConfig] as string} onChange={(e) => setConfig({...config, [color]: e.target.value})} className="w-full h-8 bg-black border border-white/10 rounded-lg cursor-pointer opacity-80 hover:opacity-100 transition-all" />
                            </div>
                          )}
                          {bg && (
                            <div className="flex flex-col gap-1.5">
                              <span className="text-[8px] font-bold text-slate-600 uppercase ml-1">Fill Color</span>
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

      {/* DEPLOYMENT CENTER MODAL */}
      {showDeployModal && (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-[#121212] border border-white/10 max-w-2xl w-full rounded-[2.5rem] p-8 space-y-8 shadow-[0_0_100px_rgba(0,0,0,0.8)] max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-black text-white uppercase tracking-tighter">Deployment Center</h2>
                <p className="text-xs text-slate-500 uppercase font-bold tracking-widest mt-1">Manual Publishing Guide</p>
              </div>
              <button onClick={() => setShowDeployModal(false)} className="w-10 h-10 bg-white/5 hover:bg-white/10 rounded-full flex items-center justify-center text-xl">✕</button>
            </div>

            <div className="grid gap-6">
              {/* Option 1: GitHub Auth Fix */}
              <div className="bg-blue-600/5 border border-blue-500/20 p-6 rounded-3xl space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">1</div>
                  <h3 className="text-sm font-black text-white uppercase">Fixing GitHub Auth</h3>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  If the GitHub link failed with an "Authentication Error", try these steps:
                  <ul className="list-disc ml-4 mt-2 space-y-1">
                    <li>Logout from this platform and log back in.</li>
                    <li>Ensure you have granted "Repository" permissions to the app.</li>
                    <li>Check if your GitHub account has a verified email.</li>
                  </ul>
                </p>
              </div>

              {/* Option 2: Manual Publish */}
              <div className="bg-white/5 border border-white/10 p-6 rounded-3xl space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center text-white font-bold">2</div>
                  <h3 className="text-sm font-black text-white uppercase">Manual Publication (Plan B)</h3>
                </div>
                <p className="text-xs text-slate-400">Can't connect GitHub? Don't worry. You can manually host this in 2 minutes:</p>
                <div className="grid grid-cols-2 gap-3">
                  <a href="https://app.netlify.com/drop" target="_blank" className="bg-white/5 border border-white/10 p-4 rounded-2xl text-center hover:bg-white/10 transition-all">
                    <span className="block text-[18px] mb-1">🔗</span>
                    <span className="text-[9px] font-black uppercase text-white">Netlify Drop</span>
                  </a>
                  <a href="https://vercel.com/import" target="_blank" className="bg-white/5 border border-white/10 p-4 rounded-2xl text-center hover:bg-white/10 transition-all">
                    <span className="block text-[18px] mb-1">⚡</span>
                    <span className="text-[9px] font-black uppercase text-white">Vercel Import</span>
                  </a>
                </div>
              </div>

              {/* Option 3: Copy Code */}
              <div className="bg-white/5 border border-white/10 p-6 rounded-3xl space-y-3">
                <div className="flex items-center gap-3">
                   <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center text-white font-bold">3</div>
                   <h3 className="text-sm font-black text-white uppercase">Export Configuration</h3>
                </div>
                <button 
                  onClick={() => {
                    const blob = new Blob([JSON.stringify(config, null, 2)], {type: 'application/json'});
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url; link.download = 'aaiena-config.json'; link.click();
                  }}
                  className="w-full py-4 bg-white text-black rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-all"
                >
                  Download Project JSON Config
                </button>
              </div>
            </div>
            
            <p className="text-center text-[9px] text-slate-600 font-bold uppercase tracking-widest">
              Aaiena Studio Technical Support Tool
            </p>
          </div>
        </div>
      )}
      
      {/* MOBILE FOOTER */}
      <footer className="md:hidden h-20 bg-black border-t border-white/10 flex items-center justify-around px-4 pb-4">
        <button onClick={handleShare} className="flex flex-col items-center gap-1.5 group">
          <div className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center text-xl transition-all active:scale-90 group-hover:bg-white/10">📤</div>
          <span className="text-[8px] font-black uppercase text-slate-500">Share</span>
        </button>
        <button onClick={handleExport} className="flex flex-col items-center gap-1.5 group">
          <div className="w-10 h-10 bg-blue-600/20 rounded-full flex items-center justify-center text-xl text-blue-500 transition-all active:scale-90 group-hover:bg-blue-600/30">💾</div>
          <span className="text-[8px] font-black uppercase text-blue-500">Download</span>
        </button>
        <button onClick={() => setShowDeployModal(true)} className="flex flex-col items-center gap-1.5 group">
          <div className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center text-xl transition-all active:scale-90 group-hover:bg-white/10">ℹ️</div>
          <span className="text-[8px] font-black uppercase text-slate-500">Deploy Help</span>
        </button>
      </footer>
    </div>
  );
};

export default App;
