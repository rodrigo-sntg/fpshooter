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
        
        console.log("Jogo inicializado com sucesso!");
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
     * Inicia o jogo a partir da tela de menu
     */
    startGame() {
        console.log("Iniciando jogo...");
        
        // Muda o estado do jogo para jogando
        this.gameState.setState('playing');
        
        // Reset do jogador, ondas e outros sistemas
        this.player.reset();
        this.enemyManager.reset();
        this.gameState.resetScore();
        
        // Inicializa a primeira onda
        this.enemyManager.startNextWave();
        
        // Carrega a primeira fase com suas missões
        this.missionManager.loadMissions(1);
        
        // Mostra tutorial básico de controles
        setTimeout(() => {
            if (this.uiManager) {
                this.uiManager.showTutorial('default');
            }
        }, 2000);
        
        // Esconde o cursor do mouse e bloqueia-o para controle de câmera
        try {
            document.body.requestPointerLock();
        } catch (error) {
            console.error("Erro ao bloquear o ponteiro:", error);
        }
        
        // Inicia o loop do jogo se ainda não estiver rodando
        if (!this.isRunning) {
            console.log("Iniciando loop do jogo");
            this.isRunning = true;
            this.lastTime = performance.now();
            requestAnimationFrame(this.gameLoop.bind(this));
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
     * Retoma o jogo da tela de pausa
     */
    resumeGame() {
        if (this.gameState.state === 'paused') {
            console.log("Retomando jogo");
            this.gameState.setState('playing');
            document.body.requestPointerLock();
        }
    }
    
    /**
     * Reinicia o jogo (após game over ou da tela de pausa)
     */
    restartGame() {
        console.log("Reiniciando jogo");
        // Similar ao startGame, mas pode ter lógica adicional para reinício
        this.gameState.setState('playing');
        this.player.reset();
        this.enemyManager.reset();
        this.gameState.resetScore();
        this.enemyManager.startNextWave();
        document.body.requestPointerLock();
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
     */
    gameLoop(currentTime) {
        // Calcula o delta time (tempo entre frames)
        const deltaTime = Math.min((currentTime - this.lastTime) / 1000, 0.1); // Limitado a 0.1s para evitar saltos grandes
        this.lastTime = currentTime;
        
        // Apenas atualiza se o jogo estiver rodando
        if (this.gameState.state === 'playing') {
            try {
                // Atualiza os gerenciadores e sistemas
                this.inputManager.update();
                this.player.update(deltaTime);
                
                // Gerencia os projéteis do jogador
                this.updatePlayerBullets();
                
                // Atualiza os inimigos (que por sua vez atualiza seus projéteis)
                this.enemyManager.update(deltaTime);
                
                // Atualiza a cena (animações, etc.)
                this.sceneManager.update(deltaTime);
                
                // Atualiza o gerenciador de missões
                this.missionManager.update(deltaTime);
                
                // Verifica colisões a cada X frames para melhorar desempenho
                if (!this.frameCount) this.frameCount = 0;
                this.frameCount++;
                
                if (this.frameCount % 2 === 0) { // Verifica colisões apenas a cada 2 frames
                    this.checkCollisions();
                }
                
                // Verifica condição de game over
                if (this.player.health <= 0) {
                    this.gameOver();
                }
                
                // Atualiza a UI a cada 2 frames para melhorar desempenho
                if (this.frameCount % 2 === 0) {
                    this.uiManager.update();
                }
            } catch (error) {
                console.error("Erro no gameLoop:", error);
            }
        }
        
        // Sempre renderiza a cena, mesmo em estados não-jogando
        try {
            this.sceneManager.render();
        } catch (error) {
            console.error("Erro ao renderizar:", error);
        }
        
        // Continua o loop de jogo
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