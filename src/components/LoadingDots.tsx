import './pilot-loader.css';

/** Animated "..." (dot, dot, dot) shown after text while something is still in progress. */
export default function LoadingDots({ className = '' }: { className?: string }) {
  return (
    <span className={`pilot-dots font-bold ${className}`} aria-hidden="true">
      <span>.</span><span>.</span><span>.</span>
    </span>
  );
}
