# NinjaAuth — Core Checkpoint 0.1

> **Aggiornato:** 1 novembre 2026  
> Per lo stato operativo completo e le priorità consultare la [roadmap](ROADMAP.md). Questo checkpoint raccoglie le decisioni architetturali e la Definition of Done del Core.

## 1. Obiettivo

NinjaAuth è l'SDK TypeScript che permette a un'applicazione di utilizzare Ninja Connect per autenticazione, identità condivisa e sessione.

Principio guida:

> **NinjaAuth gestisce la complessità dell'autenticazione. L'applicazione rimane responsabile dei propri dati e delle proprie autorizzazioni.**

NinjaAuth deve poter essere utilizzato dai prodotti dell'ecosistema Ninja e da sviluppatori/applicazioni esterne all'ecosistema.

## 2. Confini architetturali

### Ninja Connect

Ninja Connect è l'Identity Broker centrale e gestisce autenticazione tramite identity provider, identità Ninja Connect condivisa e sessione centrale.

Non gestisce il modello di autorizzazione specifico di ogni prodotto.

### NinjaAuth SDK

Il client SDK orchestra PKCE, OAuth state, launcher e transaction storage specifici della piattaforma, callback, code exchange e API pubblica per login, sessione e logout.

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

Due scenari critici del Worker hanno superato test d'integrazione PostgreSQL:

| Test | Invariante | Esito |
|---|---|---|
| RT-001 | Un refresh concorrente obsoleto che riceve invalid_grant non deve revocare la sessione già aggiornata da un'altra richiesta | PASS |
| RT-002 | Un logout completato mentre refresh è in volo deve prevalere; il refresh non deve riattivare la sessione locale | PASS |

I test sono stati eseguiti sul branch test/auth-refresh-concurrency-rt001 del repository NinjaURL, con PostgreSQL/Neon reale e risposte HTTP dell'identity provider simulate.

- [CI RT-001](https://github.com/HanamiSoftware/NinjaURL-URL-Shortener/actions/runs/41073531083)
- [CI RT-002](https://github.com/HanamiSoftware/NinjaURL-URL-Shortener/actions/runs/41078846722)

Questi risultati dimostrano gli specifici scenari orchestrati, non tutte le possibili interleaving. I test non sono un E2E live con Authgear. Le modifiche non risultano mergeate né deployate.

Restano da analizzare:
- logout tra il completamento del refresh e il ritorno finale di resolveSession();
- refresh upstream che restituisce un nuovo token dopo che il logout ha già tentato la revoca del token precedente;
- ulteriori ordinamenti, timeout e failure path prioritizzati in base al rischio.

## 6. Stato SDK — aggiornamento sessione 1 novembre 2026

Le note seguenti descrivono il lavoro riferito nel working tree locale. Non attestano che le modifiche siano già presenti sul branch remoto né che siano state validate con una suite completa.

- È stato installato `@types/chrome` come dipendenza di sviluppo.
- Il problema di tipizzazione in `TransactionStorage.get()` è stato risolto con un'asserzione sul valore restituito da `chrome.storage.session.get()`. L'asserzione non sostituisce una validazione runtime dei dati persistiti.
- È stata introdotta la classe interna `NinjaAuthInternalError`, con codici tipizzati e conservazione dell'errore originale.
- È stata introdotta `NinjaAuthErrorException()` per normalizzare gli errori senza esporre i dettagli OAuth, Chrome o Worker all'applicazione integratrice.
- Il parser del callback classifica callback malformate, diniego OAuth e errori del provider.
- Il flusso confronta lo state ricevuto con quello originario e rimuove la transazione in un blocco `finally`. Resta da verificare che un errore durante la rimozione non nasconda l'errore principale.
- Il builder dell'URL di autorizzazione è stato semplificato: restano gli scope `openid` e `offline_access`; sono stati rimossi i default `profile`, `email` e il parametro `resource`.

**Non ancora verificato/completato:** formato UUID dello state, allineamento JSON di `/v1/exchange`, validazione robusta della risposta, endpoint configurabili, `getSession()`, `logout()`, test automatici SDK e flusso end-to-end completo.

Il prossimo passo operativo concordato è completare `getSession()`: una risposta anonima valida deve restituire una sessione anonima normalizzata; un errore di rete, del Worker o una risposta malformata deve invece causare un rigetto della Promise. `getSession()` non deve avviare login interattivo.

## 7. Principi da non violare

- Identità condivisa e autorizzazione applicativa restano separate.
- Nessun ruolo o permesso prodotto viene centralizzato in Ninja Connect.
- Il client non legge il cookie HttpOnly né conserva session secret grezzi.
- Un JWT decodificato senza verifica non è una credenziale attendibile.
- Il refresh non può annullare una revoca.
- I test devono documentare chiaramente cosa è reale e cosa è simulato.
- Nessun merge, deploy o trasferimento del Worker senza approvazione esplicita.

## 8. Definition of Done — Core 0.1

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

## 9. Prossimo ordine di lavoro

1. Allineare exchange e state tra SDK e Worker.
2. Chiudere e testare Extension login end-to-end.
3. Completare getSession() e logout() nell'SDK.
4. Aggiungere test SDK e CI.
5. Completare i test backend concorrenti residui prioritari.
6. Stabilizzare API pubblica e error model.
7. Implementare Web come milestone separata.
8. Verificare la Definition of Done, aggiornare la documentazione e solo dopo preparare il freeze.
