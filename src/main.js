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
        this.audioManager = new AudioManager();
        this.uiManager = new UIManager(this.gameState);
        
        console.log("AudioManager inicializado:", !!this.audioManager);
        
        // Inicializa o jogador e gerenciador de inimigos
        this.player = new Player(this.sceneManager.camera, this.inputManager);
        this.enemyManager = new EnemyManager(
            this.sceneManager.scene, 
            this.player, 
            this.gameState
        );
        
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
        
        // Inicializa o manager de rede quando o jogador estiver pronto
        this.multiplayerReady = false;
        
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
     */
    startGame() {
        console.log("Iniciando o jogo...");
        
        // Desbloqueia o áudio (importante para navegadores modernos)
        if (this.audioManager && typeof this.audioManager.unlockAudio === 'function') {
            this.audioManager.unlockAudio();
        }
        
        // Reseta a pontuação e status do jogo
        this.gameState.resetScore();
        
        // Reseta o jogador
        this.player.reset();
        
        // Reseta o gerenciador de inimigos
        this.enemyManager.reset();
        
        // Carrega as missões da fase 1
        this.missionManager.loadMissions(1);
        
        // Inicializa a primeira onda
        this.enemyManager.startNextWave();
        
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
        if (this.multiplayerEnabled) {
            this.startMultiplayerMode();
            
            // Conecta automaticamente ao servidor padrão se configurado
            if (this.defaultServerUrl) {
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
     * @param {number} currentTime - Tempo atual em milissegundos
     */
    gameLoop(currentTime) {
        try {
            // Solicita o próximo frame de animação
            requestAnimationFrame(this.gameLoop.bind(this));
            
            // Calcula o delta time (tempo entre frames)
            const deltaTime = Math.min((currentTime - this.lastTime) / 1000, 0.1); // Limitado a 0.1s para evitar saltos grandes
            this.lastTime = currentTime;
            
            // Contador de frames para otimização
            if (!this.frameCounter) this.frameCounter = 0;
            this.frameCounter++;
            
            // Apenas atualiza se o jogo estiver rodando
            if (this.gameState.state === 'playing') {
                // Atualiza input sempre para garantir responsividade
                this.inputManager.update();
                
                // Sempre atualiza o jogador para movimento fluido
                this.player.update(deltaTime);
                
                // Atualiza TODOS os inimigos a cada frame para movimento fluido
                this.enemyManager.update(deltaTime);
                
                // Otimização: Gerencia projéteis a cada 2 frames
                if (this.frameCounter % 2 === 0) {
                    this.updatePlayerBullets();
                    
                    // Verifica colisões a cada 2 frames (compromisso entre precisão e performance)
                    this.checkCollisions();
                }
                
                // Otimização: Atualiza a cena (animações, luzes) a cada 3 frames
                if (this.frameCounter % 3 === 0) {
                    this.sceneManager.update(deltaTime);
                }
                
                // Otimização: Atualiza o gerenciador de missões a cada 4 frames
                if (this.frameCounter % 4 === 0) {
                    this.missionManager.update(deltaTime);
                }
                
                // Otimização: Atualiza a UI a cada 5 frames
                if (this.frameCounter % 5 === 0) {
                    this.uiManager.update();
                }
                
                // Verifica condição de game over
                if (this.player.health <= 0) {
                    this.gameOver();
                }
                
                // Atualização de jogadores remotos no modo multiplayer
                if (this.isMultiplayer) {
                    // Atualiza jogadores remotos
                    this.remotePlayers.forEach(player => {
                        player.update(deltaTime);
                    });
                    
                    // Atualiza gerenciador de rede
                    this.networkManager.update(deltaTime);
                    
                    // Envia atualizações ao servidor em intervalos
                    if (this.networkUpdateTimer <= 0) {
                        // Envia posição e rotação atual
                        this.networkManager.sendPlayerUpdate(
                            this.player.position,
                            this.player.velocity,
                            this.player.rotation
                        );
                        
                        // Redefine o temporizador (10 atualizações por segundo)
                        this.networkUpdateTimer = 0.1;
                    } else {
                        this.networkUpdateTimer -= deltaTime;
                    }
                }
            }
            
            // Sempre renderiza a cena, mesmo em estados não-jogando
            this.sceneManager.render();
            
        } catch (error) {
            console.error("Erro no gameLoop:", error);
        }
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
    
    // Método para conectar ao servidor multijogador
    connectToMultiplayerServer(serverUrl, authToken = null) {
        if (!this.multiplayerReady) {
            console.warn("Game: Sistema multiplayer ainda não está pronto. Use startMultiplayerMode() primeiro.");
            return Promise.reject("Sistema multiplayer ainda não está pronto");
        }
        
        if (this.isMultiplayer && this.networkManager?.connected) {
            console.warn("Game: Já está conectado a um servidor multiplayer");
            return Promise.reject("Já conectado");
        }
        
        console.log(`Game: Conectando ao servidor multiplayer ${serverUrl}`);
        
        return this.networkManager.connect(serverUrl, authToken)
            .then(() => {
                this.isMultiplayer = true;
                this.uiManager.showMessage("Conectado ao servidor multiplayer", 3000, "success");
                console.log("Game: Conectado com sucesso ao servidor multiplayer");
                
                // Configura callbacks para eventos de rede
                this._setupNetworkCallbacks();
                
                return true;
            })
            .catch(error => {
                console.error("Game: Falha ao conectar ao servidor multiplayer", error);
                this.uiManager.showMessage("Falha ao conectar: " + error, 5000, "error");
                return Promise.reject(error);
            });
    }
    
    // Inicializa o modo multiplayer
    startMultiplayerMode() {
        if (!this.player || !this.gameState) {
            console.warn("Game: Jogador ou estado do jogo não estão inicializados");
            return false;
        }
        
        console.log("Game: Inicializando modo multiplayer");
        
        // Cria o gerenciador de rede
        this.networkManager = new NetworkManager(this.gameState, this.player);
        
        // Adiciona referência à cena no player para remover projéteis
        this.player.scene = this.sceneManager.scene;
        
        // Configura o temporizador de atualização da rede
        this.networkUpdateTimer = 0;
        
        // Flag para indicar que o multiplayer está pronto
        this.multiplayerReady = true;
        
        console.log("Game: Modo multiplayer inicializado e pronto para conexão");
        return true;
    }
    
    // Desconecta do servidor multiplayer
    disconnectFromMultiplayerServer() {
        if (!this.isMultiplayer || !this.networkManager) {
            console.warn("Game: Não está conectado a um servidor multiplayer");
            return;
        }
        
        console.log("Game: Desconectando do servidor multiplayer");
        
        // Desconecta o gerenciador de rede
        this.networkManager.disconnect();
        
        // Remove todos os jogadores remotos
        this._removeAllRemotePlayers();
        
        // Reseta flags
        this.isMultiplayer = false;
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
        if (this.remotePlayers.has(id)) {
            console.warn(`Game: Jogador remoto [${id}] já existe`);
            return;
        }
        
        // Cria um novo jogador remoto
        const remotePlayer = new RemotePlayer(
            id, 
            playerData, 
            this.sceneManager.scene
        );
        
        // Adiciona ao mapa de jogadores remotos
        this.remotePlayers.set(id, remotePlayer);
        
        console.log(`Game: Jogador remoto [${id}] criado`);
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
        this.remotePlayers.forEach((player, id) => {
            player.remove();
        });
        
        this.remotePlayers.clear();
        console.log("Game: Todos os jogadores remotos foram removidos");
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