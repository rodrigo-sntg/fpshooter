/**
 * Classe responsável por gerenciar o estado global do jogo
 * Controla transições entre menus, pontuação, progresso das ondas e outros dados globais
 */
export class GameState {
    constructor() {
        // Estado atual do jogo (menu, playing, paused, gameover)
        this.state = 'menu';
        
        // Pontuação e estatísticas
        this.score = 0;
        this.highScore = this.loadHighScore();
        this.kills = 0;
        
        // Controle de ondas
        this.currentWave = 0;
        this.enemiesRemaining = 0;
        this.enemiesSpawned = 0;
        this.totalEnemiesInWave = 0;
        
        // Flags de status
        this.isPaused = false;
        this.isGameOver = false;
        
        // Referências a elementos da UI
        this.uiElements = {
            scoreValue: document.getElementById('score-value'),
            waveValue: document.getElementById('wave-value'),
            healthValue: document.getElementById('health-value'),
            ammoCount: document.getElementById('ammo-count'),
            finalScoreValue: document.getElementById('final-score-value')
        };
        
        // Elementos de tela
        this.screens = {
            startScreen: document.getElementById('start-screen'),
            pauseScreen: document.getElementById('pause-screen'),
            gameoverScreen: document.getElementById('gameover-screen')
        };
    }
    
    /**
     * Muda o estado do jogo e atualiza a interface
     * @param {string} newState - Novo estado ('menu', 'playing', 'paused', 'gameover')
     */
    setState(newState) {
        // Verifica que o estado é válido
        if (!['menu', 'playing', 'paused', 'gameover'].includes(newState)) {
            console.error(`Estado inválido: ${newState}`);
            return;
        }
        
        // Atualiza o estado atual
        this.state = newState;
        
        // Atualiza flags de estado
        this.isPaused = (newState === 'paused');
        this.isGameOver = (newState === 'gameover');
        
        // Esconde todas as telas primeiro
        this.hideAllScreens();
        
        // Mostra a tela apropriada
        switch (newState) {
            case 'menu':
                this.screens.startScreen.classList.add('active');
                break;
            case 'paused':
                this.screens.pauseScreen.classList.add('active');
                break;
            case 'gameover':
                this.updateHighScore();
                this.screens.gameoverScreen.classList.add('active');
                this.uiElements.finalScoreValue.textContent = this.score;
                break;
            case 'playing':
                // No estado de jogo, nenhuma tela de menu é exibida
                this.hideAllScreens();
                break;
        }
        
        // Evento de mudança de estado (pode ser usado para gatilhos de áudio, etc.)
        this.onStateChanged(newState);
    }
    
    /**
     * Oculta todas as telas de menu/UI
     */
    hideAllScreens() {
        Object.values(this.screens).forEach(screen => {
            screen.classList.remove('active');
        });
    }
    
    /**
     * Callback quando o estado do jogo muda
     * @param {string} newState - O novo estado
     */
    onStateChanged(newState) {
        console.log(`Estado do jogo alterado para: ${newState}`);
        // Pode ser expandido com ações adicionais conforme necessário
    }
    
    /**
     * Incrementa a pontuação do jogador
     * @param {number} points - Pontos a adicionar
     */
    addScore(points) {
        this.score += points;
        
        // Atualiza o elemento de pontuação na UI, se existir
        if (this.uiElements.scoreValue) {
            this.uiElements.scoreValue.textContent = this.score;
        }
        
        // Atualize high score se necessário
        if (this.score > this.highScore) {
            this.highScore = this.score;
            this.saveHighScore();
        }
    }
    
    /**
     * Contabiliza uma eliminação de inimigo
     * @param {string} enemyType - Tipo do inimigo eliminado
     */
    addKill(enemyType) {
        this.kills++;
        this.enemiesRemaining--;
        
        // Verifica se a onda foi concluída
        if (this.enemiesRemaining <= 0 && this.enemiesSpawned >= this.totalEnemiesInWave) {
            this.onWaveCompleted();
        }
    }
    
    /**
     * Inicia uma nova onda de inimigos
     * @param {number} numEnemies - Número de inimigos na onda
     */
    startNewWave(numEnemies) {
        this.currentWave++;
        this.enemiesRemaining = numEnemies;
        this.enemiesSpawned = 0;
        this.totalEnemiesInWave = numEnemies;
        
        // Atualiza a UI
        if (this.uiElements.waveValue) {
            this.uiElements.waveValue.textContent = this.currentWave;
        }
        
        // Evento de início de onda
        this.onWaveStarted();
    }
    
    /**
     * Callback quando uma onda é iniciada
     */
    onWaveStarted() {
        console.log(`Onda ${this.currentWave} iniciada com ${this.totalEnemiesInWave} inimigos`);
        // Pode disparar efeitos visuais, sons, etc.
    }
    
    /**
     * Callback quando uma onda é concluída
     */
    onWaveCompleted() {
        console.log(`Onda ${this.currentWave} concluída!`);
        // Pode disparar eventos de fim de onda, como pontos de bônus ou power-ups
    }
    
    /**
     * Reinicia a pontuação e progresso
     */
    resetScore() {
        this.score = 0;
        this.kills = 0;
        this.currentWave = 0;
        
        // Atualiza a UI
        if (this.uiElements.scoreValue) {
            this.uiElements.scoreValue.textContent = '0';
        }
        if (this.uiElements.waveValue) {
            this.uiElements.waveValue.textContent = '1';
        }
    }
    
    /**
     * Carrega a pontuação máxima do armazenamento local
     * @returns {number} - Pontuação máxima
     */
    loadHighScore() {
        const savedHighScore = localStorage.getItem('starstrike_high_score');
        return savedHighScore ? parseInt(savedHighScore, 10) : 0;
    }
    
    /**
     * Salva a pontuação máxima no armazenamento local
     */
    saveHighScore() {
        localStorage.setItem('starstrike_high_score', this.highScore.toString());
    }
    
    /**
     * Atualiza a pontuação máxima se necessário
     */
    updateHighScore() {
        if (this.score > this.highScore) {
            this.highScore = this.score;
            this.saveHighScore();
        }
    }
} 