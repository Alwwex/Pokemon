# Monsterra Online

Multiplayerová webová RPG hra o chytání, trénování a soubojích tvorů, inspirovaná hrami jako
Pokémon Brick Bronze. Hraje se v prohlížeči (počítač i mobil) **ve 3D** (nebo v klasickém
pixelovém 2D) a na jednom serveru může být najednou spousta hráčů. Hráči se vidí na mapě,
tvorové jim chodí v patách, píšou si v chatu, vyzývají se k soubojům a vyměňují si tvory.

> **Proč tu nejsou Pokémoni?** Hra má stejné principy a mechaniky (typy a jejich účinnost,
> staty, úrovně, vývoj, chytání do orbů, stadiony, trenéři…), ale tvorové, útoky, mapy i
> grafika jsou **vlastní**. Pokémony, jejich jména, útoky ani mapy z Brick Bronze nesmíme
> kopírovat – patří Nintendu a právě kvůli tomu bylo Brick Bronze zrušeno. Tahle hra je
> původní, takže ji můžete bez obav hostovat a sdílet.

## Co ve hře je

- **3D svět** (three.js, kreslený „toon“ styl s obrysy): stromy a vysoká tráva, která se
  vlní ve větru a rozhrnuje se kolem hráče, voda s vlnami a pěnou u břehu, budovy podle stylu
  (domy, Centra, stadiony, mlýn s otáčejícími se lopatkami, hrady, maják), den a noc podle
  skutečného času (v noci svítí lampy, okna a světlušky), sníh v horách, mlha v bažinách,
  pochodeň v jeskyni. Stromy a střechy mezi kamerou a hráčem se samy zprůhlední.
- **Tvorové chodí za svými trenéry** (první tvor v týmu), i za ostatními hráči.
- **3D souboje**: aréna podle místa (louka, les, jeskyně, sníh, stadion, hrad…), kamera se
  přibližuje k útočníkovi a otřese se při silném zásahu.
- **Čepice pro tvory**: 12 kosmetických čepic (kšiltovka, cylindr, kouzelnický klobouk,
  korunka…) u Kloboučnice v každém Centru tvorů. Čepici vidí i ostatní hráči.
- **Mapa regionu** v menu – města, cesty, získané odznaky, kde jsi ty a kde jsou hráči online.
- **Dílna tvorů** (`/studio.html`) – editor vzhledu tvorů s živým 3D a 2D náhledem; přetažením
  souboru `.glb` si tam vyzkoušíš i vlastní 3D model tvora (i s animacemi).
- Klasická **2D pixelová grafika** zůstává jako volba v Nastavení (pro slabší zařízení).
- **82 původních tvorů** (většina inspirovaná českými pověstmi a přírodou – Hastrman,
  Bludička, Rarášek, Polednice, Krakonoš, Ohnivák, Kapřík, Muchomor…), každý s vlastním
  procedurálně generovaným 3D modelem i 2D obrázkem a vlastním hlasem.
- **193 útoků**, **18 typů** s tabulkou účinnosti, **39 schopností**, povahy, IV/EV,
  kritické zásahy, stavy (popálení, otrava, spánek…), počasí, clony, vývoj úrovní i výměnou.
- **Region Velhora**: 52 map – 8 měst, 8 cest, jeskyně, hvozd, bažiny, hrad, horský průsmyk,
  vrchol Koruna a mořské pobřeží s přístavem Solnice. Šest stadionů, šampionka, rival Ondra a
  padouchové z Týmu Soumrak.
- **5 legendárních tvorů** schovaných ve světě.
- **Multiplayer**: hráči na stejné mapě se vidí v reálném čase, globální chat s bublinami nad
  hlavou, **PvP souboje** a **výměny tvorů** mezi hráči.
- Obchody, Centra tvorů (léčení), počítač s 8 boxy na tvory, batoh, technické disky (TD),
  Atlas tvorů, karta trenéra, editor vzhledu postavy.
- Původní čiptunová hudba a zvuky (generované v prohlížeči), denní/noční osvětlení, sníh v
  horách.
- Ovládání klávesnicí i dotykem (virtuální kříž a tlačítka A/B na mobilu).
- Server je autoritativní – souboje, pohyb, předměty i výměny počítá server, takže se nedá
  podvádět úpravou prohlížeče.

## Spuštění

Potřebuješ [Node.js](https://nodejs.org) 18 nebo novější.

```bash
npm install
```

```bash
npm start
```

Pak otevři v prohlížeči **http://localhost:3000**, vytvoř si trenéra a hraj.

### Hraní s kamarády na stejné Wi-Fi

Spusť server u sebe (`npm start`) a zjisti IP adresu svého počítače (Windows: `ipconfig`,
macOS/Linux: `ip addr` nebo `ifconfig`). Kamarádi pak otevřou například
`http://192.168.1.23:3000`. Každý si vytvoří vlastního trenéra.

### Hraní přes internet

Server je obyčejná Node.js aplikace, takže ji jde nasadit skoro kamkoli:

- **Render / Railway / Fly.io** – nový „Web Service“ z tohoto repozitáře, příkaz
  `npm install` pro build a `npm start` pro spuštění. Port se bere z proměnné `PORT`.
  Uložené hry jsou ve složce `data/`; aby nezmizely při restartu, připoj trvalý disk a nastav
  proměnnou `DATA_DIR` na jeho cestu.
- **Docker**:

  ```bash
  docker build -t monsterra .
  ```

  ```bash
  docker run -p 3000:3000 -v monsterra-data:/data monsterra
  ```

- **Vlastní VPS** – `npm start` pod správcem procesů (pm2, systemd) a před to reverzní proxy
  (nginx, Caddy) s HTTPS. WebSockety běží na cestě `/ws`.

Proměnné prostředí: `PORT` (výchozí 3000), `HOST` (výchozí 0.0.0.0), `DATA_DIR` (výchozí
`./data`), `NODE_ENV=production` (zapne cache souborů).

## Ovládání

| Akce | Klávesnice | Mobil |
| --- | --- | --- |
| Pohyb | šipky / WASD | kříž vlevo dole |
| Akce, mluvit, potvrdit | Z / Enter / mezerník | A |
| Zpět, menu | X / Esc | B (zpět), ☰ (menu) |
| Běh | držet Shift | držet B |
| Chat | T | 💬 |
| Přiblížit / oddálit (3D) | kolečko myši | – |

Ke kamarádovi na mapě přijdi, otoč se k němu a stiskni akci – nabídne se **souboj** nebo
**výměna**. Seznam hráčů online je pod zeleným tlačítkem nahoře (nebo v chatu napiš `/who`).

Grafiku přepneš v **Menu → Nastavení → Grafika**: `3D` (se stíny), `3D (rychlé, bez stínů)`
pro slabší mobily, nebo `2D pixel`. Když prohlížeč 3D neumí (chybí WebGL), hra sama přepne na
2D.

## Průvodce regionem Velhora

1. **Lísková** – tvůj domov. U profesorky Javorové si vybereš prvního tvora: Jiskříka (oheň),
   Čvachtíka (voda) nebo Pupínka (rostlina).
2. **Cesta 1 → Mlýnov** – stadion vede **Bořek** (Kámen).
3. **Cesta 2 → Rybníkov** – stadion vede **Hana** (Voda).
4. **Cesta 3 → Šedá jeskyně → Jiskrov** – stadion vede **Viktor** (Elektřina).
5. **Temný hvozd → Hájov** – stadion vede **Libuše** (Rostlina).
6. **Blata → Strašín** – stadion vede **Dorota** (Přízrak). V hradě řádí Tým Soumrak.
7. **Cesta 6 → Mrazov** – stadion vede **Radek** (Led).
8. **Průsmyk → Koruna** – Síň šampionů a šampionka **Ludmila**.

Odbočka: z **Rybníkova na jih** (s Odznakem Kapka) vede **Cesta 8 – Pobřeží** podél moře s
molem a trenéry do přístavu **Solnice**. Je tam maják (jeho strážce dává disk), Kloboučnictví
U Veselé Mašle a na molu dva silní trenéři.

Legendární tvorové se ukazují jen za určitých podmínek – hledej v jeskyni, na louce, ve hradě,
v průsmyku a na vrcholu Koruny. Někteří tvorové se vyvíjejí také **výměnou** s jiným hráčem.

## Jak přidat nebo změnit tvora

Tvorové **nemají žádné ručně modelované 3D soubory (mesh)**. Každý tvor je v souboru
`shared/species.js` popsaný několika slovy v poli `art` a z toho popisu hra sama postaví 3D
model (`public/js/gfx3d/mon3d.js`) i 2D obrázek (`public/js/gfx/monart.js`). Změníš text –
změní se tvor ve 3D i 2D, v soubojích, v Atlasu i za zády hráčů.

### Nejjednodušší cesta: Dílna tvorů

1. Spusť server (`npm start`) a otevři **http://localhost:3000/studio.html** (odkaz je i na
   přihlašovací obrazovce).
2. Vyber tvora, klikej na tělo, uši, rohy, ocas, křídla, barvy, velikost a doplňky. Uvidíš
   ho hned ve 3D (myší ho otáčíš a přibližuješ) i ve 2D zepředu a zezadu. Tlačítko
   🎲 **Náhodný** vymyslí úplně nového tvora.
3. Klikni na **Kopírovat kód** a v `shared/species.js` u daného tvora nahraď řádek `art: {…}`.
4. Restartuj server. Hotovo – změna platí pro všechny hráče.

### Co znamenají položky `art`

```js
art: { b: 'quad', c: ['#f07a2a', '#ffe8c0', '#ffcf3a'], s: 0.62, ear: 'pointy', tail: 'flame', eye: 'cute', mouth: 'smile', mark: 'cheeks' },
```

| Klíč | Význam | Hodnoty |
| --- | --- | --- |
| `b` | tělo | `quad` čtyřnožec, `biped` dvounožec, `bird` pták, `larva` housenka, `blob` kulička, `bug` brouk, `jelly` medúza, `golem` golem, `fish` ryba, `ghost` duch, `shroom` houba, `wisp` plamínek, `crab` krab |
| `c` | barvy | `[hlavní, světlá (bříško), doplňková]` jako `#rrggbb` |
| `s` | velikost | 0.4 (mrně) až 1.0 (obr) |
| `ear` | uši | `pointy`, `round`, `leaf`, `long`, `fin`, `tuft`, `bat` |
| `horn` | rohy / ozdoba hlavy | `curved`, `nub`, `antlers`, `crest`, `antennae`, `crown`, `bud`, `drill` |
| `tail` | ocas | `flame`, `fluffy`, `thin`, `leaf`, `fan`, `paddle`, `fin`, `pom`, `ring`, `club`, `devil` |
| `wing` | křídla | `feather`, `bat`, `insect`, `butterfly`, `tiny` |
| `back` | záda | `flames`, `spikes`, `quills`, `mane`, `leaves`, `moss`, `crystals`, `fins`, `plates` |
| `eye`, `eyeC` | oči a jejich barva | `cute`, `big`, `fierce`, `bead`, `sleepy`, `glow` |
| `mouth` | pusa | `smile`, `grin`, `fang`, `teeth`, `open`, `frown`, `beak`, `none` |
| `mark` | znak na těle | `cheeks`, `spots`, `stripes`, `bolt`, `star`, `moon`, `third`, `cracks`, `scales`, `belly` |
| `x` | doplňky (seznam) | např. `['scarf', 'whiskers', 'glow']` – všechny jsou v Dílně |

### Úplně nový tvor

V Dílně klikni na **Kopírovat jako nového tvora** – dostaneš celý záznam (číslo v Atlasu,
jméno, typy, staty, útoky, popis). Vlož ho do objektu `SPECIES` v `shared/species.js`, uprav
jméno, typy (`ty`), staty (`bs`: HP, útok, obrana, zvl. útok, zvl. obrana, rychlost), útoky
podle úrovní (`ls`) a případně vývoj (`evo`). Aby se objevoval v trávě, přidej ho do seznamu
`enc` některé mapy v `shared/maps/`. Nakonec spusť `npm run check` – řekne ti, jestli je vše v
pořádku (např. neznámý útok).

### Vlastní 3D model (`.glb`) – přetáhni a hotovo

Místo vygenerovaného tvora můžeš použít libovolný 3D model ve formátu **glTF Binary (`.glb`)** –
vlastní z Blenderu, nebo stažený model s licencí, která to dovoluje.

1. Otevři **Dílnu tvorů** (`/studio.html`), vyber tvora, kterého má model nahradit, a soubor
   `.glb` **přetáhni do okna** (nebo klikni na „vyber“). Soubor se nikam neposílá, jen se ukáže.
2. Uvidíš ho přesně tak, jak bude ve hře – ve 3D i jako obrázek do menu. Můžeš:
   - **otočit** ho čelem k červené šipce (tak se tvor ve hře dívá dopředu),
   - změnit **velikost** a **výšku nad zemí**,
   - **odškrtnout části**, které k tvorovi nepatří (podstavec, pozadí, krabice ze scény),
   - zvolit **styl**: automaticky (osvětlené materiály převede na kreslené, neosvětlené
     nechá), kreslený, nebo původní materiály; a zapnout/vypnout černé obrysy,
   - pokud má model **animace**, vybrat, která je klid, chůze a útok (jinak se poznají podle
     jména – Idle, Walk, Attack…) a hned je vyzkoušet.
3. Soubor ulož jako `public/models/<klíč>.glb` (např. `public/models/jiskrik.glb`) a pokud
   jsi něco upravoval, zkopírované nastavení ulož vedle jako `public/models/<klíč>.json`.
4. **Obnov stránku hry (F5)** – server restartovat nemusíš.

Model se pak ukáže **ve světě, za hráčem, v soubojích (i s animací útoku), na ikonách v menu,
v Atlasu i ve 2D režimu**. Hra ho sama zmenší na výšku tvora a postaví na zem, umí modely
s kostrou a animacemi i komprimované modely (Draco, Meshopt). Čepice se nasadí navrch modelu.
Když soubor smažeš, vrátí se vygenerovaný tvor; když se model nepodaří načíst, hra ho přeskočí.

Nastavení (`<klíč>.json`) může obsahovat jen tyto položky:

```json
{
  "rotateY": 90,
  "scale": 1.2,
  "lift": 0.05,
  "toon": "auto",
  "outline": true,
  "hide": ["Podstavec"],
  "idle": "Idle",
  "walk": "Walk",
  "attack": "Attack"
}
```

`rotateY` je otočení ve stupních, `scale` násobek výšky tvora, `lift` posun nahoru, `toon`
`"auto"`/`true`/`false`, `hide` jména částí ke skrytí, `idle`/`walk`/`attack` jména animací.
Pro čepice navíc `head` (jméno kosti nebo části hlavy), `hatScale` (velikost čepice) a
`hatOffset` (posun `[x, y, z]`). Hlavu hra najde sama – podle kosti pojmenované jako hlava
(`Head`, `mixamorig:Head`, `Bip001 Head`, `hlava`…; pak se čepice hýbe s hlavou), jinak podle
tvaru modelu (vršek uprostřed vpředu, ne zvednuté ruce ani ocas). Posuvníky v Dílně ji doladíš.
Seznam nalezených modelů s nastavením vrací adresa `/api/models`.

#### Jaký model se hodí nejvíc

- **Formát `.glb`** (glTF 2.0 Binary) – jeden soubor i s texturami. Jiné formáty (`.fbx`,
  `.obj`, `.blend`, `.gltf` s více soubory) převedeš v Blenderu: *File → Import* a pak
  *File → Export → glTF 2.0*, *Format: glTF Binary (.glb)*. Na Sketchfabu stáhni variantu „GLB“.
- **Jen tvor**, bez podstavce, pozadí, světel a kamer (jinak je odškrtni v Dílně).
- **Stojí na zemi a kouká dopředu** (+Z, v Blenderu do kamery v pohledu zepředu), osa Y nahoru.
- **5 000–30 000 trojúhelníků** a textury nejvýš 1024–2048 px – ve světě je tvorů hodně najednou.
- **Kostra a animace** jsou bonus: pojmenuj je `Idle`, `Walk` a `Attack` a kost hlavy `Head`.
  Model bez animace jen jemně dýchá; model v T-póze (rozpažený) v ní bez animace zůstane.

> **Pozor na licence.** Model musíš smět použít: vlastní, nebo s licencí CC0/CC-BY (např.
> Quaternius, Kenney, Poly Pizza; u CC-BY uveď autora). Modely Pokémonů a jiných cizích postav
> do hry nedávej – pokud by hra byla veřejně online, je to přesně důvod, proč Nintendo zrušilo
> Brick Bronze.

## Pro vývojáře

```
server/        Node.js server (HTTP + WebSocket)
  index.js     spouštění, statické soubory, WebSocket
  game.js      svět, pohyb, NPC, obchody, počítač, výměny, chat, PvP
  battle.js    bojový engine (divocí tvorové, trenéři, hráči)
  monsters.js  instance tvorů, zkušenosti, učení útoků, vývoj
  store.js     účty (scrypt) a ukládání hráčů do JSON
shared/        data sdílená serverem i klientem
  species.js   tvorové (staty, útoky, vývoj, popis vzhledu)
  moves.js     útoky a technické disky
  types.js     typy a tabulka účinnosti
  items.js, abilities.js, formulas.js, looks.js, tiles.js
  maps/        mapy regionu (ASCII mřížky + budovy, NPC, trenéři, předměty)
public/        klient v prohlížeči (bez sestavování, čisté ES moduly)
  js/gfx3d/    3D: tvorové (mon3d), postavy (char3d), mapy (map3d), materiály a slučování
  js/world3d.js, js/battle3d.js   3D renderer světa a 3D aréna souboje
  js/gfx/      2D procedurální grafika: dlaždice, postavy, tvorové
  js/          svět, souboj, menu, mapa regionu, Dílna tvorů, zvuk, ovládání
  models/      vlastní 3D modely tvorů (.glb), volitelné
  studio.html  Dílna tvorů
test/          testy (node --test)
scripts/       kontrola dat a map
```

- `npm test` – testy (náhodné souboje, server, celý průchod začátkem hry, multiplayer).
- `npm run check` – kontrola dat: neznámé útoky, špatné mapy, nedosažitelné oblasti (hledá
  cestu z domova do každého koutu světa).
- `npm run dev` – server se sám restartuje při změně souborů.

Nového tvora přidáš do `shared/species.js` (viz [Jak přidat nebo změnit tvora](#jak-přidat-nebo-změnit-tvora)),
novou mapu do `shared/maps/` (ASCII mřížka – 3D podoba se z ní postaví sama) a `npm run check`
ti řekne, jestli je vše propojené. Knihovna three.js se servíruje lokálně z `node_modules`
(cesta `/vendor/`), takže hra nepotřebuje žádné CDN.

## Licence

Kód je pod licencí MIT. Knihovna [three.js](https://threejs.org) je pod licencí MIT. Písmo [Pixelify Sans](https://github.com/eifetx/Pixelify-Sans) je pod
licencí SIL Open Font License (viz `public/fonts/OFL-PixelifySans.txt`).
