import { useEffect } from 'react';
import { ToastProvider } from './components/Toast';
import { WalletProvider } from './hooks/useWallet';
import WalletPicker from './components/WalletPicker';
import Home from './pages/Home';
import Liquidity from './pages/Liquidity';
import Tokens from './pages/Tokens';
import BuyUsdt from './pages/BuyUsdt';
import NotFound from './pages/NotFound';
import Footer from './components/Footer';
import { ThemeProvider } from './hooks/useTheme';
import { usePath } from './lib/router';
import { useDecimals } from './hooks/useDecimals';

/** Clean-URL routes: "/liquidity", "/buy-usdt", "/tokens", "/tokens/usdc"; unknown paths show the 404 page. */
export default function App() {
  const path = usePath();
  useDecimals();
  const isLiquidity = path === '/liquidity';
  const isTokens = path === '/tokens' || path.startsWith('/tokens/');
  const isBuyUsdt = path === '/buy-usdt';
  const isHome = path === '/';
  const isNotFound = !isHome && !isLiquidity && !isTokens && !isBuyUsdt;

  // Always start a new page at the top.
  useEffect(() => { window.scrollTo({ top: 0 }); }, [path]);

  return (
    <ThemeProvider>
      <ToastProvider>
        <WalletProvider>
          {isNotFound ? <NotFound /> : isLiquidity ? <Liquidity /> : isBuyUsdt ? <BuyUsdt /> : isTokens ? <Tokens path={path} /> : <Home />}
          <Footer />
          <WalletPicker />
        </WalletProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
