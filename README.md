# Planner App

Uno spazio di lavoro semplice, stile Notion, per il team: una barra laterale con
la sezione **Attività** e le **Pagine** condivise.

**Pagine**
- Documenti liberi con icona, titolo e testo, elencati nella barra laterale
- **Allegati**: trascina i file nella pagina (fino a 25 MB ciascuno), con anteprima delle immagini
- Si vede in tempo reale chi sta scrivendo e in quale pagina

**Attività**
- Tre colonne: **Da fare**, **In corso**, **Completate** (trascina le schede per spostarle)
- Ogni attività ha titolo, descrizione, etichetta colorata, persona assegnata e scadenza
- **Checklist** con barra di avanzamento: le voci si spuntano anche direttamente dalla scheda
- Filtro **Tutte / Assegnate a me**
- **Tempo reale**: vedi lettera per lettera cosa scrivono i colleghi, con il loro nome
- Avatar di chi è online in questo momento
- Tema chiaro e scuro automatico, funziona anche da telefono

Nessuna installazione: sono file HTML, CSS e JavaScript.

## Provarla subito (modalità locale)

Apri `index.html` nel browser. I dati restano su quel computer e si
sincronizzano tra le schede aperte: utile per provarla, non per il team.

Con Supabase configurato, aggiungi `?local` all'indirizzo per provare l'app
senza toccare i dati del team.

## Attivare il tempo reale per il team (Supabase, gratis)

Per vedere le modifiche degli altri serve un database condiviso. L'app usa
[Supabase](https://supabase.com), che ha un piano gratuito.

1. Crea un account su supabase.com e un nuovo progetto.
2. Apri **SQL Editor**, incolla il contenuto di [`supabase.sql`](supabase.sql) ed eseguilo.
3. Vai in **Project Settings → API** e copia **Project URL** e la chiave **anon public**.
4. Incollali in [`config.js`](config.js):
   ```js
   window.PLANNER_CONFIG = {
     supabaseUrl: "https://xxxx.supabase.co",
     supabaseAnonKey: "eyJhbGciOi...",
   };
   ```
5. Ricarica la pagina: in alto compare il badge verde **● Live**.

Come funziona: ogni tasto premuto viene inviato subito agli altri tramite
Supabase Realtime (broadcast), e mezzo secondo dopo l'ultima modifica
l'attività viene salvata nel database.

## Metterla online

L'app è pubblicata con **Netlify**, collegato a questo repository: ogni push
sul ramo `main` aggiorna il sito in automatico (configurazione in `netlify.toml`).

In alternativa si può usare **GitHub Pages**: nel repository vai in
**Settings → Pages**, scegli *Deploy from a branch*, ramo `main`, cartella `/ (root)`.
Dopo un minuto l'app è su `https://<organizzazione>.github.io/Planner-App/`.
Condividi quel link con il team.

> GitHub Pages su un repository privato richiede un piano GitHub a pagamento.
> In alternativa puoi pubblicare la cartella gratis su Netlify o Vercel.

## Sicurezza

Con la configurazione di `supabase.sql` chiunque abbia il link dell'app può
leggere e modificare attività e pagine, e aprire gli allegati. Va bene per un
team piccolo con un link non pubblico. Se serve un accesso con login, si può
aggiungere Supabase Auth.

## File

| File | Cosa contiene |
| --- | --- |
| `index.html` | Struttura: barra laterale, bacheca, editor delle pagine |
| `style.css` | Aspetto (chiaro/scuro, telefono) |
| `common.js` | Strumenti condivisi: identità, salvataggio, indicatori "sta scrivendo" |
| `board.js` | Bacheca attività, pannello dettagli, checklist, trascinamento |
| `pages.js` | Pagine: editor, icona, allegati |
| `shell.js` | Navigazione, intestazione, persone online |
| `store.js` | Salvataggio, file e tempo reale (locale o Supabase) |
| `config.js` | Chiavi di Supabase |
| `supabase.sql` | Tabelle, permessi e spazio allegati da creare su Supabase |
