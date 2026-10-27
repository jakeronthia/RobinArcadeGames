# ROBIN Arcade

Sito statico: non serve nessun server particolare. Funziona su Cloudflare Pages così com'è.

## Struttura

```
index.html        homepage (moneta, sfida del giorno, giochi, eroi, Hall of Fame, token)
game.html         pagina del gioco (una sola per tutti: game.html?g=patrol) + card punteggio per X
profile.html      profilo giocatore (nickname, eroe, record, badge holder)
kit.html          meme kit: sticker da scaricare
faq.html          domande frequenti
manifest.webmanifest + sw.js   rendono il sito installabile come app
data.js           TUTTI i contenuti: giochi, eroi, token, link social
styles.css        grafica
site.js           piccole funzioni comuni
games/            i giochi (un file HTML per gioco)
assets/heroes/    render 3D degli eroi
assets/shots/     immagine di anteprima di ogni gioco
assets/clips/     clip di 5 secondi che parte passando il mouse
assets/robin.jpg  immagine del token
assets/stickers/  sticker PNG + zip con tutti
```

## Aggiungere un nuovo gioco

1. Copia il file del gioco in `games/` (esempio: `games/nuovo.html`).
2. Metti un'immagine in `assets/shots/nuovo.jpg` e, se vuoi, una clip in `assets/clips/nuovo.mp4`.
3. Apri `data.js` e aggiungi un blocco nella lista `GAMES`, copiando uno di quelli esistenti:

```js
{
  id: 'nuovo',
  title: 'Nome del gioco',
  file: 'games/nuovo.html',
  orient: 'landscape',          // oppure 'portrait'
  blurb: 'Frase breve per la scheda.',
  about: 'Descrizione più lunga per la pagina del gioco.',
  shot: 'assets/shots/nuovo.jpg',
  clip: 'assets/clips/nuovo.mp4',
  pos: 'center',
  controls: [
    ['Salta', 'Spazio', 'tasto Jump']
  ]
},
```

La scheda in homepage, la clip al passaggio del mouse, la pagina del gioco e "More games" si creano da soli.

## Cambiare testi del token o link

Tutto è in cima a `data.js`: contratto, pair di DEX Screener, link Buy/Swap, descrizione, X e Telegram.

## Pubblicare su Cloudflare Pages (con la classifica)

La classifica ha bisogno di una piccola parte "server" (cartella `functions/`) e di un database.
Cloudflare la attiva solo se il sito arriva da **GitHub** (il caricamento dello zip trascinandolo NON avvia la parte server).

### 1. Metti i file su GitHub
1. Crea un account su github.com (gratis) e poi un nuovo repository, per esempio `robin-arcade` (può essere privato).
2. Nel repository: **Add file → Upload files**, trascina TUTTO il contenuto di questa cartella (non la cartella stessa) e conferma con **Commit changes**.

### 2. Collega GitHub a Cloudflare Pages
1. dash.cloudflare.com → **Workers & Pages → Create → Pages → Connect to Git** → scegli il repository.
2. Impostazioni di build: Framework preset **None**, Build command **vuoto**, Build output directory **/**.
3. **Save and Deploy**.

### 3. Crea il database
1. dash.cloudflare.com → **Storage & Databases → D1 → Create database**, nome `robin-arcade`.
2. Apri il database → **Console**, incolla tutto il contenuto di `schema.sql` e premi **Execute**.

### 4. Collega database e chiave admin al sito
1. Workers & Pages → il tuo progetto → **Settings → Bindings → Add → D1 database**: Variable name **DB**, database `robin-arcade`.
2. **Settings → Variables and Secrets → Add**: tipo **Secret**, nome **ADMIN_KEY**, valore una password lunga che sai solo tu.
3. **Deployments → ⋯ sull'ultimo → Retry deployment** (serve per applicare le impostazioni).

Da qui in poi, ogni modifica caricata su GitHub aggiorna il sito da sola in un minuto.

## Classifica e premi: come funziona

- Ogni gioco ha la sua classifica settimanale (reset ogni lunedì 00:00 UTC). Patrol e Rush: miglior partita (in Rush valgono solo le partite con gli upgrade spenti). Brawl: trofei vinti. Night Shift: Moon Badges guadagnate. ROBIN Ventures: quotazioni in borsa (IPO).
- Per entrare in classifica il giocatore collega il wallet NEAR dal **Profilo** (firma un messaggio con MyNearWallet, gratis, nessun movimento di fondi). Il premio va a quell'account.
- I premi mostrati sul sito si scrivono in `data.js` (`PRIZES`).
- Difese contro i furbi: ogni partita ha un "biglietto" del server, punteggi impossibili o troppo veloci vengono rifiutati, un biglietto vale una sola volta, limite di partite al minuto. Nessuna difesa è perfetta: per questo il podio resta **In review** finché non lo controlli tu.

### Ogni lunedì (pagina `admin.html`, non è linkata da nessuna parte)
1. Apri `tuosito/admin.html`, inserisci la ADMIN_KEY, **Load last week**.
2. Per ogni gioco guarda i primi 3: numero di partite, orario, punteggio sensato? **Verify** se va bene, **Remove score** o **Ban** se è un imbroglio.
3. Invia i premi agli account NEAR e premi **Mark paid** (puoi scrivere l'id della transazione). Sul sito comparirà "Prize sent".

## Sfida del giorno

In `data.js`, lista `CHALLENGES`. Ogni giorno (mezzanotte UTC) il sito passa alla sfida successiva. Aggiungi o cambia righe liberamente.

## Hall of Fame

In `data.js`, lista `HALL`. Ogni settimana aggiungi una riga in cima, per esempio:

```js
window.HALL = [
  { week: 'Week 2', name: 'RooftopKing', game: 'Ravenport Rush', score: '12,400', hero: 'Spud' },
  { week: 'Week 1', name: 'NearDegen', game: 'Ravenport Patrol', score: '8,950', hero: 'Leonidas' }
];
```

Il primo in lista ha la cornice d'oro. Finché la lista è vuota compaiono tre posti "Your name here".

## Badge holder

Nel profilo il giocatore può scrivere il suo account NEAR: il sito legge in sola lettura il saldo $ROBIN dal contratto indicato in `data.js` (`token.contract`). Se il contratto è sbagliato il controllo non trova nulla: verificalo.

## App installabile

Funziona da solo una volta online in https (Cloudflare lo è). Se cambi molti file e vuoi forzare l'aggiornamento per chi ha installato l'app, cambia il numero in `sw.js` (`robin-arcade-v1` → `v2`).
