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
        const maxCheckPerFrame = 5;
        let checksThisFrame = 0;
        
        // Verifica apenas um subconjunto de inimigos a cada frame
        const startIndex = this.lastEnemyChecked || 0;
        let currentIndex = startIndex;
        
        // Percorre os inimigos a partir do último verificado
        for (let i = 0; i < this.enemies.length; i++) {
            currentIndex = (startIndex + i) % this.enemies.length;
            const enemy = this.enemies[currentIndex];
            
            if (!enemy.bullets || enemy.bullets.length === 0) continue;
            
            // Apenas verifica um número limitado de inimigos por frame
            if (checksThisFrame >= maxCheckPerFrame) break;
            checksThisFrame++;
            
            // Otimização: verifica no máximo 5 projéteis por inimigo
            const maxBulletsToCheck = Math.min(enemy.bullets.length, 5);
            for (let j = 0; j < maxBulletsToCheck; j++) {
                const index = enemy.bullets.length - 1 - j;
                if (index < 0) break;
                
                const bullet = enemy.bullets[index];
                
                // Otimização: se o jogador está muito longe, nem verifica esse inimigo
                const distanceToPlayer = bullet.position.distanceTo(this.player.position);
                
                // Se está próximo e não colidiu, verifica colisão mais precisa
                if (distanceToPlayer < 2.5 && !bullet.hasCollided) {
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
                        enemy.bullets.splice(index, 1);
                    }
                } 
                // Se o projétil está muito longe ou já colidiu, remove-o também
                else if (bullet.distance > bullet.maxDistance || bullet.hasCollided || distanceToPlayer > 50) {
                    if (bullet.addedToScene && this.scene) {
                        this.scene.remove(bullet.mesh);
                    }
                    enemy.bullets.splice(index, 1);
                }
            }
        }
        
        // Atualiza o índice do último inimigo verificado
        this.lastEnemyChecked = (currentIndex + 1) % this.enemies.length;
        
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
     * Cria um novo inimigo
     * @param {string} type - Tipo de inimigo ('basic', 'medium', 'heavy', 'boss')
     * @param {THREE.Vector3} position - Posição onde o inimigo será criado
     * @returns {Enemy} - O inimigo criado ou null se não criado
     */
    spawnEnemy(type = 'basic', position = null) {
        // Limita o número total de inimigos para melhorar desempenho
        if (this.enemies.length >= 10) {
            console.log("Limite de inimigos atingido, não spawnou novo inimigo");
            return null;
        }
        
        // Escolhe o tipo de inimigo baseado na onda atual, se não especificado
        if (!type || type === 'random') {
            // Mais variação de tipos em ondas mais altas
            const wave = this.gameState ? this.gameState.wave : 1;
            
            if (wave <= 1) {
                // Onda 1: apenas básicos
                type = 'basic';
            } else if (wave <= 3) {
                // Onda 2-3: básicos e alguns médios
                const rand = Math.random();
                type = rand < 0.7 ? 'basic' : 'medium';
            } else if (wave <= 5) {
                // Onda 4-5: básicos, médios e alguns pesados
                const rand = Math.random();
                if (rand < 0.5) type = 'basic';
                else if (rand < 0.8) type = 'medium';
                else type = 'heavy';
            } else {
                // Onda 6+: mistura de todos os tipos
                const rand = Math.random();
                if (rand < 0.3) type = 'basic';
                else if (rand < 0.6) type = 'medium';
                else type = 'heavy';
            }
        }
        
        // Escolhe uma posição aleatória se não for fornecida
        let enemyPosition;
        if (position) {
            enemyPosition = position.clone();
        } else {
            // Determina uma posição afastada do jogador
            const minDistance = 20;
            const maxDistance = 40;
            const maxAttempts = 5;
            
            let validPosition = false;
            let attempts = 0;
            
            while (!validPosition && attempts < maxAttempts) {
                // Ângulo aleatório
                const angle = Math.random() * Math.PI * 2;
                
                // Distância entre mínima e máxima
                const distance = minDistance + Math.random() * (maxDistance - minDistance);
                
                // Cálculo de posição
                enemyPosition = new THREE.Vector3(
                    this.player.position.x + Math.cos(angle) * distance,
                    0,
                    this.player.position.z + Math.sin(angle) * distance
                );
                
                // Verifica se a posição está longe o suficiente de outros inimigos
                validPosition = true;
                for (const enemy of this.enemies) {
                    if (enemy.position.distanceTo(enemyPosition) < 5) {
                        validPosition = false;
                        break;
                    }
                }
                
                attempts++;
            }
            
            // Se não foi possível encontrar uma posição válida, usa a última tentativa
            if (!validPosition) {
                console.log("Não foi possível encontrar posição ideal, usando última posição tentada");
            }
        }
        
        // Cria o inimigo com uma altura de 0.5 unidades acima do chão
        enemyPosition.y = 0.5;
        const enemy = new Enemy(enemyPosition, type);
        
        // Configura o inimigo de acordo com seu tipo e onda atual
        const wave = this.gameState ? this.gameState.wave : 1;
        const waveMultiplier = 1 + (wave - 1) * 0.1; // +10% de stats por onda
        
        // Aumenta as estatísticas do inimigo de acordo com a onda
        enemy.health *= waveMultiplier;
        enemy.maxHealth = enemy.health;
        enemy.damage *= waveMultiplier;
        
        // Adiciona o inimigo à cena
        enemy.setScene(this.scene);
        this.enemies.push(enemy);
        
        return enemy;
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
                if (enemy.health <= 0 || enemy.state === 'dead') continue;
                
                // Verifica a distância entre o projétil e o inimigo (verificação rápida)
                const distance = projectile.position.distanceTo(enemy.position);
                
                // Distância para considerar uma colisão
                const collisionDistance = enemy.type === 'basic' ? 5.0 : 4.0;
                
                // Se estiver próximo, faz uma verificação mais precisa
                if (distance < collisionDistance) {
                    console.log(`Projétil próximo a ${enemy.type}. Distância: ${distance.toFixed(2)}`);
                    
                    // Verifica colisão detalhada
                    if (projectile.checkCollision(enemy)) {
                        console.log(`Colisão confirmada com ${enemy.type}! Dano: ${projectile.damage}`);
                        
                        // Causa dano ao inimigo
                        const wasFatal = enemy.takeDamage(projectile.damage);
                        if (wasFatal) {
                            console.log(`Inimigo ${enemy.type} foi eliminado!`);
                        }
                        
                        // Adiciona à lista de inimigos atingidos
                        hitEnemies.push(enemy);
                        
                        // Não precisa verificar mais inimigos para este projétil
                        break;
                    }
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
    
    /**
     * Cria e adiciona uma sentinela (inimigo básico) à cena na posição específica
     * @param {THREE.Vector3} position - Posição onde o inimigo será criado
     * @returns {Enemy} - O inimigo criado ou null em caso de erro
     */
    spawnBasic(position) {
        try {
            console.log("Forçando spawn de sentinela na posição:", position);
            
            // Cria o inimigo do tipo basic (sentinela)
            const enemy = new Enemy(position, 'basic');
            
            // Define a referência da cena para o inimigo
            if (this.scene) {
                enemy.setScene(this.scene);
            }
            
            // Adiciona à cena e à lista
            this.scene.add(enemy.mesh);
            this.enemies.push(enemy);
            
            console.log("Sentinela criada com sucesso!");
            return enemy;
        } catch (error) {
            console.error("Erro ao criar sentinela:", error);
            return null;
        }
    }
    
    /**
     * Atualiza apenas uma porção dos inimigos para distribuir o processamento
     * @param {number} deltaTime - Tempo desde o último frame em segundos
     * @param {number} startPct - Percentual inicial de inimigos para atualizar (0-1)
     * @param {number} endPct - Percentual final de inimigos para atualizar (0-1)
     */
    updatePartial(deltaTime, startPct = 0, endPct = 1) {
        // Verifica condições de segurança
        if (!this.enemies || this.enemies.length === 0) {
            return;
        }
        
        // Segurança: não tenta atualizar se o player não está disponível
        if (!this.player) {
            console.warn("EnemyManager: Tentativa de atualizar inimigos sem referência ao player");
            return;
        }
        
        const totalEnemies = this.enemies.length;
        
        // Garante que os índices estão dentro dos limites válidos
        let startIdx = Math.floor(startPct * totalEnemies);
        let endIdx = Math.floor(endPct * totalEnemies);
        
        // Segurança: validação de limites
        startIdx = Math.max(0, Math.min(startIdx, totalEnemies - 1));
        endIdx = Math.max(startIdx + 1, Math.min(endIdx, totalEnemies));
        
        // Atualiza apenas a porção especificada dos inimigos
        for (let i = startIdx; i < endIdx; i++) {
            const enemy = this.enemies[i];
            if (enemy) {
                try {
                    // Passa o player como segundo parâmetro
                    enemy.update(deltaTime, this.player);
                } catch (error) {
                    console.error(`Erro ao atualizar inimigo ${i}:`, error);
                }
            }
        }
        
        // Verifica colisões apenas a cada X frames para otimizar
        if (this.frameCounter === undefined) this.frameCounter = 0;
        this.frameCounter++;
        
        if (this.frameCounter % 3 === 0) {
            this.checkEnemyBulletCollisions();
        }
    }
} 