# surf-bitmap-generator

Kleines Web-Interface für den [surf-bitmap-provider](https://github.com/slne-development/surf-bitmap-provider):
Bitmaps erzeugen, pixelgenau wie in Minecraft ansehen, als **ingame parsebaren MiniMessage-String** kopieren
und mehrere Bitmaps (z. B. Ränge) zusammen mit Spielernamen in einer Chat-Vorschau testen.

## Starten

Statische Seite ohne Build-Schritt, Fonts und Texturen sind eingebettet:

```sh
python -m http.server 8080
```

→ <http://localhost:8080>. Die `index.html` lässt sich auch direkt per Doppelklick öffnen.

## Funktionen

- **Bitmaps** – Text, Vorder-/Hintergrund, Glyph-Schatten (`ShadowColor`) und `affixAmount`, 1:1 portiert aus
  `BitmapProvider.translateToComponent`
- **MiniMessage kopieren** – der String, den auch der Klick auf die `/translate`-Ausgabe liefert; pro Bitmap, alle als
  YAML, oder als `\u`-escaptes String-Literal / JSON-Komponente
- **Chat-Vorschau** – eine Zeile pro Bitmap nach einem MiniMessage-Format (`<rank>`, `<player>`, `<message>`) plus
  freie Zeilen mit `<rank:key>` und `<bitmap:'Text':#fg:#bg[:#schattenRRGGBBAA][:affix]>`; jede Zeile kann mit
  bereits eingesetzten Platzhaltern als ingame parsebarer MiniMessage-String kopiert werden
- **Prüfung** – nicht unterstützte Zeichen und Zeichen, deren Glyph-Breite im Spiel von der Provider-Breite abweicht

Gerendert wird mit den echten Minecraft-Regeln (Bitmap-Advance `(int)(0.5 + Breite * Skalierung) + 1`,
Space-Provider aus `shift.json`, Textschatten, Chat-Hintergrund), MiniMessage-Unterstützung inkl. Farben, Dekorationen,
`gradient`, `rainbow`, `transition`, `shadow`, `reset`, `br`.

## Texturen aktualisieren

Texturen aus `assets/surf/textures/bitmaps` und `assets/surf/font/shift.json` des Resourcepacks nach `textures/`
kopieren und `python textures/build-textures.py` ausführen.
