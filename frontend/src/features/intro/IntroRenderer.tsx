import React, { useEffect, useRef, useState } from 'react';
import { DESIGN_WIDTH, embedUrl, themeFor, type Align, type Block, type IntroDoc, type Sticker } from './doc';
import { useMediaUrl } from './useMediaUrl';
import { paragraphs } from '../../hooks/useMyIntro';

const MAX_SCALE = 1.2; // laptops get a bigger page, not a different layout

const justify: Record<Align, string> = { left: 'justify-start', center: 'justify-center', right: 'justify-end' };
const textAlign: Record<Align, string> = { left: 'text-left', center: 'text-center', right: 'text-right' };

const BUTTON_COLORS = {
  cyan: 'bg-brand-cyan text-black hover:shadow-[0_0_20px_rgba(0,216,255,0.6)]',
  purple: 'bg-brand-purple text-white hover:shadow-[0_0_20px_rgba(97,0,216,0.6)]',
  white: 'bg-white text-black hover:shadow-[0_0_20px_rgba(255,255,255,0.5)]',
  ink: 'bg-ink text-white hover:shadow-[0_0_20px_rgba(17,17,20,0.5)]',
};

const Img: React.FC<{ src: string; alt?: string; className?: string; style?: React.CSSProperties }> = ({ src, alt, className, style }) => {
  const url = useMediaUrl(src);
  if (!url) return <div className={`${className} bg-white/5 animate-pulse aspect-square`} style={style} />;
  return <img src={url} alt={alt ?? ''} draggable={false} className={className} style={style} />;
};

const BlockView: React.FC<{ block: Block; ink: string; strong: string; onButton?: () => void }> = ({ block, ink, strong, onButton }) => {
  switch (block.type) {
    case 'heading': {
      const { text, accent, size = 'lg', align = 'left', color } = block.props;
      return (
        <h1
          className={`tracking-tight leading-tight mb-2 ${textAlign[align]}`}
          style={{ fontSize: size === 'xl' ? 48 : 38, color: color ?? strong }}
        >
          {text && <span className="font-heading font-medium">{text}</span>}
          {accent && <span className="font-body italic font-normal">{accent}</span>}
        </h1>
      );
    }
    case 'text': {
      const { text, size = 'md', italic, align = 'left', color } = block.props;
      if (!text.trim()) return null;
      return (
        <div
          className={`font-body leading-relaxed space-y-6 whitespace-pre-line ${italic ? 'italic' : ''} ${textAlign[align]}`}
          style={{ fontSize: size === 'lg' ? 22 : size === 'sm' ? 16 : 18, color: color ?? ink }}
        >
          {paragraphs(text).map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      );
    }
    case 'image': {
      const { src, width = 1, align = 'center', rounded, alt } = block.props;
      return (
        <div className={`flex ${justify[align]}`}>
          <Img
            src={src}
            alt={alt}
            className={`h-auto object-contain select-none ${rounded ? 'rounded-2xl' : ''}`}
            style={{ width: `${Math.round(Math.min(1, Math.max(0.15, width)) * 100)}%` }}
          />
        </div>
      );
    }
    case 'embed': {
      const player = embedUrl(block.props.url);
      if (!player) {
        return (
          <a href={block.props.url} target="_blank" rel="noreferrer" className="font-body underline break-all" style={{ color: ink }}>
            {block.props.url}
          </a>
        );
      }
      const spotify = player.includes('spotify.com');
      return (
        <iframe
          src={player}
          title="embedded player"
          loading="lazy"
          allow="autoplay; clipboard-write; encrypted-media; picture-in-picture"
          className="w-full rounded-xl border-0"
          style={spotify ? { height: 152 } : { aspectRatio: '16 / 9' }}
        />
      );
    }
    case 'button': {
      const { label, color = 'cyan', align = 'left' } = block.props;
      return (
        <div className={`flex ${justify[align]}`}>
          <button
            type="button"
            onClick={onButton}
            className={`inline-flex items-center justify-center px-6 py-2 rounded-full font-body text-lg font-semibold tracking-wide transition-all duration-200 hover:scale-105 active:scale-95 cursor-pointer ${BUTTON_COLORS[color]}`}
          >
            {label || 'open :3'}
          </button>
        </div>
      );
    }
  }
};

const StickerView: React.FC<{ sticker: Sticker }> = ({ sticker: s }) => {
  const style: React.CSSProperties = {
    left: s.x,
    top: s.y,
    width: s.width,
    zIndex: 10 + s.z,
    transform: `rotate(${s.rotation}deg)`,
  };
  return s.kind === 'emoji' ? (
    <span className="absolute leading-none text-center select-none" style={{ ...style, fontSize: s.width * 0.85 }}>
      {s.value}
    </span>
  ) : (
    <Img src={s.value} className="absolute h-auto select-none" style={style} />
  );
};

interface IntroRendererProps {
  doc: IntroDoc;
  onButton?: () => void;
}

/**
 * Draws an intro doc at DESIGN_WIDTH and scales it to the available width.
 * The page background is the caller's job (see `themeFor`), since it fills the screen.
 */
export const IntroRenderer: React.FC<IntroRendererProps> = ({ doc, onButton }) => {
  const outerRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ scale: 1, height: 0, offset: 0 });
  const theme = themeFor(doc.background);

  useEffect(() => {
    const outer = outerRef.current!;
    const frame = frameRef.current!;
    const measure = () => {
      const scale = Math.min(outer.clientWidth / DESIGN_WIDTH, MAX_SCALE);
      setBox({
        scale,
        height: frame.offsetHeight * scale, // offsetHeight ignores the transform
        offset: (outer.clientWidth - DESIGN_WIDTH * scale) / 2,
      });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(outer);
    ro.observe(frame);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={outerRef} className="relative w-full" style={{ height: box.height || undefined }}>
      <div
        ref={frameRef}
        className="absolute top-0 left-0 px-6 py-4 flex flex-col gap-6"
        style={{
          width: DESIGN_WIDTH,
          transform: `translateX(${box.offset}px) scale(${box.scale})`,
          transformOrigin: 'top left',
        }}
      >
        {doc.blocks.map((b) => (
          <BlockView key={b.id} block={b} ink={theme.ink} strong={theme.strong} onButton={onButton} />
        ))}
        {doc.stickers.map((s) => (
          <StickerView key={s.id} sticker={s} />
        ))}
      </div>
    </div>
  );
};

export default IntroRenderer;
