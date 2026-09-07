# 🎸 Afinador

Afinador cromático que corre no browser (Safari do iPhone incluído), sem instalar nada.
Detecta a corda automaticamente, mostra o desvio em cents e suporta afinações personalizadas.

**Endereço:** `https://hfreitas123.github.io/afinador/` (GitHub Pages, ramo `main`, pasta raiz)

## Como usar no iPhone

1. Abre o endereço acima no Safari.
2. Toca em **Iniciar afinador** e permite o microfone.
3. Para ficar com ícone e ecrã inteiro como uma app: **Partilhar → Adicionar ao Ecrã Principal**.
   Depois da primeira visita funciona offline.
4. Se o Safari perguntar pelo microfone de cada vez, toca em **aA** na barra de endereço →
   **Definições do site → Microfone → Permitir**.

## Funcionalidades

- **Detecção automática da corda** (modo Auto) ou selecção manual tocando na corda.
- **Agulha com faixa verde**, desvio em cents, frequência medida e frequência-alvo.
- **Histórico** dos últimos segundos para ver se a nota estabiliza.
- **Instrumentos:** guitarra (6, 7, 8 e 12 cordas, clássica), baixo (4, 5 e 6), ukulele, cavaquinho,
  guitarra portuguesa (Lisboa e Coimbra), bandolim, banjo (5 cordas e tenor), violino, viola de arco,
  violoncelo, contrabaixo, charango e balalaika.
- **Afinações populares** por instrumento (Standard, Drop D, Drop C, meio tom abaixo, DADGAD, Open G/D/E/C/A, etc.).
- **Afinações de músicas**, num grupo próprio na lista. Inclui a de *Iris* dos Goo Goo Dolls
  (B1 D2 D3 D3 D4 D4, o famoso «BDDDDD» de John Rzeznik), com aviso sobre a tensão das cordas.
- **Afinações personalizadas:** escolhes o número de cordas (1 a 12) e a nota e oitava de cada uma.
  Ficam guardadas no dispositivo e podem ser editadas ou apagadas.
- **Nota de referência:** botão ▶ toca o som da corda para afinares de ouvido.
- **Definições:** referência do Lá (400 a 480 Hz), transposição em semitons, sensibilidade do microfone,
  tolerância de "afinado", notação C D E ou Dó Ré Mi, ♯ ou ♭, tema escuro/claro, manter ecrã ligado
  e som de confirmação.

## Notas técnicas

- Detecção de frequência com o algoritmo **YIN** (`pitch.js`), com interpolação parabólica e mediana
  das últimas leituras para estabilizar a agulha. Testado de 30 Hz (Si grave do baixo de 5 cordas) a 1 kHz.
- Sem dependências externas: HTML, CSS e JavaScript puros. `sw.js` guarda tudo em cache para uso offline.
- O microfone só funciona em **HTTPS** (o GitHub Pages já o garante).
- Para publicar: **Settings → Pages → Source: Deploy from a branch → main / (root)**.
- **Modo demo** sem microfone: acrescenta `?demo=110` ao endereço para simular um sinal de 110 Hz.
- No iPhone, enquanto o microfone está activo, o som da nota de referência pode sair mais baixo
  (limitação do iOS). Sobe o volume ou pára o afinador antes de ouvir a nota.

## Ficheiros

| Ficheiro | Função |
|---|---|
| `index.html`, `style.css` | Interface |
| `app.js` | Lógica: áudio, medidor, folhas, definições, afinações personalizadas |
| `pitch.js` | Detector YIN e suavizador |
| `tunings.js` | Instrumentos, afinações e utilitários de notas |
| `sw.js`, `manifest.webmanifest`, ícones | Instalação como app e funcionamento offline |
