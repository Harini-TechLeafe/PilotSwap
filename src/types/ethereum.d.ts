// Minimal EIP-1193 typing for the injected MetaMask provider.
interface EthereumProvider {
  isMetaMask?: boolean;
  providers?: EthereumProvider[];
  request(args: { method: string; params?: unknown[] | object }): Promise<unknown>;
  on(event: string, handler: (...args: any[]) => void): void;
  removeListener(event: string, handler: (...args: any[]) => void): void;
}
interface Window {
  ethereum?: EthereumProvider;
}
