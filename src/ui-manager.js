/**
 * Gerenciador de interface do usuário
 * Atualiza e controla todos os elementos de UI, como HUD, menus e feedbacks visuais
 */
export class UIManager {
    /**
     * @param {Object} gameState - Referência ao estado do jogo para obter informações atualizadas
     */
    constructor(gameState) {
        // Referências
        this.gameState = gameState;
        
        // Referências aos elementos do DOM
        this.elements = {
            // Elementos HUD
            healthValue: document.getElementById('health-value'),
            healthBar: document.getElementById('health-bar'),
            ammoCount: document.getElementById('ammo-count'),
            scoreValue: document.getElementById('score-value'),
            waveValue: document.getElementById('wave-value'),
            missionText: document.getElementById('mission-text'),
            
            // Telas do jogo
            startScreen: document.getElementById('startScreen'),
            pauseScreen: document.getElementById('pauseScreen'),
            gameoverScreen: document.getElementById('gameoverScreen'),
            mobileTutorialScreen: document.getElementById('mobileTutorialScreen'),
            
            // Elementos da tela de game over
            finalScoreValue: document.getElementById('final-score-value'),
            
            // Crosshair
            crosshair: document.getElementById('crosshair'),
            
            // Elementos multiplayer
            multiplayerScreen: document.getElementById('multiplayerScreen'),
            serverUrl: document.getElementById('server-url'),
            playerName: document.getElementById('player-name'),
            connectButton: document.getElementById('connect-button'),
            disconnectButton: document.getElementById('disconnect-button'),
            backFromMultiplayerButton: document.getElementById('back-from-multiplayer-button'),
            connectionStatus: document.getElementById('connection-status'),
            playersList: document.getElementById('players-list').querySelector('.players-list'),
            multiplayerButton: document.getElementById('multiplayer-button')
        };
        
        // Flag para dispositivos móveis
        this.isMobileDevice = this.detectMobile();
        
        // Configura eventos iniciais e estados da UI
        this.setupEventListeners();
    }
    
    /**
     * Detecta se é um dispositivo móvel
     * @returns {boolean} - Verdadeiro se for dispositivo móvel
     */
    detectMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
               (window.matchMedia && window.matchMedia("(max-width: 767px)").matches);
    }
    
    /**
     * Configura eventos para elementos da UI
     */
    setupEventListeners() {
        // Configuração do botão "ENTENDI" no tutorial móvel
        const mobileTutorialOkButton = document.getElementById('mobile-tutorial-ok');
        if (mobileTutorialOkButton) {
            mobileTutorialOkButton.addEventListener('click', () => {
                console.log("Botão 'ENTENDI' do tutorial móvel clicado");
                
                // Esconde o tutorial
                this.showScreen(null);
                
                // Se estiver no estado de tutorial-mobile, altera para playing
                if (this.gameState && this.gameState.state === 'tutorial-mobile') {
                    console.log("Iniciando jogo após tutorial móvel");
                    this.gameState.setState('playing');
                    
                    // Mostra o HUD
                    this.setHUDVisibility(true);
                    
                    // Exibe a mensagem de tutorial
                    this.showMessage('Use os joysticks para se mover e mirar. Toque no botão vermelho para atirar.', 5000);
                }
            });
        } else {
            console.warn("Botão do tutorial móvel não encontrado no DOM!");
        }
        
        // Exemplo: hover nos botões do menu
        const buttons = document.querySelectorAll('button');
        buttons.forEach(button => {
            button.addEventListener('mouseenter', () => {
                // Pode adicionar som ou efeito visual no hover
                button.style.transform = 'scale(1.05)';
            });
            
            button.addEventListener('mouseleave', () => {
                button.style.transform = 'scale(1)';
            });
        });
        
        // Menu multiplayer
        if (this.elements.connectButton) {
            this.elements.connectButton.addEventListener('click', () => {
                this.handleConnectToServer();
            });
        }
        
        if (this.elements.disconnectButton) {
            this.elements.disconnectButton.addEventListener('click', () => {
                this.handleDisconnectFromServer();
            });
        }
        
        if (this.elements.backFromMultiplayerButton) {
            this.elements.backFromMultiplayerButton.addEventListener('click', () => {
                this.showScreen('startScreen');
            });
        }
        
        // Botão multiplayer no menu principal
        if (this.elements.multiplayerButton) {
            this.elements.multiplayerButton.addEventListener('click', () => {
                console.log("Botão multiplayer clicado!");
                this.showScreen('multiplayerScreen');
            });
        }
    }
    
    /**
     * Atualiza a interface do usuário (chamado a cada frame)
     */
    update() {
        // Verifica se o jogo está em execução
        if (!this.gameState) return;
        
        // Atualiza HUD apenas quando o jogo estiver rodando
        if (this.gameState.state === 'playing') {
            // Mostra o HUD
            this.setHUDVisibility(true);
            
            // Atualiza elementos do HUD
            this.updateHUD();
        } else {
            // Esconde o HUD quando não estiver jogando
            this.setHUDVisibility(false);
            
            // Garante que a tela correta esteja visível com base no estado do jogo
            switch (this.gameState.state) {
                case 'menu':
                    this.showScreen('startScreen');
                    break;
                case 'paused':
                    this.showScreen('pauseScreen');
                    break;
                case 'tutorial-mobile':
                    this.showScreen('mobileTutorialScreen');
                    break;
                case 'gameover':
                    this.showScreen('gameoverScreen');
                    // Atualiza a pontuação final na tela de game over
                    this.updateGameOverScreen({
                        score: this.gameState.score
                    });
                    break;
            }
        }
    }
    
    /**
     * Atualiza os elementos do HUD com informações atuais do jogo
     */
    updateHUD() {
        // Atualiza os elementos se estiverem disponíveis
        
        // Saúde do jogador
        if (this.elements.healthValue && this.gameState.player) {
            // Atualiza a largura da barra de saúde
            const healthPercent = Math.max(0, Math.min(100, this.gameState.player.health));
            this.elements.healthValue.style.width = `${healthPercent}%`;
            
            // Muda a cor conforme a saúde diminui
            if (healthPercent > 60) {
                this.elements.healthValue.style.backgroundColor = '#3f6'; // Verde
            } else if (healthPercent > 30) {
                this.elements.healthValue.style.backgroundColor = '#fc3'; // Amarelo
            } else {
                this.elements.healthValue.style.backgroundColor = '#f33'; // Vermelho
            }
        }
        
        // Munição
        if (this.elements.ammoCount && this.gameState.player) {
            this.elements.ammoCount.textContent = 
                `${this.gameState.player.ammo} / ${this.gameState.player.reserveAmmo}`;
        }
        
        // Pontuação
        if (this.elements.scoreValue) {
            this.elements.scoreValue.textContent = this.gameState.score;
        }
        
        // Onda atual
        if (this.elements.waveValue) {
            this.elements.waveValue.textContent = this.gameState.currentWave;
        }
    }
    
    /**
     * Mostra uma mensagem temporária na tela
     * @param {string} message - Texto da mensagem
     * @param {number} duration - Duração da mensagem em milissegundos (padrão: 3000ms)
     * @param {string} type - Tipo de mensagem ('info', 'warning', 'error', 'success')
     */
    showMessage(message, duration = 3000, type = 'info') {
        // Limita a frequência de mensagens
        if (this.lastMessageTime && Date.now() - this.lastMessageTime < 1000) {
            // Se temos mensagens muito frequentes, enfileira em vez de mostrar imediatamente
            if (!this.messageQueue) this.messageQueue = [];
            this.messageQueue.push({ message, duration, type });
            return;
        }
        
        this.lastMessageTime = Date.now();
        
        // Cria ou reutiliza o elemento de mensagem
        let messageElement = document.getElementById('game-message');
        
        if (!messageElement) {
            messageElement = document.createElement('div');
            messageElement.id = 'game-message';
            document.getElementById('game-container').appendChild(messageElement);
            
            // Estilo base para o elemento de mensagem - configurado apenas uma vez
            messageElement.style.position = 'absolute';
            messageElement.style.top = '20%';
            messageElement.style.left = '50%';
            messageElement.style.transform = 'translateX(-50%)';
            messageElement.style.padding = '10px 20px';
            messageElement.style.borderRadius = '5px';
            messageElement.style.color = '#fff';
            messageElement.style.fontWeight = 'bold';
            messageElement.style.textAlign = 'center';
            messageElement.style.zIndex = '1000';
            messageElement.style.transition = 'opacity 0.3s ease';
            messageElement.style.pointerEvents = 'none'; // Não interfere com cliques
        }
        
        // Cancela timers anteriores
        if (this.messageTimer) {
            clearTimeout(this.messageTimer);
            this.messageTimer = null;
        }
        
        // Define o estilo baseado no tipo
        switch (type) {
            case 'warning':
                messageElement.style.backgroundColor = 'rgba(255, 165, 0, 0.8)';
                break;
            case 'error':
                messageElement.style.backgroundColor = 'rgba(255, 0, 0, 0.8)';
                break;
            case 'success':
                messageElement.style.backgroundColor = 'rgba(0, 128, 0, 0.8)';
                break;
            default: // info
                messageElement.style.backgroundColor = 'rgba(0, 0, 255, 0.8)';
        }
        
        // Define o texto e exibe a mensagem
        messageElement.textContent = message;
        messageElement.style.opacity = '1';
        
        // Remove após a duração especificada
        this.messageTimer = setTimeout(() => {
            messageElement.style.opacity = '0';
            
            // Remove completamente após a transição
            setTimeout(() => {
                // Verifica se há mensagens na fila
                if (this.messageQueue && this.messageQueue.length > 0) {
                    const nextMessage = this.messageQueue.shift();
                    this.showMessage(nextMessage.message, nextMessage.duration, nextMessage.type);
                }
            }, 300);
        }, duration);
    }
    
    /**
     * Cria um elemento de splash para dano
     * Mostra um indicador visual na direção de onde o jogador está recebendo dano
     * @param {THREE.Vector3} direction - Direção de onde o dano veio (opcional)
     */
    showDamageSplash(direction = null) {
        // Controle de taxa para evitar exibir muitos efeitos em sequência
        if (this.lastDamageSplashTime && Date.now() - this.lastDamageSplashTime < 400) {
            return; // Limita a frequência de efeitos visuais ainda mais
        }
        this.lastDamageSplashTime = Date.now();
        
        // Verifica se já existe um splash ativo e reutiliza 
        let splash = document.getElementById('damage-splash');
        if (!splash) {
            // Cria apenas uma vez e reutiliza
            splash = document.createElement('div');
            splash.id = 'damage-splash';
            document.getElementById('game-container').appendChild(splash);
            
            // Estilo para o splash - configurado apenas uma vez
            splash.style.position = 'absolute';
            splash.style.width = '100%';
            splash.style.height = '100%';
            splash.style.top = '0';
            splash.style.left = '0';
            splash.style.pointerEvents = 'none';
            splash.style.transition = 'opacity 0.3s ease-out';
        }
        
        // Se um efeito anterior ainda estiver ativo (fade-out em andamento), cancela
        if (this.damageEffectTimer) {
            clearTimeout(this.damageEffectTimer);
            this.damageEffectTimer = null;
        }
        
        // Se a direção for fornecida, mostrar um gradiente de acordo com a direção
        if (direction) {
            // Determinar de qual direção o dano está vindo
            const angle = Math.atan2(direction.x, direction.z) * (180 / Math.PI);
            const gradientDirection = Math.round(angle / 45) * 45;
            
            // Criar um gradiente na direção do dano
            splash.style.backgroundImage = `radial-gradient(circle at ${this.getPositionFromAngle(gradientDirection)}, rgba(255, 0, 0, 0.7) 0%, transparent 70%)`;
        } else {
            // Se não houver direção, usar um gradiente padrão (vinheta)
            splash.style.backgroundImage = 'radial-gradient(rgba(255, 0, 0, 0.7), transparent 70%)';
        }
        
        // Aplicar a transição de fade-out
        splash.style.opacity = '0.6';
        
        // Remove após um período
        this.damageEffectTimer = setTimeout(() => {
            splash.style.opacity = '0';
            this.damageEffectTimer = null;
        }, 250);
    }
    
    /**
     * Determina a posição CSS para o gradiente com base no ângulo
     * @param {number} angle - Ângulo em graus
     * @returns {string} - Posição CSS (ex: "top left", "center right", etc.)
     */
    getPositionFromAngle(angle) {
        // Normalizar para valores entre 0 e 360
        const normalizedAngle = ((angle % 360) + 360) % 360;
        
        // Converter para posição CSS
        if (normalizedAngle >= 315 || normalizedAngle < 45) return 'bottom center';
        if (normalizedAngle >= 45 && normalizedAngle < 135) return 'left center';
        if (normalizedAngle >= 135 && normalizedAngle < 225) return 'top center';
        if (normalizedAngle >= 225 && normalizedAngle < 315) return 'right center';
        
        return 'center center'; // Fallback
    }
    
    /**
     * Atualiza o estado de visibilidade do HUD
     * @param {boolean} visible - Se o HUD deve estar visível
     */
    setHUDVisibility(visible) {
        const hud = document.getElementById('hud');
        if (hud) {
            hud.style.display = visible ? 'block' : 'none';
        }
    }
    
    /**
     * Mostra uma tela específica do jogo
     * @param {string} screenId - ID da tela a ser mostrada (null para esconder todas)
     */
    showScreen(screenId) {
        console.log(`Tentando mostrar tela: ${screenId}`);
        
        const screens = [
            'startScreen',
            'pauseScreen',
            'gameoverScreen',
            'mobileTutorialScreen',
            'multiplayerScreen'
        ];
        
        // Esconde todas as telas
        screens.forEach(id => {
            const screen = document.getElementById(id);
            if (screen) {
                screen.style.display = 'none';
                console.log(`Escondendo tela: ${id}`);
            } else {
                console.warn(`Tela não encontrada: ${id}`);
            }
        });
        
        // Mostra apenas a tela solicitada
        if (screenId) {
            const screen = document.getElementById(screenId);
            if (screen) {
                screen.style.display = 'flex';
                console.log(`Mostrando tela: ${screenId}`);
            } else {
                console.error(`Tela solicitada não encontrada: ${screenId}`);
            }
        }
        
        // Gerencia visibilidade do HUD baseado na tela
        // HUD deve estar visível apenas durante o jogo ativo
        const shouldShowHUD = !screenId || screenId === null;
        this.setHUDVisibility(shouldShowHUD);
        
        // Garante que a tela multiplayer fique acima do HUD
        if (screenId === 'multiplayerScreen') {
            // Força HUD a ficar oculto quando no menu multiplayer
            this.setHUDVisibility(false);
            
            // Aumenta o z-index da tela multiplayer para garantir que fique acima de tudo
            const multiplayerScreen = document.getElementById('multiplayerScreen');
            if (multiplayerScreen) {
                multiplayerScreen.style.zIndex = "1000";
                console.log("Z-index da tela multiplayer ajustado para 1000");
            } else {
                console.error("Tela multiplayer não encontrada para ajustar z-index");
            }
        }
    }
    
    /**
     * Atualiza a tela de game over com estatísticas
     * @param {Object} stats - Estatísticas do jogo (pontuação, ondas, inimigos eliminados)
     */
    updateGameOverScreen(stats) {
        if (this.elements.finalScoreValue) {
            this.elements.finalScoreValue.textContent = stats.score || 0;
        }
        
        // Aqui pode-se adicionar mais estatísticas ao game over futuramente
    }
    
    /**
     * Atualiza o tamanho e posição dos elementos da UI quando a janela é redimensionada
     */
    resize() {
        // Pode-se adicionar lógica específica de redimensionamento aqui
        // Por exemplo, ajustar posições de elementos baseados no novo tamanho da tela
    }
    
    /**
     * Mostra um tutorial sobre um aspecto específico do jogo
     * @param {string} type - Tipo de tutorial ('sentinelas', 'terminal', etc)
     */
    showTutorial(type) {
        let message = '';
        let duration = 8000;
        
        switch(type) {
            case 'sentinelas':
                message = 'TUTORIAL: Sentinelas são inimigos básicos de COR AZUL. Eles patrulham a base e atacam ao ver você. Use o MOUSE ESQUERDO para atirar e elimine 10 deles para completar a primeira missão.';
                break;
            case 'terminal':
                message = 'TUTORIAL: Localize o terminal de acesso (estrutura com luz AZUL BRILHANTE) para acessar o centro de comando. Siga o marcador visual para encontrá-lo.';
                break;
            case 'boss':
                message = 'TUTORIAL: O comandante inimigo é muito mais forte que os sentinelas comuns. Ele possui mais vida e causa mais dano. Mantenha distância e use cobertura!';
                break;
            default:
                message = 'TUTORIAL: Use WASD para se mover, SHIFT para correr, MOUSE para mirar e BOTÃO ESQUERDO para atirar. R para recarregar e ESC para pausar.';
                duration = 6000;
        }
        
        // Cria ou reutiliza o elemento de mensagem
        let messageElement = document.getElementById('game-message');
        
        if (!messageElement) {
            messageElement = document.createElement('div');
            messageElement.id = 'game-message';
            document.getElementById('game-container').appendChild(messageElement);
            
            // Estilo base para o elemento de mensagem
            messageElement.style.position = 'absolute';
            messageElement.style.top = '20%';
            messageElement.style.left = '50%';
            messageElement.style.transform = 'translateX(-50%)';
            messageElement.style.padding = '10px 20px';
            messageElement.style.borderRadius = '5px';
            messageElement.style.color = '#fff';
            messageElement.style.fontWeight = 'bold';
            messageElement.style.textAlign = 'center';
            messageElement.style.zIndex = '1000';
            messageElement.style.transition = 'opacity 0.3s ease';
            messageElement.style.pointerEvents = 'none'; // Não interfere com cliques
        }
        
        // Aplica o estilo de tutorial
        messageElement.className = 'tutorial-message';
        
        // Define o texto e exibe a mensagem
        messageElement.textContent = message;
        messageElement.style.opacity = '1';
        
        // Remove após a duração especificada
        setTimeout(() => {
            messageElement.style.opacity = '0';
            
            // Remove completamente após a transição
            setTimeout(() => {
                if (messageElement.parentNode) {
                    messageElement.parentNode.removeChild(messageElement);
                }
            }, 300);
        }, duration);
    }
    
    /**
     * Mostra o tutorial de controles móveis
     */
    showMobileTutorial() {
        if (this.isMobileDevice && this.elements.mobileTutorialScreen) {
            // Define o estado do jogo como tutorial-mobile
            if (this.gameState) {
                this.gameState.state = 'tutorial-mobile';
            }
            this.showScreen('mobileTutorialScreen');
            return true;
        }
        return false;
    }
    
    /**
     * Mostra um erro crítico que impede o jogo de continuar
     * @param {string} errorMessage - Mensagem de erro detalhada
     */
    showCriticalError(errorMessage) {
        console.error("ERRO CRÍTICO:", errorMessage);
        
        // Cria um elemento de erro
        const errorElement = document.createElement('div');
        errorElement.id = 'critical-error';
        errorElement.style.position = 'fixed';
        errorElement.style.top = '50%';
        errorElement.style.left = '50%';
        errorElement.style.transform = 'translate(-50%, -50%)';
        errorElement.style.backgroundColor = 'rgba(255, 0, 0, 0.9)';
        errorElement.style.color = 'white';
        errorElement.style.padding = '20px';
        errorElement.style.borderRadius = '5px';
        errorElement.style.maxWidth = '80%';
        errorElement.style.textAlign = 'center';
        errorElement.style.zIndex = '9999';
        errorElement.style.boxShadow = '0 0 20px rgba(0, 0, 0, 0.5)';
        
        // Adiciona conteúdo ao erro
        errorElement.innerHTML = `
            <h2 style="margin-top: 0;">Erro no Jogo</h2>
            <p>${errorMessage}</p>
            <p>Tente recarregar a página ou verificar o console para mais detalhes.</p>
            <button id="reload-game" style="
                background-color: white;
                color: red;
                border: none;
                padding: 10px 20px;
                margin-top: 15px;
                cursor: pointer;
                border-radius: 5px;
                font-weight: bold;
            ">Recarregar Jogo</button>
        `;
        
        // Adiciona o elemento à página
        document.body.appendChild(errorElement);
        
        // Adiciona evento ao botão de recarregar
        document.getElementById('reload-game').addEventListener('click', () => {
            window.location.reload();
        });
    }
    
    /**
     * Inicia conexão com servidor multiplayer
     */
    handleConnectToServer() {
        if (!window.game) {
            console.error("UIManager: Instância do jogo não disponível");
            return;
        }
        
        // Obtém URL do servidor e nome do jogador
        const serverUrl = this.elements.serverUrl.value.trim();
        const playerName = this.elements.playerName.value.trim() || "Jogador" + Math.floor(Math.random() * 1000);
        
        if (!serverUrl) {
            this.showMessage("Informe o endereço do servidor", 3000, "error");
            return;
        }
        
        // Atualiza interface
        this.updateConnectionStatus("Conectando...");
        this.elements.connectButton.disabled = true;
        
        // Inicia modo multiplayer se ainda não iniciado
        if (!window.game.multiplayerReady) {
            window.game.startMultiplayerMode();
        }
        
        // Tenta conectar
        window.game.connectToMultiplayerServer(serverUrl)
            .then(() => {
                // Sucesso na conexão
                this.updateConnectionStatus("Conectado");
                this.elements.connectButton.disabled = true;
                this.elements.disconnectButton.disabled = false;
                
                // Volta para o menu principal após conectar
                this.showScreen('startScreen');
                
                // Inicia o jogo se já não estiver jogando
                if (window.game.gameState.state !== 'playing') {
                    window.game.startGame();
                }
            })
            .catch(error => {
                // Falha na conexão
                this.updateConnectionStatus("Erro: " + error);
                this.elements.connectButton.disabled = false;
                this.showMessage("Falha ao conectar: " + error, 5000, "error");
            });
    }
    
    /**
     * Desconecta do servidor multiplayer
     */
    handleDisconnectFromServer() {
        if (!window.game || !window.game.isMultiplayer) {
            return;
        }
        
        // Desconecta
        window.game.disconnectFromMultiplayerServer();
        
        // Atualiza interface
        this.updateConnectionStatus("Desconectado");
        this.elements.connectButton.disabled = false;
        this.elements.disconnectButton.disabled = true;
        
        // Limpa lista de jogadores
        this.clearPlayersList();
    }
    
    /**
     * Atualiza o status de conexão na interface
     * @param {string} status - Texto de status
     */
    updateConnectionStatus(status) {
        if (this.elements.connectionStatus) {
            this.elements.connectionStatus.textContent = "Status: " + status;
        }
    }
    
    /**
     * Atualiza a lista de jogadores na interface
     * @param {Array} players - Lista de jogadores
     */
    updatePlayersList(players) {
        if (!this.elements.playersList) return;
        
        // Limpa lista
        this.clearPlayersList();
        
        // Adiciona jogadores
        players.forEach(player => {
            const li = document.createElement('li');
            
            const nameSpan = document.createElement('span');
            nameSpan.textContent = player.name || player.id;
            li.appendChild(nameSpan);
            
            if (player.latency !== undefined) {
                const pingSpan = document.createElement('span');
                pingSpan.textContent = player.latency + "ms";
                pingSpan.classList.add('player-ping');
                
                // Destaca latência alta
                if (player.latency > 150) {
                    pingSpan.classList.add('high-ping');
                }
                
                li.appendChild(pingSpan);
            }
            
            this.elements.playersList.appendChild(li);
        });
    }
    
    /**
     * Limpa a lista de jogadores
     */
    clearPlayersList() {
        if (this.elements.playersList) {
            this.elements.playersList.innerHTML = '';
        }
    }
} 