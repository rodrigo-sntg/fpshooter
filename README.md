# 🚀 Starstrike: Operação Zero

**Starstrike: Operação Zero** é um jogo FPS (First Person Shooter) 3D desenvolvido com JavaScript, utilizando as bibliotecas Three.js para gráficos 3D e Howler.js para áudio. O jogo coloca você no papel de um soldado de elite em uma missão para combater as forças da Corporação Nebulosa.

## 📖 História

Em um futuro distante, a galáxia se encontra à beira do colapso. Durante séculos, diversas civilizações se desenvolveram e floresceram entre as estrelas, mas a paz que unia esses povos foi abalada pelo surgimento de uma ameaça implacável: a Corporação Nebulosa. Essa poderosa organização, movida pela ganância e pela sede de controle, começou a conquistar sistemas estelares, explorando recursos naturais e subjugando planetas inteiros, mergulhando a galáxia em um clima de opressão e escuridão.

Você assume o papel de um soldado de elite, armado com o mais recente armamento e tecnologia, em uma missão para combater as forças da Corporação Nebulosa e restaurar a liberdade à galáxia.

## 🎮 Como Jogar

### Controles
- **Movimento:** W, A, S, D ou setas direcionais
- **Mira:** Movimento do mouse
- **Disparar:** Botão esquerdo do mouse
- **Recarregar:** R
- **Correr:** Shift
- **Pausar:** Esc

### Objetivo
Sobreviva ao maior número possível de ondas de inimigos, destruindo as forças da Corporação Nebulosa para acumular pontos.

## 🛠️ Instalação

### Requisitos
- Navegador moderno com suporte a WebGL (Chrome, Firefox, Edge, Safari)
- Node.js (opcional, para desenvolvimento)

### Instalação para Jogar

Simplesmente abra o arquivo `index.html` em seu navegador ou acesse a versão online (quando disponível).

### Instalação para Desenvolvimento

1. Clone o repositório:
   ```bash
   git clone https://github.com/seu-usuario/starstrike-operacao-zero.git
   cd starstrike-operacao-zero
   ```

2. Instale as dependências (opcional, apenas para desenvolvimento):
   ```bash
   npm install
   ```

3. Inicie o servidor de desenvolvimento:
   ```bash
   npm run dev
   ```

4. Abra o navegador e acesse `http://localhost:3000`

## 🧩 Estrutura do Projeto

```
starstrike-operacao-zero/
├── index.html                # Ponto de entrada do jogo
├── src/                      # Código-fonte JavaScript
│   ├── main.js               # Arquivo principal
│   ├── config.js             # Configurações e constantes
│   ├── game-state.js         # Estado global do jogo
│   ├── scene-manager.js      # Gerenciamento da cena 3D
│   ├── input-manager.js      # Gerenciamento de entrada (teclado/mouse)
│   ├── player.js             # Classe do jogador
│   ├── bullet.js             # Classe de projéteis
│   ├── enemy.js              # Classe de inimigos
│   ├── enemy-manager.js      # Gerenciamento de ondas e spawning
│   ├── audio-manager.js      # Gerenciamento de áudio
│   ├── ui-manager.js         # Interface do usuário
│   └── styles.css            # Estilos da interface
├── assets/                   # Recursos do jogo
│   ├── images/               # Texturas e imagens
│   └── sounds/               # Efeitos sonoros e músicas
├── package.json              # Configuração do projeto
└── README.md                 # Documentação
```

## 🌟 Recursos

- **Gráficos 3D Imersivos**: Ambiente 3D completo com iluminação dinâmica e sombras usando Three.js
- **Sistema de Ondas**: Enfrente ondas progressivamente mais difíceis de inimigos
- **IA Avançada**: Inimigos com comportamento inteligente, usando Finite State Machines
- **Diferentes Tipos de Inimigos**: Cada inimigo tem seu próprio comportamento e padrão de ataque
- **Sistema de Armas**: Implemente diferentes armas com características únicas
- **Áudio Imersivo**: Efeitos sonoros posicionais e música adaptativa usando Howler.js
- **Interface Responsiva**: HUD e menus que se adaptam a diferentes tamanhos de tela

## 👥 Contribuição

Contribuições são bem-vindas! Se quiser contribuir com o projeto:

1. Faça um fork do repositório
2. Crie uma branch para sua feature (`git checkout -b feature/nova-feature`)
3. Faça commit das suas mudanças (`git commit -m 'Adiciona nova feature'`)
4. Envie para a branch (`git push origin feature/nova-feature`)
5. Abra um Pull Request

## 📝 Licença

Este projeto está licenciado sob a licença MIT - veja o arquivo LICENSE para mais detalhes.

## 🙏 Agradecimentos

- Todas as bibliotecas open-source que tornaram este projeto possível, especialmente Three.js e Howler.js
- Inspirado nos clássicos jogos FPS dos anos 90 e 2000

---

🎮 Divirta-se defendendo a galáxia! 🚀 