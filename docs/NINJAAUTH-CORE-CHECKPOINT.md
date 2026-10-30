# NinjaAuth - Core Checkpoint 0.1

## 1. Obiettivo del progetto

NinjaAuth è l'SDK di autenticazione dell'ecosistema Ninja.

Il suo scopo è nascondere allo sviluppatore la complessità di OAuth 2.0, PKCE, state, sessioni e refresh, offrendo un'API semplice e coerente.

Principio guida:

> **NinjaAuth gestisce la complessità dell'autenticazione. La tua applicazione è responsabile dell'esperienza utente e dei dati dell'applicazione.**

L'applicazione che utilizza NinjaAuth rimane proprietaria dei propri dati applicativi e decide autonomamente come persistire il profilo utente.

---

## 2. Ecosistema

```text
                    ┌─────────────────────┐
                    │    Ninja Connect    │
                    │ Identity / Sessions │
                    └──────────┬──────────┘
                               │
                         OAuth / Session
                               │
                    ┌──────────▼──────────┐
                    │      NinjaAuth      │
                    │        SDK          │
                    └──────────┬──────────┘
                               │
              ┌────────────────┴────────────────┐
              │                                 │
      ┌───────▼────────┐                ┌───────▼────────┐
      │ Web Application│                │BrowserExtension│
      └────────────────┘                └────────────────┘
              │                                 │
              └────────── Application Data ─────┘
```

Ninja Connect utilizza Authgear come componente sottostante di identity management.

L'applicazione non deve avere accesso diretto ad Authgear né ai suoi secret.

---

# 3. API pubblica del Core

L'API pubblica prevista per il primo Core è volutamente piccola:

```ts
NinjaAuth.init(...)
NinjaAuth.login()
NinjaAuth.getSession()
NinjaAuth.logout()
```

### `init()`

Inizializza NinjaAuth.

Configurazione attuale:

```ts
interface NinjaAuthConfig {
    clientId: string;
    redirectUri: string;
    platform?: "web" | "extension";
}
```

`platform` deve avere default `web`.

Il Core non deve contenere logica specifica di Chrome o di una particolare piattaforma.

---

# 4. `login()`

Contratto desiderato:

```ts
const user = await NinjaAuth.login();

console.log(user.email);
console.log(user.name);
```

`login()` significa:

> **Autentica l'utente.**

Non deve richiedere allo sviluppatore di conoscere:

* OAuth authorization code flow
* PKCE
* state
* authorization URL
* token exchange
* session cookie
* refresh token

Il risultato del login è direttamente un:

```ts
NinjaUser
```

Struttura attuale:

```ts
interface NinjaUser {
    id: string;
    email?: string;
    name?: string;
    picture?: string;
}
```

---

## 5. `getSession()`

`getSession()` permette all'applicazione di verificare lo **stato corrente dell'autenticazione** senza avviare un nuovo login.

È utile, ad esempio, quando un'applicazione deve decidere cosa mostrare all'utente all'avvio:

```ts
const session = await NinjaAuth.getSession();

if (session.authenticated) {
    // Sessione attiva e valida
    showProtectedPage();
} else {
    // Nessuna sessione valida
    redirectToLogin();
}
```

Il metodo quindi non significa "fai il login", ma:

> **Dimmi se esiste una sessione di autenticazione valida per questo utente.**

Questo permette all'applicazione di gestire normalmente i propri flussi di navigazione:

```text
Application starts
       │
       ▼
getSession()
       │
       ├── authenticated: true
       │       │
       │       ▼
       │   Protected area
       │
       └── authenticated: false
               │
               ▼
             Login
```

`getSession()` non deve aprire popup, avviare OAuth o richiedere all'utente di autenticarsi nuovamente.

È particolarmente utile per:

* proteggere pagine o route;
* ripristinare lo stato di autenticazione dopo il caricamento dell'applicazione;
* verificare se una sessione esistente è ancora valida;
* decidere se mostrare l'area autenticata oppure il flusso di login.

Per il normale login dell'utente si utilizza invece:

```ts
const user = await NinjaAuth.login();
```

La distinzione fondamentale è quindi:

```text
login()      → Autentica l'utente
getSession() → Verifica lo stato di autenticazione corrente
logout()     → Termina la sessione
```


# 6. `logout()`

Contratto:

```ts
await NinjaAuth.logout();
```

Deve terminare la sessione attraverso Ninja Connect e ripulire lo stato client necessario.

Implementazione ancora da completare.

---

# 7. Architettura Core

Il Core deve essere platform-agnostic.

```text
NinjaAuth Core
│
├── OAuth
│   ├── Authorization URL
│   ├── PKCE
│   ├── State
│   └── Callback parsing
│
├── Session
│
├── User
│
└── Platform abstractions
    │
    ├── Web
    │   ├── AuthorizationLauncher
    │   └── TransactionStorage
    │
    └── Extension
        ├── AuthorizationLauncher
        └── TransactionStorage
```

Le implementazioni concrete vengono fornite dagli adapter di piattaforma.

Il Core non deve conoscere:

```ts
chrome.identity
window.open
document
localStorage
```

se non attraverso le rispettive astrazioni.

---

# 8. OAuth transaction

Il flusso utilizza:

1. PKCE verifier
2. PKCE challenge
3. state
4. redirect URI
5. transaction storage

Schema concettuale:

```text
login()
   │
   ├── generatePKCE()
   ├── generateState()
   │
   ├── save transaction
   │
   ├── buildAuthorizationUrl()
   │
   ├── AuthorizationLauncher
   │
   ├── receive callback
   │
   ├── parseAuthorizationCallback()
   │
   ├── retrieve transaction by state
   │
   ├── exchange authorization code
   │
   └── return NinjaUser
```

La transaction contiene attualmente:

```ts
{
    verifier: string;
    redirectUri: string;
    createdAt: number;
}
```

---

# 9. State

Implementazione attuale concettualmente:

```ts
export function generateState(length: number = 32): string {
    return Array.from(
        crypto.getRandomValues(new Uint8Array(length))
    )
        .map(b => b.toString(16).padStart(2, "0"))
        .join("");
}
```

`generateState()` è sincrona.

Non deve diventare `async` perché:

```ts
crypto.getRandomValues()
```

è sincrona.

---

# 10. PKCE

PKCE è asincrono perché il challenge utilizza:

```ts
crypto.subtle.digest()
```

Implementazione attuale:

```ts
export async function generatePKCE(): Promise<PKCEPair> {
    const array = new Uint8Array(32);

    crypto.getRandomValues(array);

    const verifier = base64UrlEncode(array);

    const digest = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(verifier)
    );

    const challenge = base64UrlEncode(
        new Uint8Array(digest)
    );

    return {
        verifier,
        challenge
    };
}
```

---

# 11. Extension flow

Per browser extension il launcher concreto utilizza:

```ts
chrome.identity.launchWebAuthFlow()
```

Questa è una responsabilità dell'adapter Chrome.

Il Core non deve contenere direttamente chiamate a `chrome.identity`.

---

# 12. Web flow

Il Web adapter dovrà utilizzare una normale popup browser.

Concettualmente:

```text
Web Application
      │
      │ window.open()
      ▼
Ninja Connect
      │
      │ OAuth
      ▼
Provider / Authgear
      │
      ▼
Ninja Connect callback
      │
      ▼
Registered application redirect URI
      │
      ▼
Popup callback
      │
      ▼
NinjaAuth
```

Non è previsto l'utilizzo di iframe nascosti.

---

# 13. Ninja Connect / Authgear

Ninja Connect rappresenta il layer pubblico di identity dell'ecosistema.

Authgear rimane un componente interno.

L'utente può autenticarsi tramite i provider configurati in Ninja Connect.

In futuro Ninja Connect potrà decidere quali provider sono disponibili per una determinata Client App / piano.

Il modello previsto è:

```text
Application
     │
     │ Sign in with Ninja Connect
     ▼
Ninja Connect
     │
     ├── Google
     ├── Apple
     ├── GitHub
     └── altri provider
```

NinjaAuth non deve conoscere direttamente la configurazione dei provider.

---

# 14. Provider selection - FUTURE FEATURE

È stata discussa la possibilità di avere un endpoint futuro come:

```text
/v1/auth/providers
```

che restituisca i provider disponibili per la Client App.

La UI Ninja Connect potrà quindi mostrare dinamicamente i pulsanti.

Esempio concettuale:

```text
FREE
 └── Google

PRO
 ├── Google
 ├── Apple
 └── GitHub

BUSINESS
 └── provider aggiuntivi
```

Non fa parte del Core 0.1.

---

# 15. `x_oauth_provider_alias`

Authgear supporta il parametro documentato:

```text
x_oauth_provider_alias
```

per indirizzare direttamente il flusso verso uno specifico provider configurato.

Questo deve essere utilizzato attraverso l'API documentata di Authgear, non attraverso elementi DOM interni della sua UI.

Anche questa è una feature di Ninja Connect, non una responsabilità del Core NinjaAuth.

---

# 16. Session architecture

Ninja Connect gestisce la sessione applicativa.

Dopo il token exchange viene creata una sessione Ninja.

Concettualmente:

```text
OAuth code
    │
    ▼
Ninja Connect
    │
    ├── Authgear token exchange
    │
    ├── resolve user
    │
    ├── generate session secret
    │
    ├── hash session secret
    │
    ├── encrypt refresh token
    │
    └── create auth session
             │
             ▼
       ninja_session cookie
```

La cookie è prevista come:

```text
HttpOnly
Secure
SameSite=Strict
Path=/
```

La sessione possiede una normale expiration e una absolute expiration.

Il refresh viene effettuato da Ninja Connect quando necessario.

---

# 17. Endpoint Ninja Connect coinvolti

Attualmente il Core dialoga principalmente con:

```text
POST /v1/exchange
GET  /v1/session
GET  /v1/user/me
```

### `/v1/exchange`

Riceve:

```text
grant_type
code
redirect_uri
client_id
code_verifier
```

ed esegue il token exchange.

### `/v1/session`

Restituisce lo stato della sessione.

Concettualmente:

```json
{
    "success": true,
    "data": {
        "authenticated": true,
        "user": {},
        "session": {
            "expiresAt": "...",
            "absoluteExpiresAt": "..."
        }
    }
}
```

oppure:

```json
{
    "success": true,
    "data": {
        "authenticated": false,
        "user": null,
        "session": null
    }
}
```

### `/v1/user/me`

Restituisce l'utente autenticato.

---

# 18. Punto da risolvere prima del test end-to-end

Esiste una discrepanza attuale tra SDK e `/v1/exchange`.

Lo SDK si aspetta:

```ts
return result.data.user as NinjaUser;
```

ma l'implementazione corrente di `/v1/exchange` non restituisce ancora necessariamente `data.user`.

Questo va risolto prima di considerare `login()` completato.

La decisione architetturale preferita è mantenere il contratto semplice:

```text
login()
   ↓
exchange
   ↓
Ninja Connect
   ↓
NinjaUser
```

così il chiamante riceve direttamente:

```ts
const user = await NinjaAuth.login();
```

senza dover effettuare una seconda richiesta a `/v1/user/me`.

---

# 19. Cleanup transaction

Il transaction state deve essere rimosso sia in caso di successo sia in caso di errore.

Pattern previsto:

```ts
try {
    const user = await this.exchangeCodeForToken(
        callback.code,
        returnedTransaction.verifier
    );

    return user;
} finally {
    await storage.remove(callback.state);
}
```

`finally` viene utilizzato esclusivamente per garantire il cleanup.

Gli errori devono continuare a propagarsi normalmente.

Non è necessario introdurre un `catch` se non c'è una specifica logica di error handling da eseguire.


# 20. Stato attuale del Core

### Completato / da completare

* [x] struttura Core
* [x] `init()`
* [x] `NinjaUser`
* [x] PKCE
* [x] state generation
* [x] authorization URL
* [x] callback parsing
* [x] transaction abstraction
* [x] Chrome transaction storage
* [x] Chrome authorization launcher
* [x] Chrome OAuth flow
* [x] code exchange
* [ ] verificare contratto definitivo `/v1/exchange` → `NinjaUser`

### Da completare nel Core

* [ ] Web AuthorizationLauncher
* [ ] Web TransactionStorage
* [ ] Web login flow
* [ ] `getSession()`
* [ ] `logout()`
* [ ] error model definitivo
* [ ] test end-to-end extension
* [ ] test end-to-end web
* [ ] cleanup e refactoring finale
* [ ] definizione release `0.1.0`

---

# 21. Cosa NON entra nel Core 0.1

Per evitare feature creep:

* provider management
* account linking
* device management
* MFA
* passkeys
* analytics
* application profile management
* database application-side
* notifiche
* piani FREE/PRO/BUSINESS
* gestione avanzata delle capabilities

Queste potranno essere costruite successivamente.

---

# 22. Filosofia del progetto

NinjaAuth deve seguire il principio:

> **Simple by default, powerful when needed.**

Per il 90% degli sviluppatori:

```ts
NinjaAuth.init({
    clientId: "...",
    redirectUri: "..."
});

const user = await NinjaAuth.login();
```

Per chi necessita di maggiore controllo:

```ts
const session = await NinjaAuth.getSession();
```

La complessità rimane sotto il cofano.

---

# 23. Definition of Done

Il Core NinjaAuth 0.1 sarà considerato chiuso quando sarà possibile fare realmente:

```ts
NinjaAuth.init(config);

const user = await NinjaAuth.login();

const session = await NinjaAuth.getSession();

await NinjaAuth.logout();
```

su:

```text
Browser Extension
Web Application
```

con:

* OAuth funzionante
* PKCE funzionante
* state verificato
* transaction storage funzionante
* sessione Ninja Connect funzionante
* refresh gestito da Ninja Connect
* error handling coerente
* nessuna dipendenza platform-specific nel Core
* nessun accesso dell'applicazione ad Authgear secret
* nessuna responsabilità del Core sulla persistenza dei dati applicativi

**Solo a questo punto il Core viene considerato stabile e si passa alle feature.**

---

# 25. Prossimo passo

Ordine di lavoro concordato:

```text
1. Fix init()
2. Fix transaction cleanup
3. Allineare /v1/exchange con NinjaUser
4. Chiudere Extension login end-to-end
5. Implementare Web adapter
6. Implementare Web login
7. Implementare getSession()
8. Implementare logout()
9. Test completo
10. Refactoring finale
11. Freeze Core 0.1
12. Documentazione
13. Feature layer
```

**Checkpoint:** NinjaAuth Core prima delle feature.
