# NinjaAuth — Core Checkpoint 0.1

> **Aggiornato:** 31 ottobre 2026  
> Per lo stato operativo completo e le priorità consultare la [roadmap](ROADMAP.md). Questo checkpoint raccoglie le decisioni architetturali e la Definition of Done del Core.

## 1. Obiettivo

NinjaAuth è l'SDK TypeScript che permette a un'applicazione di utilizzare Ninja Connect per autenticazione, identità condivisa e sessione.

Principio guida:

> **NinjaAuth gestisce la complessità dell'autenticazione. L'applicazione rimane responsabile dei propri dati e delle proprie autorizzazioni.**

NinjaAuth deve poter essere utilizzato dai prodotti dell'ecosistema Ninja e da sviluppatori/applicazioni esterne all'ecosistema.

## 2. Confini architetturali

### Ninja Connect

Ninja Connect è l'Identity Broker centrale e gestisce autenticazione tramite identity provider, identità Ninja Connect condivisa e sessione centrale.

AuthGear è il provider attuale, ma resta un dettaglio upstream dietro Ninja Connect. Le sessioni SSO AuthGear non sono le righe `auth_sessions` di Ninja Connect: il logout AuthGear non modifica direttamente il database delle sessioni Ninja.

Ninja Connect non gestisce il modello di autorizzazione specifico di ogni prodotto.

### NinjaAuth SDK

Il client SDK orchestra PKCE, OAuth state, launcher e transaction storage specifici della piattaforma, callback, code exchange e API pubblica per login, sessione e logout. Il contratto pubblico deve restare provider-neutral: l'SDK parla con Ninja Connect `/v1/*`, non direttamente con gli endpoint AuthGear `/oauth2/*`.

Non deve accedere a database, chiavi di cifratura o session secret grezzi.

### Applicazioni

Ogni applicazione gestisce autonomamente profilo applicativo, ruoli, permessi, capabilities, dati e regole di business.

NinjaURL non deve conoscere NinjaReviews e viceversa.

### NinjaAppAdapter<TProfile>

L'adapter applicativo è il confine opzionale che permette ai prodotti first-party di associare un profilo tipizzato all'identità condivisa senza contaminare NinjaUser.

Non è un OAuth/platform adapter. Non centralizza RBAC in Ninja Connect e non è necessario per l'uso standalone.

**Stato:** decisione architetturale definita; non dichiarare il tipo come API pubblica disponibile finché non sarà implementato ed esportato.

## 3. API pubblica prevista

Il Core espone concettualmente:

~~~ts
NinjaAuth.init(config);
const user = await NinjaAuth.login();
const session = await NinjaAuth.getSession();
await NinjaAuth.logout();
~~~

La firma e i tipi definitivi devono essere verificati sulla reale implementazione prima del rilascio.

## 4. Sessione centrale

Dopo il token exchange, Ninja Connect risolve l'identità, genera un session secret casuale, memorizza nel database solo l'hash del secret, conserva il refresh token upstream cifrato e imposta il cookie ninja_session.

Il cookie è HttpOnly e deve restare opaco al codice JavaScript dell'SDK. La sessione ha una scadenza ordinaria e una scadenza assoluta. Il refresh non deve estendere la scadenza assoluta e non deve riattivare una sessione revocata.

## 5. Concorrenza — verifiche completate

Tre scenari critici del Worker hanno superato test d'integrazione PostgreSQL (per RT-003 il proprietario del progetto ha riferito CI riuscita; il run va ricontrollato prima di considerarlo audit indipendente):

| Test | Invariante | Esito |
|---|---|---|
| RT-001 | Un refresh concorrente obsoleto che riceve invalid_grant non deve revocare la sessione già aggiornata da un'altra richiesta | PASS |
| RT-002 | Un logout completato mentre refresh è in volo deve prevalere; il refresh non deve riattivare la sessione locale | PASS |
| RT-003 | Un logout committato prima della revalidazione finale del resolver deve impedire il ritorno di un contesto autenticato | Test d'integrazione aggiunto; CI owner-reported PASS |

I test sono stati eseguiti sul branch test/auth-refresh-concurrency-rt001 del repository NinjaURL, con PostgreSQL/Neon reale e risposte HTTP dell'identity provider simulate.

- [CI RT-001](https://github.com/HanamiSoftware/NinjaURL-URL-Shortener/actions/runs/41073531083)
- [CI RT-002](https://github.com/HanamiSoftware/NinjaURL-URL-Shortener/actions/runs/41078846722)
- [CI RT-003](https://github.com/HanamiSoftware/NinjaURL-URL-Shortener/actions/runs/41196276386) — risultato riportato come PASS dal proprietario; da ricontrollare indipendentemente.

Questi risultati dimostrano gli specifici scenari orchestrati, non tutte le possibili interleaving. I test non sono un E2E live con Authgear. Le modifiche non risultano mergeate né deployate.

RT-003 aggiunge una lettura finale della riga `auth_sessions` dopo il refresh e il recupero dell'utente, rifiutando sessione assente, revocata o scaduta. Copre i logout committati prima di tale lettura; non impedisce un logout che avvenga subito dopo il controllo finale.

Restano da analizzare:
- refresh upstream che restituisce un nuovo token dopo che il logout ha già tentato la revoca del token precedente;
- ulteriori ordinamenti, timeout e failure path prioritizzati in base al rischio.

## 6. Stato SDK attuale

Il codice SDK sul branch principale non è ancora allineato al contratto Worker:

- il client usa ancora un endpoint localhost hardcoded;
- il code exchange invia form-urlencoded mentre il Worker si aspetta JSON;
- il client non invia state e il formato generato non corrisponde all'UUID richiesto;
- il confronto esplicito del callback state è da completare;
- logout è ancora un TODO nell'SDK, sebbene la route Worker `/v1/logout` esista e sia stata provata manualmente;
- il flusso Web non è implementato;
- il package non ha ancora una suite test SDK.

Questi punti sono ancora aperti: il superamento dei test RT-001/RT-002 riguarda il backend Worker e non li chiude automaticamente.

## 7. Logout e gestione account

- `POST /v1/logout` è logout della sola sessione identificata dal cookie corrente.
- `POST /v1/logout/all` è una proposta di logout globale, non una route implementata.
- Le sessioni multiple dello stesso utente restano indipendenti; revocare una sessione non deve revocare le altre.
- AuthGear `/logout` termina la sessione SSO del provider ma non modifica direttamente `auth_sessions`.
- Un'eventuale area Ninja Connect Settings gestirà identità e sessioni Ninja; la pagina AuthGear Settings riguarda invece profilo e sicurezza del provider.

## 8. Principi da non violare

- Identità condivisa e autorizzazione applicativa restano separate.
- Nessun ruolo o permesso prodotto viene centralizzato in Ninja Connect.
- Il client non legge il cookie HttpOnly né conserva session secret grezzi.
- Un JWT decodificato senza verifica non è una credenziale attendibile.
- Il refresh non può annullare una revoca.
- I test devono documentare chiaramente cosa è reale e cosa è simulato.
- Nessun merge, deploy o trasferimento del Worker senza approvazione esplicita.

## 9. Definition of Done — Core 0.1

- [ ] init() valida la configurazione e usa endpoint espliciti per ambiente.
- [ ] login() completa OAuth Authorization Code + PKCE.
- [ ] Il callback state è confrontato con la transazione originaria.
- [ ] Il code exchange rispetta il contratto effettivo del Worker.
- [ ] Il risultato è un NinjaUser normalizzato.
- [ ] getSession() ripristina la sessione senza avviare login interattivo.
- [ ] Il refresh è gestito server-side e rispetta revoca e absolute expiry.
- [ ] logout() revoca la sessione centrale e gestisce il risultato della revoca upstream.
- [ ] SDK e Worker hanno test automatici per i casi critici.
- [ ] Documentazione, tipi pubblici e comportamento effettivo coincidono.

Solo allora sarà possibile congelare e rilasciare NinjaAuth Core 0.1.

## 10. Prossimo ordine di lavoro

1. Aggiornare e completare i contratti API del flow Extension (`/v1/exchange`, `/v1/session`, `/v1/user/me`, `/v1/logout`), compresi payload, response, errori, cookie e CORS.
2. Definire le interfacce platform-neutral e il flow Web (redirect/callback, transaction storage, multi-tab, cookie/CORS).
3. Integrare NinjaAuth nel background service worker dell'estensione, mantenendo il sidepanel come client del background e senza duplicare la logica OAuth.
4. Chiudere login, ripristino sessione e logout Extension end-to-end; aggiungere test SDK e CI.
5. Decidere se e come esporre un eventuale logout globale nell'API pubblica; `/v1/logout/all` resta non implementato.
6. Completare i test backend concorrenti residui prioritari.
7. Implementare Web come milestone separata dopo la definizione dei contratti.
8. Mantenere provider neutrality: non codificare comportamenti AuthGear-specifici nell'API pubblica; OIDC Discovery/interoperabilità resta un requisito architetturale futuro.
9. Verificare la Definition of Done, aggiornare la documentazione e solo dopo preparare il freeze.
