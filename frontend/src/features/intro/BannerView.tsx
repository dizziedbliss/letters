import React from 'react';
import { BANNER_PX, type Banner } from './doc';
import { useMediaUrl } from './useMediaUrl';

/** The optional header image, edge to edge across the top of the page frame. */
export const BannerView: React.FC<{ banner: Banner }> = ({ banner }) => {
  const url = useMediaUrl(banner.src);
  return (
    <div className="-mx-6 -mt-4 mb-6 overflow-hidden rounded-b-3xl" style={{ height: BANNER_PX[banner.height] }}>
      {url ? (
        <img src={url} alt="" draggable={false} className="w-full h-full object-cover select-none" style={{ objectPosition: `50% ${banner.focus}%` }} />
      ) : (
        <div className="w-full h-full bg-white/10 animate-pulse" />
      )}
    </div>
  );
};

export default BannerView;
