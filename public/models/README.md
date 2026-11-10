# Vlastní 3D modely tvorů

Sem patří vlastní 3D modely tvorů ve formátu **glTF Binary (`.glb`)**.

- Soubor pojmenuj podle klíče druhu ze `shared/species.js`, např. `jiskrik.glb`.
- Volitelné nastavení dej vedle jako `jiskrik.json` (otočení, velikost, skryté části, styl,
  jména animací). Nejsnáz ho připravíš v **Dílně tvorů** (`/studio.html`): přetáhni tam model,
  uprav ho a zkopíruj nastavení.
- Po přidání nebo změně stačí obnovit stránku hry (F5).
- Model se použije ve světě, v soubojích, na ikonách v menu i v Atlasu. Když chybí nebo nejde
  načíst, hra použije vygenerovaného tvora.
- Nejlépe: jeden `.glb` s texturami uvnitř, jen tvor (bez podstavce), stojí na zemi a kouká
  dopředu (+Z), 5–30 tisíc trojúhelníků, textury do 2048 px. Kostra s animacemi `Idle`, `Walk`,
  `Attack` a kostí `Head` je bonus (čepice se pak hýbe s hlavou).
- Používej jen modely, které smíš použít (vlastní, CC0, CC-BY s uvedením autora).

Podrobný návod je v hlavním `README.md` v části „Jak přidat nebo změnit tvora“.
