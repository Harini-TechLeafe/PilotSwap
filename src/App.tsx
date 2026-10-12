import { ToastProvider } from './components/Toast';
import { WalletProvider } from './hooks/useWallet';
import WalletPicker from './components/WalletPicker';
import { ChainProvider } from './chains/ChainContext';
import Home from './pages/Home';

export default function App() {
  return (
    <ToastProvider>
      <ChainProvider>
        <WalletProvider>
          <Home />
          <WalletPicker />
        </WalletProvider>
      </ChainProvider>
    </ToastProvider>
  );
}
