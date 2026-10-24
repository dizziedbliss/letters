import React from 'react';
import { useMediaUrl } from '../intro/useMediaUrl';

/** A full-screen background image, dimmed so text stays readable. */
export const PageBackgroundImage: React.FC<{ src: string }> = ({ src }) => {
  const url = useMediaUrl(src);
  if (!url) return null;
  return (
    <div className="fixed inset-0 bg-cover bg-center pointer-events-none" style={{ backgroundImage: `url(${url})` }}>
      <div className="absolute inset-0 bg-black/35" />
    </div>
  );
};

export default PageBackgroundImage;
