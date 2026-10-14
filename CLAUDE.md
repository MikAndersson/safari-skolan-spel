Safari skolan – spel

Pedagogiskt 3D-spel (F-klass–åk 1) för Android-surfplattor i webbläsaren.

TypeScript (strikt) + Three.js (WebGLRenderer) + Vite. Inget UI-ramverk.



Kommandon

npm run dev – utvecklingsserver, nås från surfplattan

npm run check – typkontroll + tester (kör före varje commit)

npm run build – produktionsbygge till dist/

Lager (får inte blandas)

src/logic: spelregler och tillstånd. Importerar ALDRIG three eller DOM.

src/render: allt som rör Three.js.

src/platform: webbläsar-API:er (tryck, helskärm, lagring).

3D-tillgångar

Djuren görs i Blender av Claude via Blender-anslutningen. Ändra aldrig GLB-filer i public/models för hand.

zebra.glb: meter, +Y upp, tittar mot +Z, origo på marken mellan hovarna.

Animationsklipp: "Gallop" och "Idle", på ställe (ingen rörelse framåt i klippet).

Material: "Zebra\_Body", "Hair\_Mane", "Hair\_Tail". Koden byter Hair\_\* mot hårshadern.

Ben som koden får använda: Root, Hips, Chest, Neck, Head, Tail\_1..Tail\_3.

Budget: högst 1000 trianglar per djur inklusive man och svans.

Prestanda (enkel Android-surfplatta)

Mål 30+ bilder/s. Skapa inga nya Vector3/Matrix4 per bildruta.

Ingen genomskinlighet med sortering för hår; använd alphaTest.

Pixelratio högst 1.5.

Arbetssätt

Små steg, kör npm run check, committa med svensk beskrivning.

Fråga innan nya beroenden läggs till.

