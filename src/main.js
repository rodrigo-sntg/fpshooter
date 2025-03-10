/**
 * Starstrike: Operação Zero - Arquivo Principal
 * 
 * Este arquivo gerencia a inicialização do jogo, o loop de renderização
 * e a interconexão entre os vários módulos do jogo.
 */

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.157.0/build/three.module.js';
import { GAME } from './config.js';
import { GameState } from './game-state.js';
import { InputManager } from './input-manager.js';
import { SceneManager } from './scene-manager.js';
import { Player } from './player.js';
import { EnemyManager } from './enemy-manager.js';
import { AudioManager } from './audio-manager.js';
import { UIManager } from './ui-manager.js';
import { MissionManager } from './mission-manager.js';
import { MobileControls } from './mobile-controls.js';
import { NetworkManager } from './network-manager.js';
import { RemotePlayer } from './remote-player.js';

/**
 * Classe principal que gerencia o jogo
 */
class Game {
    constructor() {
        console.log("Inicializando o jogo...");
        
        // Inicializa variáveis de estado
        this.isRunning = false;
        this.lastTime = 0;
        this.gameState = new GameState();
        
        // Inicializa o gerenciador de entrada
        this.inputManager = new InputManager();
        console.log("InputManager inicializado");
        
        // Configura o renderizador
        this.renderer = new THREE.WebGLRenderer({ 
            canvas: document.getElementById('game-canvas'),
            antialias: true 
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.shadowMap.enabled = true;
        console.log("Renderizador configurado");
        
        // Inicializa gerenciadores
        this.sceneManager = new SceneManager(this.renderer);
        
        // Mantém referências diretas para facilitar o acesso
        this.scene = this.sceneManager.scene;
        this.camera = this.sceneManager.camera;
        
        console.log("SceneManager inicializado, cena:", !!this.scene, "câmera:", !!this.camera);
        
        this.audioManager = new AudioManager();
        this.uiManager = new UIManager(this.gameState);
        
        console.log("AudioManager inicializado:", !!this.audioManager);
        
        // Inicializa o jogador e gerenciador de inimigos
        this.player = new Player(this.camera, this.inputManager);
        this.enemyManager = new EnemyManager(
            this.scene, 
            this.player, 
            this.gameState
        );
        
        // O jogador não tem um mesh principal para adicionar à cena
        // Ele usa a câmera como seu "corpo" e adiciona a arma diretamente à câmera
        
        // Inicializa o gerenciador de missões
        this.missionManager = new MissionManager(
            this.gameState,
            this.player,
            this.uiManager
        );
        
        // Salvar referência ao jogador no gameState
        this.gameState.player = this.player;
        
        // Configura eventos de redimensionamento e listas de eventos
        window.addEventListener('resize', this.onWindowResize.bind(this));
        this.setupEventListeners();
        
        // Inicia uma renderização inicial para garantir que tudo esteja funcionando
        this.sceneManager.render();
        
        // Inicia na tela de título
        this.gameState.setState('menu');
        
        // Tempo do último frame
        this.lastFrameTime = 0;
        
        // Contador de frames
        this.frameCounter = 0;
        
        // Última vez que as estatísticas de FPS foram atualizadas
        this.lastFpsUpdateTime = 0;
        
        // Tempo entre verificações de colisão (para otimização)
        this.collisionCheckInterval = 2;
        
        // Controles móveis
        this.mobileControls = new MobileControls(this.inputManager);
        
        // Adiciona flag para indicar se é modo multiplayer
        this.isMultiplayer = false;
        this.networkManager = null;
        this.remotePlayers = new Map(); // id -> RemotePlayer
        
        // Configurações multiplayer
        this.multiplayerReady = false;
        this.multiplayerEnabled = true; // Habilitado por padrão
        this.defaultServerUrl = 'ws://localhost:8080';
        
        console.log("Jogo inicializado");
    }
    
    /**
     * Configura os ouvintes de eventos para interações do usuário
     */
    setupEventListeners() {
        console.log("Configurando listeners de eventos...");
        
        // Botão iniciar
        const startButton = document.getElementById('start-button');
        if (startButton) {
            startButton.addEventListener('click', () => {
                console.log("Botão iniciar clicado!");
                this.startGame();
            });
        } else {
            console.error("Botão 'start-button' não encontrado no DOM");
        }
        
        // Botão retomar (pausa)
        const resumeButton = document.getElementById('resume-button');
        if (resumeButton) {
            resumeButton.addEventListener('click', () => {
                this.resumeGame();
            });
        }
        
        // Botão reiniciar (pausa/game over)
        const restartButton = document.getElementById('restart-button');
        if (restartButton) {
            restartButton.addEventListener('click', () => {
                this.restartGame();
            });
        }
        
        // Botões de menu (pausa/game over)
        const menuButton = document.getElementById('menu-button');
        if (menuButton) {
            menuButton.addEventListener('click', () => {
                this.returnToMenu();
            });
        }
        
        const gameoverMenuButton = document.getElementById('gameover-menu-button');
        if (gameoverMenuButton) {
            gameoverMenuButton.addEventListener('click', () => {
                this.returnToMenu();
            });
        }
        
        // Botão tentar novamente (game over)
        const retryButton = document.getElementById('retry-button');
        if (retryButton) {
            retryButton.addEventListener('click', () => {
                this.restartGame();
            });
        }
        
        // Tecla ESC para pausar
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.gameState.state === 'playing') {
                console.log("Tecla ESC pressionada - pausando jogo");
                this.pauseGame();
            }
        });
        
        console.log("Eventos configurados");
    }
    
    /**
     * Inicia o jogo
     * @param {boolean} forceRestart - Se deve forçar o reinício mesmo se já estiver rodando
     */
    startGame(forceRestart = false) {
        // Se já estiver rodando e não for forçar reinício, apenas retorna
        if (this.gameState.state === 'playing' && !forceRestart) {
            console.log("Jogo já está em execução");
            return;
        }
        
        console.log("Iniciando o jogo...");
        
        // Desbloqueia o áudio (importante para navegadores modernos)
        if (this.audioManager && typeof this.audioManager.unlockAudio === 'function') {
            this.audioManager.unlockAudio();
        }
        
        // Reseta a pontuação e status do jogo se não estiver em modo multiplayer
        // Em multiplayer, queremos preservar o estado do jogador
        if (!this.isMultiplayer || forceRestart) {
            this.gameState.resetScore();
            
            // Reseta o jogador
            this.player.reset();
            
            // Reseta o gerenciador de inimigos
            this.enemyManager.reset();
            
            // Carrega as missões da fase 1
            this.missionManager.loadMissions(1);
            
            // Inicializa a primeira onda
            this.enemyManager.startNextWave();
        }
        
        // Garante que a arma seja visível após alguns segundos
        setTimeout(() => {
            if (this.player && typeof this.player.ensureWeaponVisible === 'function') {
                this.player.ensureWeaponVisible();
            }
        }, 3000);
        
        // Se for um dispositivo móvel, mostra o tutorial de controles
        if (this.inputManager.isMobileDevice) {
            // Pausa o jogo temporariamente
            this.gameState.setState('tutorial-mobile');
            
            // Mostra o tutorial
            this.uiManager.showMobileTutorial();
        } else {
            // Caso não seja móvel, inicia o jogo normalmente
            this.gameState.setState('playing');
            
            // Bloqueia o ponteiro do mouse
            this.lockMouse();
            
            // Mostra mensagem de tutorial inicial
            this.uiManager.showMessage('Use WASD para mover e o mouse para mirar. Clique para atirar.', 5000);
            
            // Após alguns segundos, mostra tutorial completo
            setTimeout(() => {
                if (this.uiManager && typeof this.uiManager.showTutorial === 'function') {
                    this.uiManager.showTutorial('default');
                }
            }, 6000);
        }
        
        // Inicializa o modo multiplayer
        if (this.multiplayerEnabled && !this.isMultiplayer) {
            this.startMultiplayerMode();
            
            // Conecta automaticamente ao servidor padrão se configurado
            if (this.defaultServerUrl && !this.networkManager?.connected) {
                this.connectToMultiplayerServer(this.defaultServerUrl)
                    .catch(error => {
                        console.error("Falha ao conectar ao servidor padrão:", error);
                    });
            }
        }
        
        // Inicia o loop de jogo se ainda não estiver rodando
        if (!this.isRunning) {
            console.log("Iniciando loop principal do jogo");
            this.isRunning = true;
            this.lastTime = performance.now();
            requestAnimationFrame(this.gameLoop.bind(this));
        }
        
        console.log("Jogo iniciado!");
    }
    
    /**
     * Bloqueia o ponteiro do mouse para controle da câmera
     */
    lockMouse() {
        try {
            document.body.requestPointerLock();
        } catch (error) {
            console.error("Erro ao bloquear o ponteiro:", error);
        }
    }
    
    /**
     * Pausa o jogo
     */
    pauseGame() {
        if (this.gameState.state === 'playing') {
            console.log("Pausando jogo");
            this.gameState.setState('paused');
            document.exitPointerLock();
        }
    }
    
    /**
     * Retoma o jogo após pausa
     */
    resumeGame() {
        console.log("Retomando jogo...");
        
        // Muda o estado do jogo para jogando
        this.gameState.setState('playing');
        
        // Esconde o cursor do mouse e bloqueia-o para controle de câmera
        this.lockMouse();
        
        // Inicia o loop de jogo se ainda não estiver rodando
        if (!this.isRunning) {
            console.log("Reiniciando loop do jogo após pausa");
            this.isRunning = true;
            this.lastTime = performance.now();
            requestAnimationFrame(this.gameLoop.bind(this));
        }
        
        console.log("Jogo retomado!");
    }
    
    /**
     * Reinicia o jogo (após game over ou da tela de pausa)
     */
    restartGame() {
        console.log("Reiniciando jogo");
        // Armazena estado multiplayer
        const wasMultiplayer = this.isMultiplayer;
        const serverUrl = this.networkManager?.serverUrl;
        const authToken = this.networkManager?.authToken;
        
        // Desconecta do servidor
        if (wasMultiplayer) {
            this.disconnectFromMultiplayerServer();
        }
        
        // Código original de reinício
        this.gameState.setState('playing');
        this.player.reset();
        this.enemyManager.reset();
        this.gameState.resetScore();
        this.enemyManager.startNextWave();
        document.body.requestPointerLock();
        
        // Reconecta se estava em modo multiplayer
        if (wasMultiplayer) {
            this.startMultiplayerMode();
            this.connectToMultiplayerServer(serverUrl, authToken)
                .catch(error => {
                    console.error("Falha ao reconectar ao servidor:", error);
                });
        }
    }
    
    /**
     * Retorna ao menu principal
     */
    returnToMenu() {
        console.log("Retornando ao menu");
        this.gameState.setState('menu');
        document.exitPointerLock();
    }
    
    /**
     * Encerra o jogo (game over)
     */
    gameOver() {
        console.log("Game Over");
        this.gameState.setState('gameover');
        document.exitPointerLock();
        
        // Atualiza a pontuação final na tela de game over
        const finalScoreValue = document.getElementById('final-score-value');
        if (finalScoreValue) {
            finalScoreValue.textContent = this.gameState.score;
        }
    }
    
    /**
     * Adaptação às mudanças de tamanho da janela
     */
    onWindowResize() {
        console.log("Redimensionando janela");
        // Atualiza a câmera
        this.sceneManager.camera.aspect = window.innerWidth / window.innerHeight;
        this.sceneManager.camera.updateProjectionMatrix();
        
        // Atualiza o renderizador
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
    
    /**
     * Loop principal do jogo
     * @param {number} time - Timestamp do quadro atual
     */
    gameLoop(time) {
        if (!this.isRunning) return;
        
        // Calcula delta time
        const deltaTime = (time - this.lastTime) / 1000;
        this.lastTime = time;
        
        // Limita o deltaTime para evitar comportamentos estranhos quando a aba está em segundo plano
        const cappedDeltaTime = Math.min(deltaTime, 0.1);
        
        // Incrementa o contador de frames
        this.frameCounter = (this.frameCounter || 0) + 1;
        
        // Atualiza o jogo apenas se não estiver pausado
        if (this.gameState.state === 'playing') {
            // Atualiza a física e movimentos do jogador
            if (this.player) {
                this.player.update(cappedDeltaTime);
            }
            
            // Atualiza os inimigos
            if (this.enemyManager) {
                this.enemyManager.update(cappedDeltaTime);
            }
            
            // Atualiza projéteis do jogador
            this.updatePlayerBullets();
            
            // Verifica colisões
            this.checkCollisions();
            
            // Atualiza jogadores remotos a cada 3 frames para economizar CPU
            if (this.isMultiplayer && this.frameCounter % 3 === 0) {
                for (const remotePlayer of this.remotePlayers.values()) {
                    if (remotePlayer && typeof remotePlayer.update === 'function') {
                        remotePlayer.update(cappedDeltaTime * 3); // Compensamos o deltaTime
                    }
                }
                
                // Log apenas ocasionalmente (a cada ~10 segundos)
                if (this.frameCounter % 600 === 0) {
                    console.log(`Jogadores remotos conectados: ${this.remotePlayers.size}`);
                }
            }
            
            // Envia atualizações de rede a cada 200ms (5 vezes por segundo)
            if (this.isMultiplayer && this.networkManager && this.networkManager.connected) {
                this.networkUpdateTimer = (this.networkUpdateTimer || 0) + cappedDeltaTime;
                if (this.networkUpdateTimer >= 0.2) { // 200ms
                    this.networkUpdateTimer = 0;
                    
                    // Envia atualização de posição para o servidor
                    if (this.player) {
                        this.networkManager.sendPlayerUpdate(
                            this.player.position,
                            this.player.velocity,
                            this.player.rotation
                        );
                    }
                }
            }
            
            // Atualiza rede (multiplayer)
            if (this.isMultiplayer && this.networkManager) {
                this.networkManager.update(cappedDeltaTime);
                
                // Atualiza jogadores remotos
                this.remotePlayers.forEach(player => {
                    player.update(cappedDeltaTime);
                });
                
                // A cada 5 segundos, verificar a visibilidade dos jogadores remotos
                if (this.frameCounter % 300 === 0) {
                    this._checkRemotePlayersVisibility();
                }
            }
        }

        // Verifica se a cena e a câmera estão definidas antes de renderizar
        if (this.renderer && this.sceneManager && this.sceneManager.scene && this.sceneManager.camera) {
            try {
                // Renderiza a cena
                this.renderer.render(this.sceneManager.scene, this.sceneManager.camera);
            } catch (error) {
                console.error("Erro ao renderizar a cena:", error);
            }
        } else {
            console.warn("Não foi possível renderizar: renderer, cena ou câmera não está disponível");
        }

        // Atualiza o UI
        if (this.uiManager) {
            this.uiManager.update();
        }
        
        // Continua o loop
        requestAnimationFrame(this.gameLoop.bind(this));
    }
    
    /**
     * Atualiza e gerencia os projéteis do jogador
     */
    updatePlayerBullets() {
        try {
            // Adiciona novos projéteis à cena (limitando para melhorar performance)
            const newBullets = this.player.bullets.filter(bullet => !bullet.addedToScene);
            
            // Limita o número máximo de projéteis ativos
            if (this.player.bullets.length > 10) {
                // Remove os mais antigos se exceder o limite
                const toRemove = this.player.bullets.length - 10;
                for (let i = 0; i < toRemove; i++) {
                    if (this.player.bullets[i].addedToScene) {
                        this.sceneManager.scene.remove(this.player.bullets[i].mesh);
                    }
                }
                this.player.bullets = this.player.bullets.slice(toRemove);
            }
            
            newBullets.forEach(bullet => {
                this.sceneManager.scene.add(bullet.mesh);
                bullet.addedToScene = true;
            });
            
            // Remove projéteis que colidiram ou saíram do alcance
            this.player.bullets = this.player.bullets.filter(bullet => {
                // Se o projétil deve ser removido
                if (bullet.hasCollided || bullet.distance > bullet.maxDistance) {
                    if (bullet.mesh.parent) {
                        this.sceneManager.scene.remove(bullet.mesh);
                    }
                    return false; // Remove o projétil da lista
                }
                return true; // Mantém o projétil na lista
            });
        } catch (error) {
            console.error("Erro ao atualizar projéteis:", error);
        }
    }
    
    /**
     * Verifica colisões entre entidades do jogo
     */
    checkCollisions() {
        try {
            // Verifica colisões de projéteis do jogador com inimigos
            const bulletCollisions = this.enemyManager.checkProjectileCollisions(this.player.bullets);
            
            // Registra eliminações para as missões
            if (bulletCollisions.length > 0) {
                bulletCollisions.forEach(enemy => {
                    if (enemy.health <= 0) {
                        console.log(`Inimigo eliminado do tipo: ${enemy.type}`);
                        
                        // Inimigo foi eliminado
                        this.missionManager.updateMissionProgress({
                            enemyType: enemy.type
                        });
                        
                        // Se for um sentinela (basic), verifica se estamos na missão 1
                        if (enemy.type === 'basic' && 
                            this.missionManager.currentMission && 
                            this.missionManager.currentMission.id === "level1_mission1") {
                            
                            // Força o spawn de um novo sentinela para garantir que há sempre alvos
                            setTimeout(() => {
                                const spawnPoint = this.enemyManager.getRandomSpawnPoint();
                                this.enemyManager.spawnBasic(spawnPoint);
                            }, 5000); // Depois de 5 segundos
                        }
                    }
                });
            }
            
            // Verifica colisões dos projéteis dos inimigos com o jogador
            const enemyBulletHits = this.enemyManager.checkEnemyBulletCollisions();
            if (enemyBulletHits > 0) {
                console.log(`O jogador foi atingido por ${enemyBulletHits} projéteis inimigos`);
            }
            
            // Verifica colisões do jogador com inimigos (corpo a corpo)
            const playerCollisions = this.enemyManager.checkPlayerCollisions();
            
            // Processa dano do jogador se houver colisões com inimigos
            playerCollisions.forEach(enemy => {
                if (this.player.takeDamage(enemy.damage * 0.5)) {
                    // Se o jogador morreu
                    this.gameOver();
                }
                
                // Mostra efeito visual de dano
                this.uiManager.showDamageSplash(new THREE.Vector3().subVectors(enemy.position, this.player.position));
            });
        } catch (error) {
            console.error("Erro ao verificar colisões:", error);
        }
    }
    
    // Conecta ao servidor multiplayer
    connectToMultiplayerServer(serverUrl, playerName = null, authToken = null) {
        try {
            // Verifica se já está conectado ao mesmo servidor
            if (this.networkManager && this.networkManager.connected && this.networkManager.serverUrl === serverUrl) {
                console.log(`Game: Já está conectado ao servidor ${serverUrl}`);
                
                if (this.uiManager) {
                    this.uiManager.showMessage("Já está conectado ao servidor!", 3000, "info");
                }
                
                return Promise.resolve(true);
            }
            
            // Se estiver conectado a outro servidor, desconecta primeiro
            if (this.networkManager && this.networkManager.connected) {
                console.log(`Game: Desconectando do servidor atual antes de conectar a um novo`);
                this.disconnectFromMultiplayerServer();
            }
            
            console.log(`Game: Conectando ao servidor multiplayer ${serverUrl}`);
            
            // Verifica se o modo multiplayer está inicializado
            if (!this.multiplayerReady || !this.networkManager) {
                // Inicializa o modo multiplayer primeiro
                if (!this.startMultiplayerMode()) {
                    return Promise.reject(new Error("Falha ao inicializar modo multiplayer"));
                }
            }
            
            // Define o nome do jogador se fornecido
            if (playerName) {
                this.player.name = playerName;
                console.log(`Game: Nome do jogador definido como "${playerName}"`);
            }
            
            // Limpa jogadores remotos existentes
            this._removeAllRemotePlayers();
            
            // Conecta ao servidor
            return this.networkManager.connect(serverUrl, authToken, playerName)
                .then(() => {
                    console.log("Game: Conectado com sucesso ao servidor multiplayer");
                    
                    // Configura callbacks de rede
                    this._setupNetworkCallbacks();
                    
                    // Atualiza a UI
                    if (this.uiManager) {
                        this.uiManager.showMessage("Conectado ao servidor multiplayer!", 3000, "success");
                        this.uiManager.updateConnectionStatus("Conectado");
                        
                        // Verifica se o método updateNetworkStatus existe
                        if (typeof this.uiManager.updateNetworkStatus === 'function') {
                            this.uiManager.updateNetworkStatus(true, this.networkManager.latency);
                        }
                    }
                    
                    return true;
                })
                .catch(error => {
                    console.error("Game: Erro ao conectar ao servidor multiplayer:", error);
                    
                    // Atualiza a UI
                    if (this.uiManager) {
                        this.uiManager.showMessage("Falha ao conectar ao servidor: " + error.message, 5000, "error");
                        this.uiManager.updateConnectionStatus("Falha na conexão");
                        
                        // Verifica se o método updateNetworkStatus existe
                        if (typeof this.uiManager.updateNetworkStatus === 'function') {
                            this.uiManager.updateNetworkStatus(false);
                        }
                    }
                    
                    return Promise.reject(error);
                });
        } catch (error) {
            console.error("Erro ao tentar conectar ao servidor:", error);
            return Promise.reject(error);
        }
    }
    
    // Inicializa o modo multiplayer
    startMultiplayerMode() {
        try {
            console.log("Game: Inicializando modo multiplayer");
            
            if (!this.player || !this.gameState) {
                console.warn("Game: Jogador ou estado do jogo não estão inicializados");
                return false;
            }
            
            // Define o flag de multiplayer
            this.isMultiplayer = true;
            
            // Cria o gerenciador de rede se ainda não existir
            if (!this.networkManager) {
                this.networkManager = new NetworkManager(this.gameState, this.player);
            }
            
            // Adiciona referência à cena no player para remover projéteis
            this.player.scene = this.scene;
            
            // Configura o temporizador de atualização da rede
            this.networkUpdateTimer = 0;
            
            // Inicializa o mapa de jogadores remotos se ainda não existir
            if (!this.remotePlayers) {
                this.remotePlayers = new Map();
            }
            
            // Flag para indicar que o multiplayer está pronto
            this.multiplayerReady = true;
            
            // Notifica a UI, se disponível
            if (this.uiManager) {
                this.uiManager.updateConnectionStatus("Modo multiplayer ativado");
            }
            
            console.log("Game: Modo multiplayer inicializado e pronto para conexão");
            return true;
        } catch (error) {
            console.error("Erro ao inicializar modo multiplayer:", error);
            this.isMultiplayer = false;
            this.multiplayerReady = false;
            return false;
        }
    }
    
    // Desconecta do servidor multiplayer
    disconnectFromMultiplayerServer() {
        try {
            console.log("Game: Desconectando do servidor multiplayer");
            
            // Verifica se o networkManager existe e está conectado
            if (!this.networkManager) {
                console.warn("Game: NetworkManager não inicializado");
                return;
            }
            
            // Desconecta do servidor
            this.networkManager.disconnect();
            
            // Remove todos os jogadores remotos
            this._removeAllRemotePlayers();
            
            // Reseta flags e estado
            this.isMultiplayer = false;
            this.networkUpdateTimer = 0;
            
            // Se o jogo estava em modo multiplayer, mas não estava jogando,
            // redefine o estado do jogo para o menu
            if (this.gameState.state !== 'playing') {
                this.gameState.setState('menu');
            }
            
            // Atualiza a UI
            if (this.uiManager) {
                // Atualiza status na UI
                this.uiManager.updateConnectionStatus("Desconectado");
                
                // Atualiza mensagem para o usuário
                this.uiManager.showMessage("Desconectado do servidor multiplayer", 3000, "info");
                
                // Atualiza status na rede, se o método existir
                if (typeof this.uiManager.updateNetworkStatus === 'function') {
                    this.uiManager.updateNetworkStatus(false);
                }
                
                // Limpa a lista de jogadores
                if (typeof this.uiManager.clearPlayersList === 'function') {
                    this.uiManager.clearPlayersList();
                }
            }
            
            console.log("Game: Desconectado do servidor multiplayer e modo multiplayer desativado");
        } catch (error) {
            console.error("Erro ao desconectar do servidor:", error);
        }
    }
    
    // Configura callbacks para eventos de rede
    _setupNetworkCallbacks() {
        if (!this.networkManager) return;
        
        // Quando um jogador se conecta
        this.networkManager.onPlayerJoined = (playerData) => {
            console.log(`Game: Novo jogador conectado [${playerData.id}]`);
            this._createRemotePlayer(playerData.id, playerData);
            
            // Notifica o jogador via UI
            this.uiManager.showMessage(`Jogador ${playerData.id} entrou no jogo`, 3000, "info");
        };
        
        // Quando um jogador se desconecta
        this.networkManager.onPlayerLeft = (playerData) => {
            console.log(`Game: Jogador desconectado [${playerData.id}]`);
            this._removeRemotePlayer(playerData.id);
            
            // Notifica o jogador via UI
            this.uiManager.showMessage(`Jogador ${playerData.id} saiu do jogo`, 3000, "info");
        };
        
        // Quando a conexão com o servidor é perdida
        this.networkManager.onDisconnect = (reason) => {
            console.log(`Game: Desconectado do servidor: ${reason}`);
            
            // Notifica o jogador via UI
            this.uiManager.showMessage(`Desconectado do servidor: ${reason}`, 5000, "error");
            
            // Remove todos os jogadores remotos
            this._removeAllRemotePlayers();
            
            // Reseta flags
            this.isMultiplayer = false;
        };
    }
    
    // Cria um jogador remoto
    _createRemotePlayer(id, playerData) {
        try {
            // Verifica se já existe um jogador com este ID
            if (this.remotePlayers.has(id)) {
                console.warn(`Game: Jogador remoto [${id}] já existe. Atualizando...`);
                // Atualiza os dados do jogador existente
                const existingPlayer = this.remotePlayers.get(id);
                existingPlayer.updateFromNetworkData(playerData);
                return existingPlayer;
            }
            
            console.log(`Game: Criando jogador remoto [${id}] com dados:`, JSON.stringify(playerData));
            
            // Certifica-se de que a cena está disponível
            if (!this.scene) {
                console.error(`ERRO CRÍTICO: Não é possível criar jogador remoto - cena indisponível`);
                return null;
            }
            
            // Verifica se os dados do jogador são válidos
            if (!playerData || !playerData.position) {
                console.error(`ERRO: Dados inválidos para jogador remoto [${id}]`);
                // Caso não tenha posição, criar uma posição padrão para teste
                playerData = playerData || {};
                playerData.position = {
                    x: Math.random() * 20 - 10, // Posição aleatória entre -10 e 10
                    y: 1.8, // Altura padrão do jogador
                    z: Math.random() * 20 - 10
                };
                console.log(`Game: Criando posição padrão para jogador [${id}]:`, playerData.position);
            }
            
            // Verifica a posição do jogador local para DEBUG
            if (this.player) {
                console.log(`Game: Posição do jogador local: (${this.player.position.x.toFixed(2)}, ${this.player.position.y.toFixed(2)}, ${this.player.position.z.toFixed(2)})`);
            }
            
            // Adiciona um deslocamento para garantir que o jogador remoto seja visível
            // Isso é apenas para debug, em produção deve-se usar a posição real
            playerData.position.x += 5; // Desloca 5 unidades no eixo X
            playerData.position.z += 5; // Desloca 5 unidades no eixo Z
            
            console.log(`Game: Posição ajustada para jogador remoto [${id}]: (${playerData.position.x.toFixed(2)}, ${playerData.position.y.toFixed(2)}, ${playerData.position.z.toFixed(2)})`);
            
            // Cria um novo jogador remoto
            const remotePlayer = new RemotePlayer(
                id, 
                playerData, 
                this.scene
            );
            
            // Adiciona ao mapa de jogadores remotos
            this.remotePlayers.set(id, remotePlayer);
            
            console.log(`Game: Jogador remoto [${id}] criado com sucesso`);
            
            // Notifica o usuário
            if (this.uiManager) {
                this.uiManager.showMessage(`Jogador ${remotePlayer.name || id} entrou no jogo!`, 'success');
            }
            
            return remotePlayer;
        } catch (error) {
            console.error(`Erro ao criar jogador remoto [${id}]:`, error);
            return null;
        }
    }
    
    // Remove um jogador remoto
    _removeRemotePlayer(id) {
        const remotePlayer = this.remotePlayers.get(id);
        if (!remotePlayer) return;
        
        // Remove da cena
        remotePlayer.remove();
        
        // Remove do mapa
        this.remotePlayers.delete(id);
        
        console.log(`Game: Jogador remoto [${id}] removido`);
    }
    
    // Remove todos os jogadores remotos
    _removeAllRemotePlayers() {
        try {
            if (!this.remotePlayers) {
                console.log("Game: Não há jogadores remotos para remover");
                return;
            }
            
            const count = this.remotePlayers.size;
            
            // Remove cada jogador remoto
            this.remotePlayers.forEach((player, id) => {
                try {
                    if (player && typeof player.remove === 'function') {
                        player.remove();
                        console.log(`Game: Jogador remoto [${id}] removido`);
                    } else {
                        console.warn(`Game: Jogador remoto [${id}] inválido, não foi possível remover`);
                    }
                } catch (error) {
                    console.error(`Erro ao remover jogador remoto [${id}]:`, error);
                }
            });
            
            // Limpa o mapa
            this.remotePlayers.clear();
            
            console.log(`Game: Todos os jogadores remotos foram removidos (${count} jogadores)`);
        } catch (error) {
            console.error("Erro ao remover todos os jogadores remotos:", error);
        }
    }
    
    // Sobrescrever método shoot para enviar informações ao servidor
    shoot() {
        // Código original de tiro...
        
        // Envia informação de tiro ao servidor se estiver no modo multiplayer
        if (this.isMultiplayer && this.networkManager) {
            const position = this.player.getBulletSpawnPosition();
            const direction = this.player.getBulletDirection();
            
            this.networkManager.sendShoot(position, direction);
        }
    }
    
    // Adicionar método para mostrar estatísticas de rede na UI
    showNetworkStats() {
        if (!this.isMultiplayer || !this.networkManager) {
            console.warn("Estatísticas de rede não disponíveis: modo multiplayer não ativo");
            return;
        }
        
        const stats = {
            latency: this.networkManager.latency + "ms",
            connectedPlayers: this.remotePlayers.size + 1, // +1 para incluir o jogador local
            playerId: this.networkManager.playerId
        };
        
        console.log("Estatísticas de rede:", stats);
        
        // Exibe na UI
        this.uiManager.showMessage(
            `Latência: ${stats.latency} | Jogadores: ${stats.connectedPlayers} | ID: ${stats.playerId}`,
            5000,
            "info"
        );
    }
    
    // Verifica se os jogadores remotos estão visíveis
    _checkRemotePlayersVisibility() {
        if (!this.remotePlayers || !this.camera) return;
        
        // Criar um frustum da câmera para ver quais objetos estão no campo de visão
        const frustum = new THREE.Frustum();
        const matrix = new THREE.Matrix4().multiplyMatrices(
            this.camera.projectionMatrix,
            this.camera.matrixWorldInverse
        );
        frustum.setFromProjectionMatrix(matrix);
        
        // Verificar cada jogador remoto
        console.log(`=== VERIFICAÇÃO DE VISIBILIDADE DOS JOGADORES REMOTOS ===`);
        console.log(`Total de jogadores remotos: ${this.remotePlayers.size}`);
        
        this.remotePlayers.forEach((player, id) => {
            if (!player.mesh) {
                console.log(`Jogador [${id}] não tem mesh para verificar visibilidade`);
                return;
            }
            
            // Obtém a posição do jogador
            const position = player.mesh.position;
            
            // Verifica se o jogador está dentro do campo de visão da câmera
            const isVisible = frustum.containsPoint(position);
            
            // Calcular distância
            const cameraPosition = this.camera.position;
            const distance = position.distanceTo(cameraPosition);
            
            console.log(`Jogador [${id}]: Posição (${position.x.toFixed(2)}, ${position.y.toFixed(2)}, ${position.z.toFixed(2)}), Visível: ${isVisible}, Distância: ${distance.toFixed(2)}`);
            
            // Forçar visibilidade para debug
            player.mesh.visible = true;
            
            // Aumentar tamanho para debug se estiver muito distante
            if (distance > 20) {
                player.mesh.scale.set(6, 6, 6);
            } else if (distance > 10) {
                player.mesh.scale.set(3, 3, 3);
            }
            
            // Adicionar um helper para visualizar a posição
            if (!player.mesh.userData.helper) {
                const helper = new THREE.AxesHelper(5); // 5 unidades de tamanho
                player.mesh.add(helper);
                player.mesh.userData.helper = helper;
            }
        });
    }
}

// Aguarda o carregamento do DOM antes de iniciar o jogo
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM carregado, iniciando o jogo...");
    
    // Verifica se o navegador suporta WebGL
    if (!window.WebGLRenderingContext) {
        alert('Seu navegador não suporta WebGL, que é necessário para executar este jogo.');
        return;
    }
    
    try {
        // Cria a instância do jogo
        const game = new Game();
        
        // Expõe o objeto do jogo globalmente para acesso aos sistemas
        window.game = game;
        
        // Log adicional se estiver em modo de depuração
        if (GAME.DEBUG_MODE) {
            console.log("Modo de depuração ativado - Game exposto como window.game");
        }
    } catch (error) {
        console.error("Erro ao inicializar o jogo:", error);
        alert("Ocorreu um erro ao iniciar o jogo. Verifique o console para mais detalhes.");
    }
}); 