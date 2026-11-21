# Planner App

Una bacheca semplice, stile Notion, per gestire le attività del team.

- Tre colonne: **Da fare**, **In corso**, **Fatto** (trascina le schede per spostarle)
- Ogni attività ha titolo, persona assegnata, scadenza e note libere
- **Tempo reale**: vedi lettera per lettera cosa scrivono i colleghi, con il loro nome
- Avatar di chi è online in questo momento
- Tema chiaro e scuro automatico, funziona anche da telefono

Nessuna installazione: sono file HTML, CSS e JavaScript.

## Provarla subito (modalità locale)

Apri `index.html` nel browser. I dati restano su quel computer e si
sincronizzano tra le schede aperte: utile per provarla, non per il team.

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

Il modo più semplice è **GitHub Pages**: nel repository vai in
**Settings → Pages**, scegli *Deploy from a branch*, ramo `main`, cartella `/ (root)`.
Dopo un minuto l'app è su `https://<organizzazione>.github.io/Planner-App/`.
Condividi quel link con il team.

> GitHub Pages su un repository privato richiede un piano GitHub a pagamento.
> In alternativa puoi pubblicare la cartella gratis su Netlify o Vercel.

## Sicurezza

Con la configurazione di `supabase.sql` chiunque abbia il link dell'app può
leggere e modificare le attività. Va bene per un team piccolo con un link non
pubblico. Se serve un accesso con login, si può aggiungere Supabase Auth.

## File

| File | Cosa contiene |
| --- | --- |
| `index.html` | Struttura della pagina |
| `style.css` | Aspetto (chiaro/scuro) |
| `app.js` | Bacheca, pannello attività, trascinamento, indicatori "sta scrivendo" |
| `store.js` | Salvataggio e tempo reale (locale o Supabase) |
| `config.js` | Chiavi di Supabase |
| `supabase.sql` | Tabella e permessi da creare su Supabase |
