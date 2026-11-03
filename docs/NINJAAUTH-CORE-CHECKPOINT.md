# NinjaAuth v1.0.1-beta — checkpoint di progetto

**Data:** 3 novembre 2026  
**Stato:** milestone interna nominata; release SDK non ancora pubblicata.

## Versione: distinzione necessaria

Il nome concordato per questo traguardo è **NinjaAuth v1.0.1-beta**. Al momento, però, i metadati reali del pacchetto non sono ancora allineati:

- package.json: 0.1.0.
- src/NinjaAuth.ts: VERSION = "0.1.0".
- dist/index.global.js: non rigenerato dopo l'ultima modifica al default scope.
- Bundle vendorizzato nell'estensione: contiene già lo scope openid profile email offline_access.

Quindi questo documento battezza il milestone di sviluppo; non dichiara una release pubblicata né autorizza a distribuire il pacchetto con un numero di versione non ancora incorporato negli artefatti.

## Cosa è implementato nel SDK

- init(): configurazione con client ID, redirect URI, platform ed environment.
- login(): Authorization Code + PKCE per Chrome Extension.
- State UUID e confronto del callback con lo state originario.
- Exchange JSON conforme al contratto Worker.
- Default scope letto da NINJA_CONNECT.DEFAULT_SCOPE.
- getSession(): lettura della sessione esistente, validazione del payload e distinzione tra sessione anonima ed errori operativi.
- logout(): revoca della sessione corrente tramite POST /v1/logout.
- Errori interni tipizzati, incluso TRANSACTION_CLEANUP_FAILED.
- Suite node:test presente con 20 casi top-level.

## Architettura confermata

- Ninja Connect è il broker centrale di identità e sessione.
- NinjaAuth è l'SDK client, non il proprietario del profilo applicativo.
- Ogni prodotto mantiene profili, ruoli, permessi, capability e regole business.
- AuthGear resta un provider upstream dietro Ninja Connect.
- Il cookie di sessione è HttpOnly; il client non legge né persiste il secret.
- getSession() non avvia login interattivo.
- Solo 401 INVALID_SESSION esplicito diventa una sessione non autenticata; gli errori temporanei restano errori.
- Web login non è implementato e deve continuare a fallire esplicitamente.

## Integrazione NinjaURL Extension

L'integrazione NinjaAuth è presente sul branch remoto Extension master al commit 9606469a3f6412c5d47c9ee83c38b359499e1e8d.

La variante cache-first di restoreSession() è presente sul branch remoto Extension dev (due commit avanti rispetto a master), non ancora su master:

- utente in chrome.storage.local: restituisce authenticated: true, user, session: null senza chiamare /v1/session;
- nessun utente in cache: chiama NinjaAuth getSession();
- errore temporaneo: non cancella la cache.

Il valore authenticated: true nel percorso cache-only ripristina l'interfaccia, ma non certifica una sessione valida. Prima di un'operazione protetta sarà necessario eseguire una verifica live con NinjaAuth. Questa guardia deve essere verificata e completata prima del rilascio.

## Verifiche disponibili e limiti

- Il test file SDK contiene 20 casi top-level.
- L'utente aveva riportato 20 test superati su un commit precedente; questo non sostituisce un'esecuzione sul commit release candidate corrente.
- Per il commit SDK più recente verificato non sono stati restituiti status check GitHub.
- La build Extension, il caricamento in Chrome e l'E2E reale con cookie HttpOnly/CORS non sono ancora verificati.
- I test RT-001/RT-002/RT-003 del Worker sono test concorrenti mirati con PostgreSQL reale e provider simulato; non sono E2E live.

## Definition of Done — beta package

- [ ] Aggiornare package.json e VERSION a 1.0.1-beta.
- [ ] Rigenerare dist/ e verificare che sorgente e bundle usino lo stesso default scope.
- [ ] Aggiornare il bundle IIFE vendorizzato nell'estensione.
- [ ] Eseguire npm run typecheck, npm test, npm run build sul commit esatto.
- [ ] Build e caricamento dell'estensione in Chrome.
- [ ] E2E: login, session lookup, logout, login successivo.
- [ ] Verifica cookie HttpOnly, CORS e ambiente development/production.
- [ ] Verifica del restore cache-first e della validazione live prima delle operazioni protette.
- [ ] Allineare documentazione, API, tipi, package metadata e artefatti distribuiti.

## Decisione

**NinjaAuth v1.0.1-beta nasce oggi come milestone di progetto.** La release tecnica sarà dichiarata soltanto quando tutti i punti obbligatori della Definition of Done saranno verificati sullo stesso commit e sugli stessi artefatti.
