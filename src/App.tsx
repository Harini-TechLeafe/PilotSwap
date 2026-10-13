import { useEffect, useState } from 'react';
import { ToastProvider } from './components/Toast';
import { WalletProvider } from './hooks/useWallet';
import WalletPicker from './components/WalletPicker';
import { ChainProvider } from './chains/ChainContext';
import Home from './pages/Home';
import Liquidity from './pages/Liquidity';
import Tokens from './pages/Tokens';

/** Tiny hash router: "#liquidity" = Liquidity, "#tokens" / "#tokens/usdc" = Explore Tokens, everything else = Home. */
function useHash() {
  const [hash, setHash] = useState(() => window.location.hash);
  useEffect(() => {
    const h = () => { setHash(window.location.hash); window.scrollTo({ top: 0 }); };
    window.addEventListener('hashchange', h);
    return () => window.removeEventListener('hashchange', h);
  }, []);
  return hash;
}

export default function App() {
  const hash = useHash();
  return (
    <ToastProvider>
      <ChainProvider>
        <WalletProvider>
          {hash === '#liquidity' ? <Liquidity /> : hash.startsWith('#tokens') ? <Tokens hash={hash} /> : <Home />}
          <WalletPicker />
        </WalletProvider>
      </ChainProvider>
    </ToastProvider>
  );
}
