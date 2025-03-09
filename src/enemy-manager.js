/**
 * Gerenciador de inimigos responsável por criar, atualizar e gerenciar todos os inimigos
 * Controla o sistema de ondas, spawning e comportamento da IA inimiga
 */
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.157.0/build/three.module.js';
import { ENEMY, WAVE } from './config.js';
import { Enemy } from './enemy.js';

export class EnemyManager {
    /**
     * @param {THREE.Scene} scene - Cena onde os inimigos serão adicionados
     * @param {Object} player - Referência ao jogador para tracking e comportamento de IA
     * @param {Object} gameState - Referência ao estado do jogo para controle de ondas e pontuação
     */
    constructor(scene, player, gameState) {
        // Referências externas
        this.scene = scene;
        this.player = player;
        this.gameState = gameState;
        
        // Lista de inimigos ativos
        this.enemies = [];
        
        // Configurações de spawn
        this.spawnDelay = 0;
        this.maxEnemies = 10;
        
        // Array para armazenar os timers de spawn
        this.spawnTimers = [];
        
        // Controle de ondas
        this.currentWave = 0;
        this.enemiesRemaining = 0;
        this.spawnTimer = 0;
        this.waveTimer = 0;
        this.isWaveActive = false;
        this.isBossWave = false;
        
        // Locais para spawn de inimigos (distantes do jogador)
        this.spawnPoints = [
            new THREE.Vector3(30, 0, 30),
            new THREE.Vector3(-30, 0, 30),
            new THREE.Vector3(30, 0, -30),
            new THREE.Vector3(-30, 0, -30),
            new THREE.Vector3(0, 0, 40),
            new THREE.Vector3(40, 0, 0),
            new THREE.Vector3(0, 0, -40),
            new THREE.Vector3(-40, 0, 0)
        ];
        
        console.log("EnemyManager inicializado");
    }
    
    /**
     * Atualiza todos os inimigos e gerencia ondas
     * @param {number} deltaTime - Tempo desde o último frame em segundos
     */
    update(deltaTime) {
        // Não atualiza se o jogo não estiver ativo
        if (this.gameState.state !== 'playing') return;
        
        // Atualiza cada inimigo
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const enemy = this.enemies[i];
            enemy.update(deltaTime, this.player);
            
            // Remove inimigos mortos
            if (enemy.health <= 0 && enemy.state === 'dead' && enemy.deathTimer <= 0) {
                this.scene.remove(enemy.mesh);
                this.enemies.splice(i, 1);
                
                // Adiciona pontos na morte
                if (enemy.type === 'basic') {
                    this.gameState.addScore(ENEMY.SCORE.BASIC);
                } else if (enemy.type === 'medium') {
                    this.gameState.addScore(ENEMY.SCORE.MEDIUM);
                } else if (enemy.type === 'heavy') {
                    this.gameState.addScore(ENEMY.SCORE.HEAVY);
                }
                
                // Conta a eliminação
                this.gameState.addKill(enemy.type);
                this.enemiesRemaining--;
            }
        }
        
        // Gerencia o spawning de inimigos durante uma onda ativa
        if (this.isWaveActive) {
            // Atualiza o timer de spawn
            if (this.spawnTimer > 0) {
                this.spawnTimer -= deltaTime;
            }
            
            // Se é hora de spawnar e ainda tem inimigos para serem criados
            if (this.spawnTimer <= 0 && this.enemiesRemaining > 0 && this.enemies.length < WAVE.MAX_ACTIVE_ENEMIES) {
                this.spawnEnemy();
                this.spawnTimer = WAVE.SPAWN_DELAY;
            }
            
            // Verifica se a onda terminou (todos inimigos mortos)
            if (this.enemiesRemaining <= 0 && this.enemies.length === 0) {
                this.completeWave();
            }
        } else {
            // Entre ondas, atualiza o timer para a próxima onda
            if (this.waveTimer > 0) {
                this.waveTimer -= deltaTime;
                
                // Inicia a próxima onda quando o timer terminar
                if (this.waveTimer <= 0) {
                    this.startNextWave();
                }
            }
        }
        
        // Verifica colisões dos projéteis dos inimigos com o jogador
        this.checkEnemyBulletCollisions();
    }
    
    /**
     * Verifica colisões dos projéteis dos inimigos com o jogador
     */
    checkEnemyBulletCollisions() {
        let hitCount = 0;
        
        // Limite de verificações por frame para melhorar desempenho
        const maxCheckPerFrame = 10;
        let checksThisFrame = 0;

        for (const enemy of this.enemies) {
            if (!enemy.bullets || enemy.bullets.length === 0) continue;
            
            // Apenas verifica um número limitado de inimigos por frame
            if (checksThisFrame >= maxCheckPerFrame) break;
            checksThisFrame++;
            
            for (let i = enemy.bullets.length - 1; i >= 0; i--) {
                const bullet = enemy.bullets[i];
                
                // Verifica se o projétil está próximo o suficiente para verificar colisão detalhada
                const distanceToPlayer = bullet.position.distanceTo(this.player.position);
                
                // Se está próximo e não colidiu, verifica colisão mais precisa
                if (distanceToPlayer < 2.0 && !bullet.hasCollided) {
                    // Verifica se o projétil colide com o jogador
                    if (bullet.checkCollision(this.player)) {
                        // Causa dano ao jogador
                        const damageAmount = bullet.damage;
                        this.player.takeDamage(damageAmount);
                        
                        hitCount++;
                        
                        // Mostra efeito visual de dano
                        if (this.player.showDamageEffect) {
                            this.player.showDamageEffect();
                        }
                        
                        // Remove o projétil
                        if (bullet.addedToScene && this.scene) {
                            this.scene.remove(bullet.mesh);
                        }
                        enemy.bullets.splice(i, 1);
                    }
                } 
                // Se o projétil está muito longe ou já colidiu, remove-o também
                else if (bullet.distance > bullet.maxDistance || bullet.hasCollided) {
                    if (bullet.addedToScene && this.scene) {
                        this.scene.remove(bullet.mesh);
                    }
                    enemy.bullets.splice(i, 1);
                }
            }
        }
        
        return hitCount;
    }
    
    /**
     * Inicia a próxima onda com mais inimigos
     */
    startNextWave() {
        // Incrementa o número da onda
        const currentWave = this.gameState.currentWave;
        
        // Define o número de inimigos com base na onda atual
        // Onda 1: 3 inimigos
        // Onda 2: 5 inimigos
        // Onda 3+: 5 + (currentWave - 2) * 2 inimigos
        let numEnemies = currentWave === 1 ? 3 : 
                        currentWave === 2 ? 5 : 
                        5 + (currentWave - 2) * 2;
        
        // Limita o número máximo de inimigos por onda
        numEnemies = Math.min(numEnemies, 15);
        
        console.log(`Iniciando onda ${currentWave} com ${numEnemies} inimigos.`);
        
        // Atualiza o estado do jogo
        this.gameState.startNewWave(numEnemies);
        
        // Cria os inimigos para esta onda
        this.scheduleEnemySpawns(numEnemies);
    }
    
    /**
     * Agenda o spawn dos inimigos ao longo da onda
     * @param {number} numEnemies - Número de inimigos a serem criados
     */
    scheduleEnemySpawns(numEnemies) {
        // Remove todos os timers de spawn anteriores
        this.spawnTimers.forEach(clearTimeout);
        this.spawnTimers = [];
        
        // Agenda o spawn de cada inimigo com intervalos
        for (let i = 0; i < numEnemies; i++) {
            const delay = i * 2000; // 2 segundos entre cada spawn
            
            const timer = setTimeout(() => {
                this.spawnEnemy();
            }, delay);
            
            this.spawnTimers.push(timer);
        }
    }
    
    /**
     * Cria o chefe (boss) para a missão final
     * @param {THREE.Vector3} position - Posição onde o chefe será criado
     */
    spawnBoss(position) {
        // Verifica se já existe um chefe
        if (this.enemies.some(e => e.type === 'boss')) {
            console.log("Já existe um chefe no jogo!");
            return;
        }
        
        // Posição padrão se não for especificada
        const bossPosition = position || new THREE.Vector3(0, 0, -20);
        
        // Cria o chefe com mais saúde e dano
        const boss = new Enemy(bossPosition, 'boss');
        boss.health = 500;
        boss.maxHealth = 500;
        boss.damage = 30;
        boss.speed = 2;
        boss.detectionRange = 50;
        boss.attackRange = 30;
        
        // Adiciona o chefe à cena
        boss.setScene(this.scene);
        this.enemies.push(boss);
        
        // Mensagem ao jogador
        if (window.game && window.game.uiManager) {
            window.game.uiManager.showMessage(
                "ALERTA: Comandante inimigo detectado!",
                5000,
                'warning'
            );
        }
        
        console.log("Chefe criado na posição:", bossPosition);
        return boss;
    }
    
    /**
     * Finaliza a onda atual e prepara a próxima
     */
    completeWave() {
        this.isWaveActive = false;
        this.waveTimer = WAVE.WAVE_DELAY;
        
        console.log(`Onda ${this.currentWave} concluída. Próxima onda em ${WAVE.WAVE_DELAY} segundos.`);
    }
    
    /**
     * Cria e adiciona um inimigo à cena
     */
    spawnEnemy() {
        // Limita o número de inimigos para melhorar desempenho
        if (this.enemies.length >= 10) {
            return null;
        }
        
        // Seleciona um ponto de spawn aleatório
        const spawnPoint = this.getRandomSpawnPoint();
        
        // Decide o tipo de inimigo baseado na onda atual
        let enemyType = 'basic'; // Padrão: sentinelas (basic)
        const currentWave = this.gameState.currentWave;
        
        // Na primeira onda (missão inicial), todos os inimigos devem ser sentinelas (basic)
        if (currentWave === 1) {
            enemyType = 'basic'; // Forçar sentinelas na primeira onda
            console.log("Criando uma sentinela (inimigo básico)");
        } else if (this.isBossWave) {
            // Em ondas de chefe, todos são heavy com um único chefe
            enemyType = 'heavy';
        } else {
            // Distribui tipos diferentes com base na onda
            const rand = Math.random();
            
            if (currentWave >= 5) {
                // Maior probabilidade de inimigos médios e pesados em ondas avançadas
                if (rand < 0.3) {
                    enemyType = 'heavy';
                } else if (rand < 0.7) {
                    enemyType = 'medium';
                }
            } else if (currentWave >= 3) {
                // Introduz inimigos médios nas ondas seguintes
                if (rand < 0.5) {
                    enemyType = 'medium';
                }
            } else if (currentWave >= 2) {
                // Poucos inimigos médios na onda 2
                if (rand < 0.25) {
                    enemyType = 'medium';
                }
            }
        }
        
        try {
            // Cria o inimigo
            const enemy = new Enemy(spawnPoint, enemyType);
            
            // Define a referência da cena para o inimigo
            if (this.scene) {
                enemy.setScene(this.scene);
            }
            
            // Adiciona à cena e à lista
            this.scene.add(enemy.mesh);
            this.enemies.push(enemy);
            
            console.log(`Inimigo do tipo '${enemyType}' criado na posição:`, spawnPoint);
            
            // Atualiza o contador
            this.enemiesRemaining--;
            
            return enemy;
        } catch (error) {
            console.error("Erro ao criar inimigo:", error);
            return null;
        }
    }
    
    /**
     * Seleciona um ponto de spawn aleatório longe do jogador
     * @returns {THREE.Vector3} - Posição para o spawn
     */
    getRandomSpawnPoint() {
        // Filtra pontos que estão a pelo menos 20 unidades do jogador
        const validPoints = this.spawnPoints.filter(point => {
            const distance = point.distanceTo(this.player.position);
            return distance > 20;
        });
        
        // Se não houver pontos válidos, usa qualquer um
        const points = validPoints.length > 0 ? validPoints : this.spawnPoints;
        
        // Seleciona um ponto aleatório
        const point = points[Math.floor(Math.random() * points.length)].clone();
        
        // Adiciona uma pequena variação para evitar que inimigos spawnem exatamente no mesmo lugar
        point.x += (Math.random() - 0.5) * 5;
        point.z += (Math.random() - 0.5) * 5;
        
        return point;
    }
    
    /**
     * Reinicia o gerenciador de inimigos para um novo jogo
     */
    reset() {
        console.log("Reiniciando gerenciador de inimigos");
        
        // Remove todos os inimigos da cena
        this.enemies.forEach(enemy => {
            if (enemy.mesh && enemy.mesh.parent) {
                this.scene.remove(enemy.mesh);
            }
        });
        
        // Limpa a lista de inimigos
        this.enemies = [];
        
        // Remove todos os timers de spawn
        this.spawnTimers.forEach(clearTimeout);
        this.spawnTimers = [];
    }
    
    /**
     * Verifica colisões de projéteis com inimigos
     * @param {Array} projectiles - Lista de projéteis para verificar
     * @returns {Array} - Lista de inimigos que foram atingidos
     */
    checkProjectileCollisions(projectiles) {
        if (!projectiles || projectiles.length === 0) return [];
        
        // Lista de inimigos atingidos para retornar
        const hitEnemies = [];
        
        // Para cada projétil, verifica colisão com cada inimigo
        for (let i = projectiles.length - 1; i >= 0; i--) {
            const projectile = projectiles[i];
            
            // Pula projéteis que já colidiram
            if (projectile.hasCollided) continue;
            
            // Verifica colisão com cada inimigo
            for (let j = 0; j < this.enemies.length; j++) {
                const enemy = this.enemies[j];
                
                // Pula inimigos mortos
                if (enemy.health <= 0) continue;
                
                if (projectile.checkCollision(enemy)) {
                    // Causa dano ao inimigo
                    const wasFatal = enemy.takeDamage(projectile.damage);
                    
                    // Marca o projétil como colidido
                    projectile.hasCollided = true;
                    
                    // Adiciona pontos ao jogador
                    this.gameState.addScore(10);
                    
                    // Adiciona o inimigo à lista de atingidos
                    hitEnemies.push(enemy);
                    
                    // Se o inimigo morreu, adiciona pontos adicionais e registra o abate
                    if (wasFatal) {
                        // Pontuação baseada no tipo de inimigo
                        const killScore = enemy.type === 'heavy' ? 100 : 
                                         enemy.type === 'medium' ? 50 : 20;
                        
                        this.gameState.addScore(killScore);
                        this.gameState.addKill(enemy.type);
                    }
                    
                    break; // Um projétil só pode atingir um inimigo
                }
            }
        }
        
        return hitEnemies;
    }
    
    /**
     * Verifica colisões entre inimigos e o jogador
     * @returns {Array} - Inimigos que estão colidindo com o jogador
     */
    checkPlayerCollisions() {
        const collisions = [];
        
        this.enemies.forEach(enemy => {
            // Pula inimigos mortos
            if (enemy.state === 'dead') return;
            
            // Verifica colisão com o jogador
            if (enemy.checkCollision(this.player)) {
                collisions.push(enemy);
            }
        });
        
        return collisions;
    }
} 