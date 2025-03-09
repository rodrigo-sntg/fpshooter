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
            
            // Telas do jogo
            startScreen: document.getElementById('start-screen'),
            pauseScreen: document.getElementById('pause-screen'),
            gameoverScreen: document.getElementById('gameover-screen'),
            
            // Elementos da tela de game over
            finalScoreValue: document.getElementById('final-score-value'),
            
            // Crosshair
            crosshair: document.getElementById('crosshair')
        };
        
        // Configura eventos iniciais e estados da UI
        this.setupEventListeners();
    }
    
    /**
     * Configura eventos para elementos da UI
     */
    setupEventListeners() {
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
    }
    
    /**
     * Atualiza todos os elementos da UI com base no estado atual do jogo
     */
    update() {
        // Se o estado do jogo não estiver disponível, não atualiza
        if (!this.gameState) return;
        
        // Determina quais elementos mostrar com base no estado do jogo
        switch (this.gameState.state) {
            case 'playing':
                // No estado de jogo, mostra o HUD e esconde todas as telas
                this.setHUDVisibility(true);
                this.showScreen(null); // Não mostra nenhuma tela
                this.updateHUD();
                break;
            
            case 'menu':
                // No menu, mostra a tela de início e esconde o HUD
                this.setHUDVisibility(false);
                this.showScreen('start-screen');
                break;
                
            case 'paused':
                // Na pausa, mostra a tela de pausa
                this.showScreen('pause-screen');
                break;
                
            case 'gameover':
                // No game over, mostra a tela de game over e atualiza a pontuação final
                this.setHUDVisibility(false);
                this.showScreen('gameover-screen');
                this.updateGameOverScreen({
                    score: this.gameState.score
                });
                break;
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
     * Cria um elemento de splash para dano
     * Mostra um indicador visual na direção de onde o jogador está recebendo dano
     * @param {THREE.Vector3} direction - Direção de onde o dano veio (opcional)
     */
    showDamageSplash(direction = null) {
        // Controle de taxa para evitar exibir muitos efeitos em sequência
        if (this.lastDamageSplashTime && Date.now() - this.lastDamageSplashTime < 300) {
            return; // Limita a frequência de efeitos visuais
        }
        this.lastDamageSplashTime = Date.now();
        
        // Verifica se já existe um splash ativo e reutiliza em vez de criar um novo
        let splash = document.getElementById('damage-splash');
        if (!splash) {
            splash = document.createElement('div');
            splash.id = 'damage-splash';
            document.getElementById('game-container').appendChild(splash);
        }
        
        // Estilo para o splash
        splash.style.position = 'absolute';
        splash.style.width = '100%';
        splash.style.height = '100%';
        splash.style.top = '0';
        splash.style.left = '0';
        splash.style.pointerEvents = 'none';
        splash.style.opacity = '0.6';
        splash.style.transition = 'opacity 0.3s ease-out';
        
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
        setTimeout(() => {
            splash.style.opacity = '0';
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
     * Mostra uma tela específica e esconde as outras
     * @param {string} screenId - ID da tela a ser exibida ('start-screen', 'pause-screen', 'gameover-screen')
     * ou null para esconder todas
     */
    showScreen(screenId) {
        // Lista de todas as telas
        const screens = ['start-screen', 'pause-screen', 'gameover-screen'];
        
        // Esconde todas as telas
        screens.forEach(id => {
            const screen = document.getElementById(id);
            if (screen) {
                screen.classList.remove('active');
            }
        });
        
        // Se um ID foi especificado, mostra a tela correspondente
        if (screenId) {
            const targetScreen = document.getElementById(screenId);
            if (targetScreen) {
                targetScreen.classList.add('active');
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
} 