# NinjaAuth — Core Checkpoint 0.1

> **Aggiornato:** 30 ottobre 2026  
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

## 6. Stato SDK attuale

Il codice SDK sul branch principale non è ancora allineato al contratto Worker:

- il client usa ancora un endpoint localhost hardcoded;
- il code exchange invia form-urlencoded mentre il Worker si aspetta JSON;
- il client non invia state e il formato generato non corrisponde all'UUID richiesto;
- il confronto esplicito del callback state è da completare;
- logout è ancora un TODO;
- il flusso Web non è implementato;
- il package non ha ancora una suite test SDK.

Questi punti sono ancora aperti: il superamento dei test RT-001/RT-002 riguarda il backend Worker e non li chiude automaticamente.

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
