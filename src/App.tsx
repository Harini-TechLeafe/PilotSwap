import { useEffect, useState } from 'react';
import { ToastProvider } from './components/Toast';
import { WalletProvider } from './hooks/useWallet';
import WalletPicker from './components/WalletPicker';
import { ChainProvider } from './chains/ChainContext';
import Home from './pages/Home';
import Liquidity from './pages/Liquidity';

/** Tiny hash router: "#liquidity" shows the Liquidity page, everything else shows Home. */
function useIsLiquidity() {
  const get = () => window.location.hash === '#liquidity';
  const [on, setOn] = useState(get);
  useEffect(() => {
    const h = () => { setOn(get()); window.scrollTo({ top: 0 }); };
    window.addEventListener('hashchange', h);
    return () => window.removeEventListener('hashchange', h);
  }, []);
  return on;
}

export default function App() {
  const liquidity = useIsLiquidity();
  return (
    <ToastProvider>
      <ChainProvider>
        <WalletProvider>
          {liquidity ? <Liquidity /> : <Home />}
          <WalletPicker />
        </WalletProvider>
      </ChainProvider>
    </ToastProvider>
  );
}
