// @solana/web3.js and @solana/spl-token expect a global Buffer; browsers do not have one.
// This file must be the FIRST import in main.tsx.
import { Buffer } from 'buffer';

(window as any).Buffer = (window as any).Buffer ?? Buffer;
