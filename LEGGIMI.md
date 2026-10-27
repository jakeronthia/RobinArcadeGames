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

## Pubblicare su Cloudflare Pages

Il sito è nella repository GitHub **RobinArcadeGames**. Cloudflare lo pubblica gratis e lo aggiorna da solo a ogni modifica.

1. dash.cloudflare.com → **Workers & Pages → Create application**. In fondo alla pagina clicca **Get started** accanto a "Looking to deploy Pages?".
2. **Import an existing Git repository** → collega GitHub → scegli **RobinArcadeGames** → **Begin setup**.
3. Framework preset **None**, Build command **vuoto**, Build output directory **/** → **Save and Deploy**.

Dopo un minuto il sito è online su `nome-progetto.pages.dev`. Per usare un tuo dominio: progetto → **Custom domains → Set up a custom domain**.

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
