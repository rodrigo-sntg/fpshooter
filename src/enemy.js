/**
 * Classe que representa um inimigo no jogo
 * Implementa o comportamento e IA dos inimigos usando uma máquina de estados finitos
 */
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.157.0/build/three.module.js';
import { ENEMY } from './config.js';
import { Bullet } from './bullet.js';

export class Enemy {
    /**
     * Cria um novo inimigo
     * @param {THREE.Vector3} position - Posição inicial do inimigo
     * @param {string} type - Tipo do inimigo ('basic', 'medium', 'heavy')
     */
    constructor(position, type = 'basic') {
        // Tipo de inimigo (basic, medium, heavy, boss)
        this.type = type;
        
        // Identificação para debug e logs
        this.id = Math.floor(Math.random() * 1000000);
        
        // Flag para sentinelas - para facilitar verificações
        this.isSentinel = (type === 'basic');
        
        // Propriedades de movimento
        this.position = position.clone();
        this.speed = ENEMY.SPEED[type.toUpperCase()] || ENEMY.SPEED.BASIC;
        
        // Atributos de combate
        this.health = ENEMY.HEALTH[type.toUpperCase()] || ENEMY.HEALTH.BASIC;
        this.maxHealth = this.health;
        this.damage = ENEMY.DAMAGE[type.toUpperCase()] || ENEMY.DAMAGE.BASIC;
        this.attackRange = ENEMY.ATTACK_RANGE[type.toUpperCase()] || ENEMY.ATTACK_RANGE.BASIC;
        this.attackCooldown = ENEMY.ATTACK_COOLDOWN[type.toUpperCase()] || ENEMY.ATTACK_COOLDOWN.BASIC;
        this.attackTimer = 0;
        
        // Raio de detecção do jogador
        this.detectionRange = ENEMY.DETECTION_RADIUS[type.toUpperCase()] || ENEMY.DETECTION_RADIUS.BASIC;
        
        // Projéteis disparados pelo inimigo
        this.bullets = [];
        
        // Estado do inimigo (idle, chasing, attacking, dead)
        this.state = 'idle';
        
        // Referência para a cena (será definida pelo EnemyManager)
        this.scene = null;
        
        // Cria a representação visual do inimigo
        this.mesh = this.createMesh();
        
        // Informações de debug
        if (this.isSentinel) {
            console.log("Sentinela criado:", {
                type: this.type,
                position: this.position,
                health: this.health
            });
        }
        
        // Contadores e timers
        this.stateTimer = 0;
        this.deathTimer = 2; // Tempo para remover o inimigo após a morte
        
        // Direção e movimento
        this.direction = new THREE.Vector3(0, 0, 0);
        this.velocity = new THREE.Vector3(0, 0, 0);
        this.targetPosition = new THREE.Vector3(0, 0, 0);
        
        // Bounding box para colisão
        this.boundingBox = new THREE.Box3().setFromObject(this.mesh);
    }
    
    /**
     * Cria a geometria 3D do inimigo baseado no tipo
     */
    createMesh() {
        let geometry, material;
        
        switch(this.type) {
            case 'medium':
                // Inimigo médio: cubo vermelho
                geometry = new THREE.BoxGeometry(1.2, 1.2, 1.2);
                material = new THREE.MeshPhongMaterial({ color: 0xaa3333 });
                break;
                
            case 'heavy':
                // Inimigo pesado: cubo maior roxo
                geometry = new THREE.BoxGeometry(1.5, 1.5, 1.5);
                material = new THREE.MeshPhongMaterial({ color: 0x8800aa });
                break;
                
            case 'boss':
                // Chefão: cubo grande vermelho escuro
                geometry = new THREE.BoxGeometry(2.5, 2.5, 2.5);
                material = new THREE.MeshPhongMaterial({ color: 0x880000 });
                break;
                
            default:
                // Inimigo básico (SENTINELA): cubo azul brilhante
                geometry = new THREE.BoxGeometry(1, 1, 1);
                material = new THREE.MeshPhongMaterial({ 
                    color: 0x0077ff, 
                    emissive: 0x003366,
                    emissiveIntensity: 0.5,
                    shininess: 100
                });
        }
        
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.copy(this.position);
        
        // Adiciona uma sombra
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;
        
        // Adiciona a barra de saúde acima do inimigo
        this.createHealthBar();
        
        return this.mesh;
    }
    
    /**
     * Cria uma barra de saúde acima do inimigo
     */
    createHealthBar() {
        // Altura adicional dependendo do tipo de inimigo
        const heightOffset = this.type === 'boss' ? 2.0 : 
                             this.type === 'heavy' ? 1.2 : 
                             this.type === 'medium' ? 1.0 : 0.8;
        
        // Cria um container para a barra de saúde
        this.healthBarContainer = new THREE.Mesh(
            new THREE.BoxGeometry(1, 0.1, 0.1),
            new THREE.MeshBasicMaterial({ color: 0x333333 })
        );
        
        // Posiciona o container acima do inimigo
        this.healthBarContainer.position.y = heightOffset;
        
        // Cria a barra de saúde verde
        this.healthBar = new THREE.Mesh(
            new THREE.BoxGeometry(1, 0.1, 0.1),
            new THREE.MeshBasicMaterial({ color: 0x00ff00 })
        );
        
        // Ajusta a origem da barra para que ela diminua do lado direito
        this.healthBar.position.x = 0;
        
        // Adiciona a barra ao container
        this.healthBarContainer.add(this.healthBar);
        
        // Adiciona o container ao mesh
        this.mesh.add(this.healthBarContainer);
    }
    
    /**
     * Define a referência à cena
     * @param {THREE.Scene} scene - Cena do jogo
     */
    setScene(scene) {
        this.scene = scene;
    }
    
    /**
     * Atualiza o estado e comportamento do inimigo
     * @param {number} deltaTime - Tempo desde o último frame em segundos
     * @param {Object} player - Referência ao jogador para tracking
     */
    update(deltaTime, player) {
        // Atualiza timers
        if (this.attackTimer > 0) {
            this.attackTimer -= deltaTime;
        }
        
        if (this.stateTimer > 0) {
            this.stateTimer -= deltaTime;
        }
        
        // Máquina de estados
        switch (this.state) {
            case 'idle':
                this.updateIdleState(deltaTime, player);
                break;
                
            case 'chasing':
                this.updateChasingState(deltaTime, player);
                break;
                
            case 'attacking':
                this.updateAttackingState(deltaTime, player);
                break;
                
            case 'dead':
                this.updateDeadState(deltaTime);
                break;
        }
        
        // Atualiza a posição da mesh
        this.mesh.position.copy(this.position);
        
        // Atualiza a bounding box
        this.boundingBox.setFromObject(this.mesh);
        
        // Atualiza os projéteis
        this.updateBullets(deltaTime);
    }
    
    /**
     * Atualiza os projéteis disparados por este inimigo
     * @param {number} deltaTime - Tempo desde o último frame
     */
    updateBullets(deltaTime) {
        // Garante que this.bullets existe
        if (!this.bullets) {
            this.bullets = [];
            return;
        }
        
        // Limita o número de projéteis por inimigo
        if (this.bullets.length > 3) {
            // Remove os mais antigos e recicla
            const toRemove = this.bullets.length - 3;
            for (let i = 0; i < toRemove; i++) {
                const bullet = this.bullets[i];
                if (bullet && bullet.addedToScene && this.scene) {
                    bullet.removeFromScene(this.scene);
                }
                if (bullet && typeof Bullet.recycle === 'function') {
                    Bullet.recycle(bullet);
                }
            }
            this.bullets = this.bullets.slice(toRemove);
        }
        
        // Atualiza posição e verifica colisões de cada projétil
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const bullet = this.bullets[i];
            
            // Verifica se o projétil é válido
            if (!bullet) {
                this.bullets.splice(i, 1);
                continue;
            }
            
            // Atualiza a posição
            bullet.update(deltaTime);
            
            // Remove o projétil se atingiu a distância máxima ou colidiu
            if (bullet.hasCollided || bullet.distance > bullet.maxDistance) {
                // Remove da cena
                if (this.scene && bullet.addedToScene) {
                    bullet.removeFromScene(this.scene);
                }
                
                // Recicla o projétil para o pool
                if (typeof Bullet.recycle === 'function') {
                    Bullet.recycle(bullet);
                }
                
                // Remove da lista
                this.bullets.splice(i, 1);
            }
        }
    }
    
    /**
     * Atualiza o estado de idle (parado)
     * @param {number} deltaTime - Tempo desde o último frame
     * @param {Object} player - Referência ao jogador
     */
    updateIdleState(deltaTime, player) {
        // Verifica se detectou o jogador
        const distanceToPlayer = this.position.distanceTo(player.position);
        
        if (distanceToPlayer < this.detectionRange) {
            // Detectou o jogador, começa a perseguir
            this.state = 'chasing';
            return;
        }
        
        // Comportamento de movimentação lenta ou patrulha
        if (this.stateTimer <= 0) {
            // Escolhe um novo ponto aleatório próximo para "patrulhar"
            const randomOffset = new THREE.Vector3(
                (Math.random() - 0.5) * 10,
                0,
                (Math.random() - 0.5) * 10
            );
            
            this.targetPosition.copy(this.position).add(randomOffset);
            this.stateTimer = 3 + Math.random() * 2; // 3-5 segundos até mudar de direção
        }
        
        // Move em direção ao ponto alvo com velocidade reduzida
        this.direction.subVectors(this.targetPosition, this.position).normalize();
        this.velocity.copy(this.direction).multiplyScalar(this.speed * 0.3 * deltaTime);
        
        // Atualiza a posição
        this.position.add(this.velocity);
        
        // Faz o inimigo olhar na direção do movimento
        if (this.velocity.length() > 0.01) {
            this.mesh.lookAt(this.mesh.position.clone().add(this.direction));
        }
    }
    
    /**
     * Atualiza o estado de perseguição
     * @param {number} deltaTime - Tempo desde o último frame
     * @param {Object} player - Referência ao jogador
     */
    updateChasingState(deltaTime, player) {
        // Calcula a distância até o jogador
        const distanceToPlayer = this.position.distanceTo(player.position);
        
        // Se o jogador estiver fora do alcance de detecção, volta a ficar idle
        if (distanceToPlayer > this.detectionRange * 1.5) {
            this.state = 'idle';
            this.stateTimer = 1;
            return;
        }
        
        // Se estiver dentro do alcance de ataque, muda para o estado de ataque
        if (distanceToPlayer <= this.attackRange) {
            this.state = 'attacking';
            this.attackTimer = 0; // Permite atacar imediatamente
            return;
        }
        
        // Persegue o jogador
        this.direction.subVectors(player.position, this.position).normalize();
        this.velocity.copy(this.direction).multiplyScalar(this.speed * deltaTime);
        
        // Atualiza a posição
        this.position.add(this.velocity);
        
        // Faz o inimigo olhar para o jogador
        this.mesh.lookAt(player.position);
    }
    
    /**
     * Atualiza o estado de ataque
     * @param {number} deltaTime - Tempo desde o último frame
     * @param {Object} player - Referência ao jogador
     */
    updateAttackingState(deltaTime, player) {
        // Calcula a distância até o jogador
        const distanceToPlayer = this.position.distanceTo(player.position);
        
        // Se o jogador estiver fora do alcance de ataque, volta a perseguir
        if (distanceToPlayer > this.attackRange * 1.2) {
            this.state = 'chasing';
            return;
        }
        
        // Face o jogador mesmo durante o ataque
        this.mesh.lookAt(player.position);
        
        // Ataca o jogador quando o cooldown permitir
        if (this.attackTimer <= 0) {
            this.attack(player);
            this.attackTimer = this.attackCooldown;
            
            // Efeito visual de ataque
            const originalColor = this.mesh.material.color.clone();
            this.mesh.material.color.set(0xffff00); // Flash amarelo ao atacar
            
            // Restaura a cor original após um breve momento
            setTimeout(() => {
                if (this.mesh && this.mesh.material) {
                    this.mesh.material.color.copy(originalColor);
                }
            }, 100);
        }
    }
    
    /**
     * Atualiza o estado de morte
     * @param {number} deltaTime - Tempo desde o último frame
     */
    updateDeadState(deltaTime) {
        // Anima a morte (afunda no chão ou desaparece)
        if (this.position.y > -1.5) {
            this.position.y -= deltaTime;
            
            // Também pode girar ou tombar
            this.mesh.rotation.x += deltaTime * 2;
        }
        
        // Diminui a opacidade gradualmente
        if (this.mesh.material.opacity > 0) {
            this.mesh.material.opacity -= deltaTime / 2;
            this.mesh.material.transparent = true;
        }
        
        // Atualiza o timer de morte
        this.deathTimer -= deltaTime;
    }
    
    /**
     * Inimigo ataca o jogador
     * @param {Object} player - Objeto do jogador
     */
    attack(player) {
        // Diferentes tipos de ataques baseados no tipo de inimigo
        switch (this.type) {
            case 'boss':
                // Ataque de projétil com mais frequência e dano
                if (Math.random() < 0.1) { // 10% de chance a cada frame (reduzido para melhorar desempenho)
                    // Limite de projéteis ativos para o chefe (para performance)
                    if (!this.bullets || this.bullets.length < 4) {
                        // Cria um projétil em direção ao jogador
                        const direction = new THREE.Vector3()
                            .subVectors(player.position, this.position)
                            .normalize();
                        
                        // Adiciona um pouco de imprecisão
                        direction.x += (Math.random() - 0.5) * 0.05;
                        direction.y += (Math.random() - 0.5) * 0.05;
                        direction.z += (Math.random() - 0.5) * 0.05;
                        direction.normalize();
                        
                        // Posição inicial do projétil
                        const bulletPosition = this.position.clone().add(new THREE.Vector3(0, 1.5, 0));
                        
                        // Garantir que bullets existe
                        if (!this.bullets) {
                            this.bullets = [];
                        }
                        
                        // Usa o sistema de pool para obter um projétil
                        const bullet = Bullet.get(bulletPosition, direction, false);
                        bullet.damage = this.damage;
                        
                        // Adiciona à lista de projéteis do inimigo
                        this.bullets.push(bullet);
                        
                        // Adiciona à cena, se disponível
                        if (this.scene) {
                            bullet.addToScene(this.scene);
                        }
                    }
                }
                break;
                
            case 'medium':
                // Ataque de projétil ocasional
                if (Math.random() < 0.03) { // 3% de chance a cada frame (reduzido para melhorar desempenho)
                    // Limite de projéteis ativos para inimigos médios
                    if (!this.bullets || this.bullets.length < 2) {
                        // Cria um projétil em direção ao jogador
                        const direction = new THREE.Vector3()
                            .subVectors(player.position, this.position)
                            .normalize();
                        
                        // Adiciona um pouco de imprecisão
                        const accuracy = 0.1;
                        direction.x += (Math.random() - 0.5) * accuracy;
                        direction.y += (Math.random() - 0.5) * accuracy;
                        direction.z += (Math.random() - 0.5) * accuracy;
                        direction.normalize();
                        
                        // Posição inicial do projétil
                        const bulletPosition = this.position.clone().add(new THREE.Vector3(0, 1.5, 0));
                        
                        // Garantir que bullets existe
                        if (!this.bullets) {
                            this.bullets = [];
                        }
                        
                        // Limita total de projéteis por inimigo para melhorar desempenho
                        if (this.bullets.length < 2) {
                            // Usa o sistema de pool para obter um projétil
                            const bullet = Bullet.get(bulletPosition, direction, false);
                            bullet.damage = this.damage;
                            
                            // Adiciona à lista de projéteis do inimigo
                            this.bullets.push(bullet);
                            
                            // Adiciona à cena, se disponível
                            if (this.scene) {
                                bullet.addToScene(this.scene);
                            }
                        }
                    }
                }
                break;
                
            case 'heavy':
                // Ataque de projétil com mais dano, mas menos frequente
                if (Math.random() < 0.02) { // 2% de chance a cada frame (reduzido para melhorar desempenho)
                    // Limite de projéteis ativos para inimigos pesados
                    if (!this.bullets || this.bullets.length < 2) {
                        // Cria um projétil em direção ao jogador
                        const direction = new THREE.Vector3()
                            .subVectors(player.position, this.position)
                            .normalize();
                        
                        // Adiciona um pouco de imprecisão
                        const accuracy = 0.05;
                        direction.x += (Math.random() - 0.5) * accuracy;
                        direction.y += (Math.random() - 0.5) * accuracy;
                        direction.z += (Math.random() - 0.5) * accuracy;
                        direction.normalize();
                        
                        // Posição inicial do projétil
                        const bulletPosition = this.position.clone().add(new THREE.Vector3(0, 1.5, 0));
                        
                        // Garantir que bullets existe
                        if (!this.bullets) {
                            this.bullets = [];
                        }
                        
                        // Usa o sistema de pool para obter um projétil
                        const bullet = Bullet.get(bulletPosition, direction, false);
                        bullet.damage = this.damage * 1.5; // Mais dano para inimigos pesados
                        
                        // Adiciona à lista de projéteis do inimigo
                        this.bullets.push(bullet);
                        
                        // Adiciona à cena, se disponível
                        if (this.scene) {
                            bullet.addToScene(this.scene);
                        }
                    }
                }
                break;
                
            default: // basic
                // Ataque de projétil básico
                if (Math.random() < 0.05) { // 5% de chance a cada frame (reduzido para melhorar desempenho)
                    // Limite básico de projéteis
                    if (!this.bullets || this.bullets.length < 1) {
                        // Cria um projétil em direção ao jogador
                        const direction = new THREE.Vector3()
                            .subVectors(player.position, this.position)
                            .normalize();
                        
                        // Adiciona um pouco de imprecisão
                        const accuracy = this.type === 'medium' ? 0.1 : 0.05;
                        direction.x += (Math.random() - 0.5) * accuracy;
                        direction.y += (Math.random() - 0.5) * accuracy;
                        direction.z += (Math.random() - 0.5) * accuracy;
                        direction.normalize();
                        
                        // Posição inicial do projétil
                        const bulletPosition = this.position.clone().add(new THREE.Vector3(0, 1.5, 0));
                        
                        // Garantir que bullets existe
                        if (!this.bullets) {
                            this.bullets = [];
                        }
                        
                        // Limita total de projéteis por inimigo para melhorar desempenho
                        if (this.bullets.length < 1) {
                            // Usa o sistema de pool para obter um projétil
                            const bullet = Bullet.get(bulletPosition, direction, false);
                            bullet.damage = this.damage;
                            
                            // Adiciona à lista de projéteis do inimigo
                            this.bullets.push(bullet);
                            
                            // Adiciona à cena, se disponível
                            if (this.scene) {
                                bullet.addToScene(this.scene);
                            }
                        }
                    }
                }
        }
    }
    
    /**
     * Causa dano ao inimigo
     * @param {number} amount - Quantidade de dano
     * @returns {boolean} - Se o dano foi fatal
     */
    takeDamage(amount) {
        // Se já estiver morto, ignora
        if (this.state === 'dead') return false;
        
        this.health -= amount;
        
        // Atualiza o valor de saúde mostrado acima do inimigo
        if (this.healthBar) {
            const percent = Math.max(0, this.health / this.maxHealth);
            this.healthBar.scale.x = percent;
            
            // Muda a cor da barra de saúde baseado na porcentagem
            if (percent > 0.6) {
                this.healthBar.material.color.setHex(0x00ff00); // Verde
            } else if (percent > 0.3) {
                this.healthBar.material.color.setHex(0xffff00); // Amarelo
            } else {
                this.healthBar.material.color.setHex(0xff0000); // Vermelho
            }
        }
        
        // Se a saúde chegar a zero ou menos, o inimigo morre
        if (this.health <= 0) {
            this.die();
            return true; // O dano foi fatal
        }
        
        return false; // O inimigo sobreviveu
    }
    
    /**
     * Mata o inimigo
     */
    die() {
        this.state = 'dead';
        this.health = 0;
        
        // Muda a cor para cinza
        if (this.mesh && this.mesh.material) {
            this.mesh.material.color.set(0x666666);
        }
    }
    
    /**
     * Verifica colisão com outro objeto
     * @param {Object} object - Objeto para verificar colisão
     * @returns {boolean} - Verdadeiro se houver colisão
     */
    checkCollision(object) {
        if (object.boundingBox) {
            return this.boundingBox.intersectsBox(object.boundingBox);
        }
        return false;
    }
} 