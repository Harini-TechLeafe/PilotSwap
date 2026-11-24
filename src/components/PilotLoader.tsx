import './pilot-loader.css';

/** PilotSwap logo animation shown while a wallet or on-chain transaction is in progress. */
export default function PilotLoader({ label = 'Please wait' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center py-2">
      <div className="pilot-loader" aria-hidden="true">
        <span className="ring ring-outer"><span className="dot dot-a" /></span>
        <span className="ring ring-inner"><span className="dot dot-b" /></span>
        <span className="glow" />
        <img src={`${import.meta.env.BASE_URL}logo-icon.png`} alt="" draggable={false} />
      </div>
      <p className="mt-2 text-sm font-medium text-slate-600">
        {label}
        <span className="pilot-dots" aria-hidden="true"><span>.</span><span>.</span><span>.</span></span>
      </p>
    </div>
  );
}
