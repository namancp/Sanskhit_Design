
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
  // Colors
  colorBrand: string;
  colorEvent: string;
  colorHeadline: string;
  colorSubHeadline: string;
  colorCTA: string;
  bgColorCTA: string;
  colorBadges: string;
  bgColorBadge1: string;
  bgColorBadge2: string;
  // Positions & Scales
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
