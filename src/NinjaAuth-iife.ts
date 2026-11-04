import { NinjaAuth } from "./NinjaAuth";

// Espone la classe direttamente sullo scope globale del Service Worker
(self as any).NinjaAuth = NinjaAuth;