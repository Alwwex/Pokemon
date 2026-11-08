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
- **Dílna tvorů** (`/studio.html`) – editor vzhledu tvorů s živým 3D a 2D náhledem.
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

### Vlastní 3D model (Blender apod.)

Chceš-li tvora opravdu vymodelovat, ulož model jako **glTF Binary (`.glb`)** do složky
`public/models/` a pojmenuj ho podle klíče tvora, např. `public/models/jiskrik.glb`.
Hra ho při spuštění najde a použije **místo procedurálního modelu** – v souboji, ve světě i za
hráčem. Model sám zmenší na správnou výšku a postaví na zem. Tvor se má v Blenderu dívat do kamery
v pohledu zepředu (Numpad 1, tedy směrem −Y); export glTF s výchozí volbou „+Y Up“ to převede
na osu +Z, kterou hra bere jako „dopředu“. Když soubor smažeš, vrátí se procedurální tvor.
Seznam nalezených modelů vrací adresa `/api/models`.

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
