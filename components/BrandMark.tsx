/** WaterChain brand mark: a droplet holding the four linked pathway stages.
 *  Original, drawn for this redesign. Decorative when placed beside the wordmark. */
export default function BrandMark({ size = 38 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true" focusable="false">
      <path d="M20 3C14.5 11 8 18.5 8 25a12 12 0 0 0 24 0C32 18.5 25.5 11 20 3Z" fill="rgba(20,127,163,.10)" stroke="#147FA3" strokeWidth="1.6" />
      <polyline points="12,27 17,24 22,28 28,23" fill="none" stroke="#17324A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="27" r="2.2" fill="#147FA3" />
      <circle cx="17" cy="24" r="2.2" fill="#147FA3" />
      <circle cx="22" cy="28" r="2.2" fill="#147FA3" />
      <circle cx="28" cy="23" r="2.2" fill="#147FA3" />
    </svg>
  );
}
