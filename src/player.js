/**
 * Classe que representa o jogador no jogo
 * Gerencia a movimentação, arma, saúde e interações do jogador
 */
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.157.0/build/three.module.js';
import { PLAYER, WEAPON } from './config.js';
import { Bullet } from './bullet.js';

export class Player {
    constructor(camera, inputManager) {
        console.log("Inicializando jogador...");
        
        // Referências à câmera e gerenciador de entrada
        this.camera = camera;
        this.inputManager = inputManager;
        console.log("Camera e InputManager disponíveis:", !!camera, !!inputManager);
        
        // Atributos do jogador
        this.health = PLAYER.HEALTH;
        this.position = new THREE.Vector3(0, PLAYER.HEIGHT, 0);
        this.velocity = new THREE.Vector3(0, 0, 0);
        this.rotation = new THREE.Euler(0, 0, 0, 'YXZ');
        
        // Para detecção de colisão
        this.boundingBox = new THREE.Box3(
            new THREE.Vector3(-PLAYER.RADIUS, 0, -PLAYER.RADIUS),
            new THREE.Vector3(PLAYER.RADIUS, PLAYER.HEIGHT, PLAYER.RADIUS)
        );
        
        // Atributos da arma
        this.ammo = WEAPON.MAGAZINE_SIZE;
        this.reserveAmmo = WEAPON.MAX_AMMO;
        this.fireTimer = 0;
        this.isReloading = false;
        this.reloadTimer = 0;
        
        // Lista de projéteis ativos
        this.bullets = [];
        
        // Configura a arma
        this.setupWeapon();
        
        // Atualiza a posição inicial da câmera
        if (this.camera) {
            this.camera.position.copy(this.position);
            this.camera.rotation.copy(this.rotation);
        } else {
            console.error("Player: Câmera não inicializada");
        }
        
        console.log("Jogador inicializado na posição:", this.position);
    }
    
    /**
     * Configura o modelo da arma e anexa à câmera
     */
    setupWeapon() {
        if (!this.camera) {
            console.error("Player: Não é possível configurar a arma - câmera não definida");
            return;
        }
        
        // Grupo para arma
        this.weaponGroup = new THREE.Group();
        
        // Cria o modelo da arma (um cano simples por enquanto)
        const barrelGeometry = new THREE.CylinderGeometry(0.05, 0.05, 0.5, 16);
        const barrelMaterial = new THREE.MeshStandardMaterial({ color: 0x222222 });
        this.barrel = new THREE.Mesh(barrelGeometry, barrelMaterial);
        this.barrel.rotation.x = Math.PI / 2;
        this.barrel.position.set(0, -0.15, -0.25);
        
        // Corpo da arma
        const bodyGeometry = new THREE.BoxGeometry(0.2, 0.2, 0.6);
        const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0x333333 });
        this.body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        this.body.position.set(0, -0.3, 0);
        
        // Cabo da arma
        const gripGeometry = new THREE.BoxGeometry(0.1, 0.4, 0.1);
        const gripMaterial = new THREE.MeshStandardMaterial({ color: 0x111111 });
        this.grip = new THREE.Mesh(gripGeometry, gripMaterial);
        this.grip.position.set(0, -0.55, 0.1);
        
        // Adiciona as partes ao grupo da arma
        this.weaponGroup.add(this.barrel);
        this.weaponGroup.add(this.body);
        this.weaponGroup.add(this.grip);
        
        // Posiciona a arma na câmera
        this.weaponGroup.position.set(0.3, -0.3, -0.5);
        
        // Adiciona a arma à câmera
        this.camera.add(this.weaponGroup);
        
        console.log("Arma configurada");
    }
    
    /**
     * Atualiza o estado do jogador
     * @param {number} deltaTime - Tempo desde o último frame em segundos
     */
    update(deltaTime) {
        // Não atualiza se a saúde for zero ou negativa
        if (this.health <= 0) return;
        
        console.log("Atualizando jogador, deltaTime:", deltaTime);
        
        // Processa a rotação da câmera
        this.updateRotation(deltaTime);
        
        // Processa o movimento do jogador
        this.updateMovement(deltaTime);
        
        // Atualiza a arma e disparo
        this.updateWeapon(deltaTime);
        
        // Atualiza os projéteis
        this.updateBullets(deltaTime);
    }
    
    /**
     * Atualiza a rotação do jogador (câmera) baseado no movimento do mouse
     * @param {number} deltaTime - Tempo desde o último frame em segundos
     */
    updateRotation(deltaTime) {
        // Obtém a rotação da câmera baseado no movimento do mouse
        const rotation = this.inputManager.getCameraRotation();
        
        // Aplica a rotação vertical (pitch) com limites para evitar virar de cabeça para baixo
        this.rotation.x -= rotation.y * PLAYER.LOOK_SENSITIVITY * deltaTime;
        this.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.rotation.x));
        
        // Aplica a rotação horizontal (yaw)
        this.rotation.y -= rotation.x * PLAYER.LOOK_SENSITIVITY * deltaTime;
        
        // Aplica as rotações à câmera
        this.camera.rotation.copy(this.rotation);
    }
    
    /**
     * Atualiza a posição do jogador baseado nas teclas pressionadas
     * @param {number} deltaTime - Tempo desde o último frame em segundos
     */
    updateMovement(deltaTime) {
        // Obtém o vetor de movimento das teclas pressionadas
        const movement = this.inputManager.getMovementVector();
        console.log("Vetor de movimento:", movement);
        
        // Determina a velocidade baseada em se está correndo ou não
        const speed = this.inputManager.isRunning() ?
            PLAYER.SPEED * PLAYER.SPRINT_MULTIPLIER :
            PLAYER.SPEED;
        
        // Vetor de direção inicial
        const direction = new THREE.Vector3();
        
        // Obtém a direção para onde a câmera está olhando (apenas componente horizontal)
        const cameraDirection = new THREE.Vector3();
        this.camera.getWorldDirection(cameraDirection);
        cameraDirection.y = 0; // Ignoramos a componente vertical
        cameraDirection.normalize();
        
        // Vetor perpendicular à direção da câmera (para movimentos laterais)
        const right = new THREE.Vector3();
        right.crossVectors(new THREE.Vector3(0, 1, 0), cameraDirection).normalize();
        
        // Aplica o movimento para frente/trás - CORRIGIDO: Invertido para corrigir W/S
        if (movement.z !== 0) {
            // Movimento frente/trás na direção da câmera
            direction.add(cameraDirection.clone().multiplyScalar(-movement.z)); // Invertido o sinal
        }
        
        // Aplica o movimento lateral (esquerda/direita) - CORRIGIDO: Invertido para corrigir A/D
        if (movement.x !== 0) {
            // Movimento lateral perpendicular à direção da câmera
            direction.add(right.clone().multiplyScalar(-movement.x)); // Invertido o sinal
        }
        
        // Normaliza o vetor de direção se houver movimento
        if (direction.length() > 0) {
            direction.normalize();
        }
        
        // Calcula o movimento final
        this.velocity.copy(direction).multiplyScalar(speed * deltaTime);
        
        // Atualiza a posição
        this.position.add(this.velocity);
        console.log("Nova posição:", this.position);
        
        // Atualiza a posição da câmera
        this.camera.position.x = this.position.x;
        this.camera.position.z = this.position.z;
        
        // Atualiza o boundingBox para colisões
        this.updateBoundingBox();
    }
    
    /**
     * Atualiza o status da arma e gerencia disparos
     * @param {number} deltaTime - Tempo desde o último frame em segundos
     */
    updateWeapon(deltaTime) {
        // Atualiza temporizador de disparo
        if (this.fireTimer > 0) {
            this.fireTimer -= deltaTime;
        }
        
        // Atualiza temporizador de recarga
        if (this.isReloading) {
            this.reloadTimer -= deltaTime;
            
            // Finaliza a recarga
            if (this.reloadTimer <= 0) {
                this.finishReloading();
            }
            
            return; // Se está recarregando, não pode disparar
        }
        
        // Inicia recarga se pressionar R e tiver munição na reserva
        if (this.inputManager.isReloading() && !this.isReloading && this.ammo < WEAPON.MAGAZINE_SIZE && this.reserveAmmo > 0) {
            this.startReloading();
            return;
        }
        
        // Verifica se o jogador está tentando disparar
        if (this.inputManager.isShooting()) {
            if (this.fireTimer <= 0 && this.ammo > 0) {
                this.shoot();
            } else if (this.fireTimer <= 0 && this.ammo <= 0) {
                // Toca o som de arma vazia
                this.playEmptySound();
                // Adiciona um pequeno delay para não tocar o som continuamente
                this.fireTimer = 0.25;
            }
        }
    }
    
    /**
     * Atualiza os projéteis disparados pelo jogador
     * @param {number} deltaTime - Tempo desde o último frame em segundos
     */
    updateBullets(deltaTime) {
        // Atualiza a posição de cada projétil e remove os que estão fora do alcance
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const bullet = this.bullets[i];
            bullet.update(deltaTime);
            
            // Remove o projétil se estiver fora do alcance ou colidiu
            if (bullet.distance > WEAPON.RANGE || bullet.hasCollided) {
                this.bullets.splice(i, 1);
            }
        }
    }
    
    /**
     * Dispara a arma do jogador
     */
    shoot() {
        // Verifica se pode disparar
        if (this.ammo <= 0 || this.fireTimer > 0 || this.isReloading) {
            return;
        }
        
        // Reduz a munição
        this.ammo--;
        
        // Define o timer de disparo
        this.fireTimer = WEAPON.FIRE_RATE;
        
        // Limita o número máximo de projéteis ativos para melhorar desempenho
        if (this.bullets.length >= 10) {
            return;
        }
        
        // Obtém a direção exata para onde a câmera está olhando
        const bulletDirection = new THREE.Vector3();
        this.camera.getWorldDirection(bulletDirection);
        
        // Posição inicial do projétil (mais à frente da câmera para evitar auto-colisão)
        const bulletPosition = this.camera.position.clone().add(
            bulletDirection.clone().multiplyScalar(1.0) // Aumentado para evitar colisão com o jogador
        );
        
        // Cria o projétil com a direção e posição calculadas
        const bullet = new Bullet(
            bulletPosition,
            bulletDirection,
            true // É um projétil do jogador
        );
        
        // Adiciona o projétil à lista
        this.bullets.push(bullet);
        
        // Adiciona um recuo na câmera (efeito visual)
        this.camera.position.sub(bulletDirection.clone().multiplyScalar(WEAPON.RECOIL));
        setTimeout(() => {
            this.camera.position.add(bulletDirection.clone().multiplyScalar(WEAPON.RECOIL));
        }, 50);
        
        // Tocar som de tiro
        this.playShootSound();
        
        // Se a munição acabou e tem reserva, recarregar automaticamente
        if (this.ammo === 0 && this.reserveAmmo > 0) {
            this.startReloading();
        }
    }
    
    /**
     * Inicia o processo de recarga da arma
     */
    startReloading() {
        // Não recarregar se já estiver com o carregador cheio ou não tiver munição na reserva
        if (this.ammo === WEAPON.MAGAZINE_SIZE || this.reserveAmmo <= 0 || this.isReloading) {
            return;
        }
        
        this.isReloading = true;
        this.reloadTimer = WEAPON.RELOAD_TIME;
        
        // Tocar som de recarga
        this.playReloadSound();
    }
    
    /**
     * Finaliza o processo de recarga
     */
    finishReloading() {
        // Calcula quanto de munição precisamos
        const needAmmo = WEAPON.MAGAZINE_SIZE - this.ammo;
        
        // Verifica quanto podemos tirar da reserva
        const takeFromReserve = Math.min(needAmmo, this.reserveAmmo);
        
        // Atualiza a munição
        this.ammo += takeFromReserve;
        this.reserveAmmo -= takeFromReserve;
        
        // Reseta flags
        this.isReloading = false;
        this.reloadTimer = 0;
    }
    
    /**
     * Causa dano ao jogador
     * @param {number} amount - Quantidade de dano a ser causado
     * @returns {boolean} - Verdadeiro se o jogador morreu
     */
    takeDamage(amount) {
        const oldHealth = this.health;
        this.health = Math.max(0, this.health - amount);
        
        // Mostra efeito visual de dano
        this.showDamageEffect();
        
        // Reproduz som de dano
        if (amount > 0) {
            // Som de dano leve ou pesado dependendo da quantidade
            this.playHurtSound(amount > 20);
        }
        
        // Atualiza UI de saúde
        if (this.updateHealthUI) {
            this.updateHealthUI();
        }
        
        // Retorna verdadeiro se o jogador morreu
        return this.health <= 0;
    }
    
    /**
     * Aplica efeito visual quando o jogador recebe dano
     */
    showDamageEffect() {
        // Aplica um flash vermelho na tela - implementado na UI
        if (window.game && window.game.uiManager) {
            window.game.uiManager.showDamageSplash();
        }
        
        // Shake de câmera
        if (this.camera) {
            const originalPosition = this.camera.position.clone();
            
            // Aplica uma série de pequenos deslocamentos aleatórios durante um curto período
            const shakeIntensity = 0.1;
            const shakeDuration = 200; // ms
            const intervalTime = 20; // ms
            let elapsedTime = 0;
            
            const shakeTimer = setInterval(() => {
                // Aplicar um deslocamento aleatório
                if (elapsedTime < shakeDuration) {
                    const offsetX = (Math.random() - 0.5) * shakeIntensity;
                    const offsetY = (Math.random() - 0.5) * shakeIntensity;
                    
                    // Manter a posição Y constante para evitar sensação de "flutuação"
                    this.camera.position.x = originalPosition.x + offsetX;
                    
                    elapsedTime += intervalTime;
                } else {
                    // Restaurar posição original e limpar o intervalo
                    this.camera.position.x = originalPosition.x;
                    clearInterval(shakeTimer);
                }
            }, intervalTime);
        }
    }
    
    /**
     * Toca o som de disparo
     */
    playShootSound() {
        // Tenta obter o AudioManager do objeto game global ou do jogo diretamente
        let audioManager = null;
        
        if (window.game && window.game.audioManager) {
            audioManager = window.game.audioManager;
            console.log("Usando AudioManager do window.game");
        } else {
            console.warn('AudioManager não disponível via window.game');
        }
        
        if (audioManager) {
            audioManager.play('shoot');
        } else {
            console.error('AudioManager não encontrado para tocar som de tiro');
        }
    }
    
    /**
     * Toca o som de recarga
     */
    playReloadSound() {
        // Tenta obter o AudioManager do objeto game global ou do jogo diretamente
        let audioManager = null;
        
        if (window.game && window.game.audioManager) {
            audioManager = window.game.audioManager;
        }
        
        if (audioManager) {
            audioManager.play('reload');
        } else {
            console.warn('AudioManager não disponível para tocar som de recarga');
        }
    }
    
    /**
     * Reproduz som quando o jogador é ferido
     * @param {boolean} heavy - Se o dano é pesado (true) ou leve (false)
     */
    playHurtSound(heavy = false) {
        // Tenta obter o AudioManager do objeto game global ou do jogo diretamente
        let audioManager = null;
        
        if (window.game && window.game.audioManager) {
            audioManager = window.game.audioManager;
        }
        
        if (audioManager) {
            // Usar o som de explosão temporariamente para dano pesado
            const soundId = heavy ? 'explosion' : 'shoot';
            const volume = heavy ? 0.8 : 0.3;
            audioManager.play(soundId, volume);
        } else {
            console.warn('AudioManager não disponível para tocar som de dano');
        }
    }
    
    /**
     * Cura o jogador
     * @param {number} amount - Quantidade de saúde a restaurar
     */
    heal(amount) {
        this.health = Math.min(PLAYER.HEALTH, this.health + amount);
    }
    
    /**
     * Adiciona munição à reserva do jogador
     * @param {number} amount - Quantidade de munição a adicionar
     */
    addAmmo(amount) {
        this.reserveAmmo = Math.min(WEAPON.MAX_AMMO, this.reserveAmmo + amount);
    }
    
    /**
     * Atualiza a caixa de colisão do jogador
     */
    updateBoundingBox() {
        this.boundingBox.min.set(
            this.position.x - PLAYER.RADIUS,
            this.position.y,
            this.position.z - PLAYER.RADIUS
        );
        
        this.boundingBox.max.set(
            this.position.x + PLAYER.RADIUS,
            this.position.y + PLAYER.HEIGHT,
            this.position.z + PLAYER.RADIUS
        );
    }
    
    /**
     * Reinicia o estado do jogador
     */
    reset() {
        console.log("Reiniciando jogador...");
        
        // Restaura atributos básicos
        this.health = PLAYER.HEALTH;
        this.position.set(0, PLAYER.HEIGHT, 0);
        this.velocity.set(0, 0, 0);
        this.rotation.set(0, 0, 0, 'YXZ');
        this.ammo = WEAPON.MAGAZINE_SIZE;
        this.reserveAmmo = WEAPON.MAX_AMMO;
        this.fireTimer = 0;
        this.isReloading = false;
        this.reloadTimer = 0;
        
        // Limpa a lista de projéteis
        this.bullets = [];
        
        // Atualiza a posição da câmera
        if (this.camera) {
            this.camera.position.set(this.position.x, this.position.y, this.position.z);
            this.camera.rotation.copy(this.rotation);
        }
        
        // Atualiza o boundingBox
        this.updateBoundingBox();
        
        console.log("Jogador reiniciado na posição:", this.position);
    }
    
    /**
     * Toca o som de arma vazia (sem munição)
     */
    playEmptySound() {
        // Tenta obter o AudioManager do objeto game global ou do jogo diretamente
        let audioManager = null;
        
        if (window.game && window.game.audioManager) {
            audioManager = window.game.audioManager;
        }
        
        if (audioManager) {
            audioManager.play('empty');
        } else {
            console.warn('AudioManager não disponível para tocar som de arma vazia');
        }
    }
} 