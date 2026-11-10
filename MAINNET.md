# Portare il Prize Pool su mainnet

Oggi il Prize Pool gira su **testnet** con monete di prova (tROBIN). Qui c'è tutto quello che serve per passare a **mainnet** con $ROBIN veri (`robin-3.nearlytrade.near`). Niente parte da solo: ogni passo lo lanci tu a mano, e quelli che spendono soldi o non si possono annullare chiedono una frase di conferma scritta.

## Prima di iniziare: tre decisioni

1. **Quanto costa una partita per il pot**, in $ROBIN. Di ogni partita: 50% va al premio settimanale, 30% al jackpot, 15% viene bruciato, 5% passa alla settimana dopo. Una volta pubblicato, il prezzo non si cambia (bisognerebbe pubblicare un Vault nuovo).
2. **Quanti $ROBIN metti nel primo jackpot.** Chi vince prende il 90% del jackpot. Parti basso.
3. **Bloccare o no il contratto** (passo 6). Finché non lo blocchi, chi ha la chiave del tuo account può cambiarlo: i giocatori devono fidarsi di te. Dopo il blocco non lo può più cambiare nessuno, nemmeno tu, nemmeno per correggere un errore. Su testnet è bloccato.

Il contratto può pagare solo quello che ha dentro: il massimo che può andare perso è quello che tu e i giocatori ci avete messo.

## Cosa serve

- Un account NEAR su mainnet (per esempio `tuonome.near`) con circa **5 NEAR** e i $ROBIN per il primo jackpot.
- La sua chiave privata con accesso completo (inizia con `ed25519:`).
- Su GitHub: **Settings → Secrets and variables → Actions → New repository secret**, due segreti:
  - `MAINNET_ACCOUNT_ID` = il nome dell'account
  - `MAINNET_PRIVATE_KEY` = la chiave privata

  Non mandare mai la chiave in chat o per email. Consiglio un account creato apposta per l'arcade, non il tuo principale.

## I passi

Tutti si lanciano da **GitHub → Actions → vault-mainnet → Run workflow**, scegliendo `mode`.

| # | mode | Cosa fa | Conferma da scrivere | Spende? |
|---|------|---------|----------------------|---------|
| 1 | `check` | Legge il token vero, il tuo account e il contratto. Stampa il piano e i costi. | nessuna | no |
| 2 | `deploy` | Crea l'account del Vault (`arcade.tuonome.near`), pubblica il contratto, imposta le regole, mette il primo jackpot. | `DEPLOY TO MAINNET` | circa 5 NEAR + il jackpot |
| 3 | (sul sito) | Apri il sito con `?net=mainnet` in fondo all'indirizzo: solo tu vedi mainnet, gli altri restano su testnet. Prova con un wallet vero. `?net=default` torna normale. | | |
| 4 | `play` | Fa una partita vera per il pot dal tuo account, per vedere tutto il giro. | `PLAY ON MAINNET` | il prezzo di una partita |
| 5 | `switch` | Passa il sito a mainnet per tutti. `back-to-testnet` lo riporta indietro. | `SWITCH THE SITE` | no |
| 6 | `lock` | Toglie tutte le chiavi dal Vault. **Per sempre.** Facoltativo. | `LOCK FOREVER` | no |

In `check` e `deploy` compili anche `price` (prezzo in $ROBIN) e `jackpot_seed` (primo jackpot). Il risultato di ogni passo finisce in `ci/mainnet.txt`.

## Cosa cambia per chi gioca

- Si gioca per il pot solo con un **wallet** e $ROBIN veri. Gli account istantanei gratuiti e le monete gratis esistono solo su testnet e su mainnet spariscono da soli.
- I tiri gratuiti al jackpot restano, ma solo per chi ha (o ha avuto) $ROBIN nel wallet: altrimenti il token non potrebbe consegnare la vincita.

## Da sistemare al momento del passaggio

- I testi che dicono "about $0.10" (pagina Prize Pool e FAQ): vanno riscritti con il prezzo che hai scelto.
- Le FAQ che parlano di account gratuiti.
- Il servizio degli account ospite (`worker/`) resta solo per testnet.

## Cosa non è stato verificato

- Lo script di pubblicazione è stato provato solo contro una rete finta, mai su mainnet vero: per questo il primo passo è `check`, che non spende niente.
- Il contratto non ha avuto una revisione esterna.
- Se il token $ROBIN non segue lo standard di registrazione di NEAR, `check` si ferma e lo dice.
- La parte legale (un gioco a pagamento con premio a estrazione può essere regolato come lotteria) va chiesta a un avvocato prima di aprire al pubblico.
