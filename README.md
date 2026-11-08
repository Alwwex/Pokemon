# Monsterra Online

Multiplayerová webová RPG hra o chytání, trénování a soubojích tvorů, inspirovaná hrami jako
Pokémon Brick Bronze. Hraje se v prohlížeči (počítač i mobil) a na jednom serveru může být
najednou spousta hráčů. Hráči se vidí na mapě, píšou si v chatu, vyzývají se k soubojům a
vyměňují si tvory.

> **Proč tu nejsou Pokémoni?** Hra má stejné principy a mechaniky (typy a jejich účinnost,
> staty, úrovně, vývoj, chytání do orbů, stadiony, trenéři…), ale tvorové, útoky, mapy i
> grafika jsou **vlastní**. Pokémony, jejich jména, útoky ani mapy z Brick Bronze nesmíme
> kopírovat – patří Nintendu a právě kvůli tomu bylo Brick Bronze zrušeno. Tahle hra je
> původní, takže ji můžete bez obav hostovat a sdílet.

## Co ve hře je

- **82 původních tvorů** (většina inspirovaná českými pověstmi a přírodou – Hastrman,
  Bludička, Rarášek, Polednice, Krakonoš, Ohnivák, Kapřík, Muchomor…), každý s vlastní
  procedurálně kreslenou grafikou zepředu i zezadu a vlastním hlasem.
- **193 útoků**, **18 typů** s tabulkou účinnosti, **39 schopností**, povahy, IV/EV,
  kritické zásahy, stavy (popálení, otrava, spánek…), počasí, clony, vývoj úrovní i výměnou.
- **Region Velhora**: 46 map – 7 měst, 7 cest, jeskyně, hvozd, bažiny, hrad, horský průsmyk
  a vrchol Koruna. Šest stadionů, šampionka, rival Ondra a padouchové z Týmu Soumrak.
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

Ke kamarádovi na mapě přijdi, otoč se k němu a stiskni akci – nabídne se **souboj** nebo
**výměna**. Seznam hráčů online je pod zeleným tlačítkem nahoře (nebo v chatu napiš `/who`).

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

Legendární tvorové se ukazují jen za určitých podmínek – hledej v jeskyni, na louce, ve hradě,
v průsmyku a na vrcholu Koruny. Někteří tvorové se vyvíjejí také **výměnou** s jiným hráčem.

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
  js/gfx/      procedurální grafika: dlaždice, postavy, tvorové
  js/          svět, souboj, menu, zvuk, ovládání
test/          testy (node --test)
scripts/       kontrola dat a map
```

- `npm test` – testy (náhodné souboje, server, celý průchod začátkem hry, multiplayer).
- `npm run check` – kontrola dat: neznámé útoky, špatné mapy, nedosažitelné oblasti (hledá
  cestu z domova do každého koutu světa).
- `npm run dev` – server se sám restartuje při změně souborů.

Nového tvora přidáš do `shared/species.js` (vzhled se kreslí z pole `art`), novou mapu do
`shared/maps/` a `npm run check` ti řekne, jestli je vše propojené.

## Licence

Kód je pod licencí MIT. Písmo [Pixelify Sans](https://github.com/eifetx/Pixelify-Sans) je pod
licencí SIL Open Font License (viz `public/fonts/OFL-PixelifySans.txt`).
