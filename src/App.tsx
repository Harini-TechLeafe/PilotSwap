import { useEffect } from 'react';
import { ToastProvider } from './components/Toast';
import { WalletProvider } from './hooks/useWallet';
import WalletPicker from './components/WalletPicker';
import { ChainProvider } from './chains/ChainContext';
import Home from './pages/Home';
import Liquidity from './pages/Liquidity';
import Tokens from './pages/Tokens';
import { SolanaProvider } from './hooks/useSolana';
import { ThemeProvider } from './hooks/useTheme';
import { navigate, usePath } from './lib/router';

/** Clean-URL routes: "/liquidity", "/tokens", "/tokens/usdc"; everything else is Home ("/"). */
export default function App() {
  const path = usePath();
  const isLiquidity = path === '/liquidity';
  const isTokens = path === '/tokens' || path.startsWith('/tokens/');
  const isHome = !isLiquidity && !isTokens;

  // Unknown URLs show Home; tidy the address bar to "/".
  useEffect(() => { if (isHome && path !== '/') navigate('/', { replace: true }); }, [isHome, path]);
  // Always start a new page at the top.
  useEffect(() => { window.scrollTo({ top: 0 }); }, [isLiquidity, isTokens]);

  return (
    <ThemeProvider>
      <ToastProvider>
        <ChainProvider>
          <WalletProvider>
            <SolanaProvider>
              {isLiquidity ? <Liquidity /> : isTokens ? <Tokens path={path} /> : <Home />}
              <WalletPicker />
            </SolanaProvider>
          </WalletProvider>
        </ChainProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
