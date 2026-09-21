# Responsive e mobile

Projetar adaptação, não “desktop comprimido”.

- Priorizar conteúdo e ações por contexto; reordenar, agrupar ou revelar progressivamente sem esconder o essencial.
- Definir reflow pela falha do conteúdo, não por dispositivos imaginados ou breakpoints arbitrários.
- Considerar touch targets, alcance, scroll, teclado virtual, focus, inputs, menus, orientação, viewport dinâmico e safe areas quando aplicáveis.
- Evitar hover como requisito. Restringir efeitos hover a ponteiros que realmente o suportem.
- Verificar que navegação fixa, sheets e CTAs não colidam com teclado ou áreas seguras.
- Avaliar bottom navigation somente quando arquitetura, frequência e ergonomia justificarem; não adotá-la por moda nativa.
- Preservar largura e ritmo adequados para leitura longa, inclusive em telas estreitas e text scaling.
- Projetar gestos com alternativa acionável e sem sequestrar scroll do navegador.
- Distinguir mobile web atual de futura experiência nativa; não prometer capacidades da plataforma ainda inexistentes.

Inspecionar viewports representativos e condições reais de conteúdo antes de alegar responsividade. Registrar engine, viewport e limitações; emulação não equivale automaticamente a dispositivo físico.
