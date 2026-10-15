import { useEffect } from 'react';
import { ToastProvider } from './components/Toast';
import { WalletProvider } from './hooks/useWallet';
import WalletPicker from './components/WalletPicker';
import { ChainProvider } from './chains/ChainContext';
import Home from './pages/Home';
import Liquidity from './pages/Liquidity';
import Tokens from './pages/Tokens';
import NotFound from './pages/NotFound';
import Footer from './components/Footer';
import { SolanaProvider } from './hooks/useSolana';
import { ThemeProvider } from './hooks/useTheme';
import { usePath } from './lib/router';

/** Clean-URL routes: "/liquidity", "/tokens", "/tokens/usdc"; unknown paths show the 404 page. */
export default function App() {
  const path = usePath();
  const isLiquidity = path === '/liquidity';
  const isTokens = path === '/tokens' || path.startsWith('/tokens/');
  const isHome = path === '/';
  const isNotFound = !isHome && !isLiquidity && !isTokens;

  // Always start a new page at the top.
  useEffect(() => { window.scrollTo({ top: 0 }); }, [path]);

  return (
    <ThemeProvider>
      <ToastProvider>
        <ChainProvider>
          <WalletProvider>
            <SolanaProvider>
              {isNotFound ? <NotFound /> : isLiquidity ? <Liquidity /> : isTokens ? <Tokens path={path} /> : <Home />}
              <Footer />
              <WalletPicker />
            </SolanaProvider>
          </WalletProvider>
        </ChainProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
