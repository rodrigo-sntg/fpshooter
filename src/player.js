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
     * Configura a arma
     */
    setupWeapon() {
        // Configuração de atributos iniciais da arma
        this.ammo = WEAPON.MAGAZINE_SIZE;
        this.reserveAmmo = WEAPON.MAX_AMMO;
        this.fireTimer = 0;
        this.isReloading = false;
        this.reloadTimer = 0;
        
        // Criar modelo 3D da arma em primeira pessoa
        this.createWeaponModel();
    }
    
    /**
     * Cria o modelo 3D da arma em primeira pessoa
     */
    createWeaponModel() {
        // Grupo para a arma (será filho da câmera)
        this.weaponGroup = new THREE.Group();
        
        console.log("Criando modelo de arma em primeira pessoa");
        
        // Modelo simples de uma pistola usando geometrias básicas
        // Corpo principal da arma - AUMENTANDO O TAMANHO
        const gunBody = new THREE.Mesh(
            new THREE.BoxGeometry(0.2, 0.3, 0.8),
            new THREE.MeshPhongMaterial({ color: 0x222222, shininess: 30 })
        );
        gunBody.position.set(0, -0.3, 0);
        this.weaponGroup.add(gunBody);
        
        // Cano da arma - AUMENTANDO O TAMANHO
        const barrel = new THREE.Mesh(
            new THREE.CylinderGeometry(0.05, 0.05, 0.6, 8),
            new THREE.MeshPhongMaterial({ color: 0x111111, shininess: 50 })
        );
        barrel.rotation.x = Math.PI / 2;
        barrel.position.set(0, -0.2, 0.5);
        this.weaponGroup.add(barrel);
        
        // Empunhadura - AUMENTANDO O TAMANHO
        const handle = new THREE.Mesh(
            new THREE.BoxGeometry(0.15, 0.4, 0.2),
            new THREE.MeshPhongMaterial({ color: 0x333333, shininess: 20 })
        );
        handle.position.set(0, -0.5, 0);
        this.weaponGroup.add(handle);
        
        // Mira
        const sight = new THREE.Mesh(
            new THREE.BoxGeometry(0.04, 0.04, 0.04),
            new THREE.MeshPhongMaterial({ color: 0xff0000 })
        );
        sight.position.set(0, -0.1, 0.35);
        this.weaponGroup.add(sight);
        
        // Posiciona a arma na câmera - REPOSICIONANDO
        this.weaponGroup.position.set(0.3, -0.4, -0.8);
        
        // Adiciona a arma à câmera
        this.camera.add(this.weaponGroup);
        
        console.log("Arma criada e adicionada à câmera:", !!this.weaponGroup);
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
        
        // Anima o modelo da arma durante o movimento
        this.animateWeapon(deltaTime);
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
     * Atualiza o estado dos projéteis ativos
     * @param {number} deltaTime - Tempo desde o último frame
     */
    updateBullets(deltaTime) {
        if (!this.bullets || this.bullets.length === 0) return;
        
        // Limita o número de projéteis ativos para melhorar desempenho
        if (this.bullets.length > 10) {
            // Remove os projéteis mais antigos
            const toRemove = this.bullets.length - 10;
            for (let i = 0; i < toRemove; i++) {
                const oldBullet = this.bullets[i];
                if (oldBullet.addedToScene && this.scene) {
                    oldBullet.removeFromScene(this.scene);
                }
                // Devolve ao pool
                Bullet.recycle(oldBullet);
            }
            this.bullets = this.bullets.slice(toRemove);
        }
        
        // Remove projéteis que colidiram ou estão muito longe
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const bullet = this.bullets[i];
            
            if (!bullet) continue;
            
            // Atualiza a posição e verifica colisões
            bullet.update(deltaTime);
            
            // Se o projétil colidiu ou está muito longe, remove-o
            if (bullet.hasCollided || bullet.distance > bullet.maxDistance) {
                // Remove da cena
                if (bullet.addedToScene && this.scene) {
                    bullet.removeFromScene(this.scene);
                }
                
                // Recicla o projétil (devolve ao pool)
                Bullet.recycle(bullet);
                
                // Remove da lista de projéteis ativos
                this.bullets.splice(i, 1);
            }
        }
    }
    
    /**
     * Atira com a arma do jogador
     * @returns {boolean} - Se o tiro foi bem-sucedido
     */
    shoot() {
        // Verifica se pode atirar (munição, recarregando, cooldown)
        if (this.ammo <= 0) {
            this.playEmptySound();
            
            // Auto-recarrega quando a munição acaba
            if (!this.isReloading && this.reserveAmmo > 0) {
                this.startReloading();
            }
            
            return false;
        }
        
        if (this.isReloading) {
            return false;
        }
        
        if (this.fireTimer > 0) {
            return false;
        }
        
        // Decrementa munição
        this.ammo--;
        
        // Define o timer para impedir tiros rápidos demais
        this.fireTimer = WEAPON.FIRE_RATE;
        
        // Reproduz som de tiro
        this.playShootSound();
        
        // Dispara o projétil
        const position = this.getBulletSpawnPosition();
        const direction = this.getBulletDirection();
        
        // Cria um novo projétil do pool
        const bullet = Bullet.get(position, direction, true);
        
        // Se a referência da cena estiver disponível, adiciona à cena
        if (this.scene) {
            bullet.addToScene(this.scene);
        }
        
        // Adiciona à lista de projéteis ativos
        if (!this.bullets) this.bullets = [];
        this.bullets.push(bullet);
        
        // Inicia animação de recuo
        this.startRecoilAnimation();
        
        // Cria o efeito visual de disparo
        this.createMuzzleFlash();
        
        // Notifica o servidor multiplayer (se o jogo estiver em modo multiplayer)
        if (window.game && window.game.isMultiplayer && window.game.networkManager) {
            window.game.networkManager.sendShoot(position, direction);
        }
        
        return true;
    }
    
    /**
     * Inicia a animação de recuo da arma
     */
    startRecoilAnimation() {
        this.recoilAnimation = {
            active: true,
            time: 0,
            duration: 0.1
        };
    }
    
    /**
     * Retorna a posição de onde o projétil deve ser criado
     * @returns {THREE.Vector3} - Posição inicial do projétil
     */
    getBulletSpawnPosition() {
        const position = new THREE.Vector3();
        
        // Pega a posição da ponta da arma ou da câmera se a arma não estiver visível
        if (this.weaponModel && this.weaponModel.visible) {
            // Posição baseada na arma
            position.copy(this.weaponModel.position).add(new THREE.Vector3(0.3, -0.1, -1));
        } else {
            // Posição baseada na câmera
            position.copy(this.camera.position);
            // Avança um pouco na direção da câmera para evitar colisão imediata
            const direction = new THREE.Vector3();
            this.camera.getWorldDirection(direction);
            position.add(direction.multiplyScalar(0.5));
        }
        
        return position;
    }
    
    /**
     * Retorna a direção em que o projétil deve ser disparado
     * @returns {THREE.Vector3} - Direção normalizada
     */
    getBulletDirection() {
        const direction = new THREE.Vector3();
        this.camera.getWorldDirection(direction);
        return direction;
    }
    
    /**
     * Cria um efeito de flash na ponta da arma ao disparar
     */
    createMuzzleFlash() {
        if (!this.weaponGroup) return;
        
        // Verifica se já existe um flash e remove
        if (this.muzzleFlash) {
            this.weaponGroup.remove(this.muzzleFlash);
        }
        
        // Cria um grupo para o flash
        this.muzzleFlash = new THREE.Group();
        
        // Luz pontual para iluminar a área
        const flashLight = new THREE.PointLight(0xffaa22, 3, 5);
        flashLight.position.set(0, -0.2, 0.6);
        this.muzzleFlash.add(flashLight);
        
        // Círculo principal do flash - AUMENTADO
        const flashGeometry = new THREE.CircleGeometry(0.1, 16);
        const flashMaterial = new THREE.MeshBasicMaterial({ 
            color: 0xffff99,
            transparent: true,
            opacity: 0.9,
            side: THREE.DoubleSide
        });
        const flash = new THREE.Mesh(flashGeometry, flashMaterial);
        flash.position.set(0, -0.2, 0.6);
        flash.rotation.y = Math.PI / 2;
        this.muzzleFlash.add(flash);
        
        // Adiciona o flash à arma
        this.weaponGroup.add(this.muzzleFlash);
        
        // Remove o flash após um curto período
        setTimeout(() => {
            if (this.muzzleFlash && this.weaponGroup) {
                this.weaponGroup.remove(this.muzzleFlash);
                this.muzzleFlash = null;
            }
        }, 70); // Aumentando duração para ser mais visível
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
        
        // Inicia animação de recarga
        this.startReloadAnimation();
        
        // Tocar som de recarga
        this.playReloadSound();
    }
    
    /**
     * Inicia a animação de recarga da arma
     */
    startReloadAnimation() {
        if (!this.weaponGroup) return;
        
        // Salva a posição original
        const originalPosition = {
            x: this.weaponGroup.position.x,
            y: this.weaponGroup.position.y,
            z: this.weaponGroup.position.z
        };
        
        const originalRotation = {
            x: this.weaponGroup.rotation.x,
            y: this.weaponGroup.rotation.y,
            z: this.weaponGroup.rotation.z
        };
        
        // Animação de recarga - rotação para baixo e depois volta
        const reloadAnimation = () => {
            const progress = 1 - (this.reloadTimer / WEAPON.RELOAD_TIME);
            
            // Fase 1: rotação para baixo/lado (0-25%)
            if (progress < 0.25) {
                const phase1 = progress / 0.25;
                this.weaponGroup.rotation.z = originalRotation.z - Math.PI / 4 * phase1;
                this.weaponGroup.rotation.x = originalRotation.x - Math.PI / 6 * phase1;
                this.weaponGroup.position.y = originalPosition.y - 0.1 * phase1;
            }
            // Fase 2: segura na posição (25-75%)
            else if (progress < 0.75) {
                this.weaponGroup.rotation.z = originalRotation.z - Math.PI / 4;
                this.weaponGroup.rotation.x = originalRotation.x - Math.PI / 6;
                this.weaponGroup.position.y = originalPosition.y - 0.1;
            }
            // Fase 3: retorna à posição original (75-100%)
            else {
                const phase3 = (progress - 0.75) / 0.25;
                this.weaponGroup.rotation.z = originalRotation.z - Math.PI / 4 * (1 - phase3);
                this.weaponGroup.rotation.x = originalRotation.x - Math.PI / 6 * (1 - phase3);
                this.weaponGroup.position.y = originalPosition.y - 0.1 * (1 - phase3);
            }
            
            // Continuar a animação se ainda estiver recarregando
            if (this.isReloading) {
                requestAnimationFrame(reloadAnimation);
            } else {
                // Restaura a posição original
                this.weaponGroup.rotation.z = originalRotation.z;
                this.weaponGroup.rotation.x = originalRotation.x;
                this.weaponGroup.position.y = originalPosition.y;
            }
        };
        
        // Inicia a animação
        requestAnimationFrame(reloadAnimation);
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
        
        // Limpa animações
        this.recoilAnimation = null;
        
        // Remove o modelo de arma antigo, se existir
        if (this.weaponGroup && this.camera) {
            this.camera.remove(this.weaponGroup);
            this.weaponGroup = null;
        }
        
        // Atualiza a posição da câmera
        if (this.camera) {
            this.camera.position.set(this.position.x, this.position.y, this.position.z);
            this.camera.rotation.copy(this.rotation);
            
            // Reinicializa o modelo da arma
            this.createWeaponModel();
            
            // Programa uma verificação para garantir que a arma esteja visível
            setTimeout(() => this.ensureWeaponVisible(), 500);
        }
        
        // Atualiza o boundingBox
        this.updateBoundingBox();
        
        console.log("Jogador reiniciado na posição:", this.position);
    }
    
    /**
     * Garante que a arma seja exibida na tela
     */
    ensureWeaponVisible() {
        if (!this.weaponGroup || !this.camera) return;
        
        console.log("Verificando visibilidade da arma...");
        
        // Se a arma não estiver visível, recria-a
        if (!this.weaponGroup.parent) {
            console.log("Arma não está no grafo de cena, recriando...");
            this.camera.remove(this.weaponGroup);
            this.createWeaponModel();
        }
        
        // Força uma posição onde a arma será claramente visível
        this.weaponGroup.position.set(0.3, -0.4, -0.8);
        
        // Dispara um tiro falso para mostrar a arma com efeito visual
        setTimeout(() => {
            console.log("Disparando tiro falso para destacar a arma...");
            this.createMuzzleFlash();
        }, 1000);
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
    
    /**
     * Anima o modelo da arma durante o movimento e ações
     * @param {number} deltaTime - Tempo desde o último frame
     */
    animateWeapon(deltaTime) {
        if (!this.weaponGroup) return;
        
        // Obtém o vetor de movimento
        const movement = this.inputManager.getMovementVector();
        const isMoving = movement.x !== 0 || movement.z !== 0;
        const isRunning = this.inputManager.isRunning();
        
        // Movimento de balanço ao andar
        if (isMoving) {
            // Frequência e amplitude do balanço
            const frequency = isRunning ? 10 : 5; // Mais rápido ao correr
            const amplitude = isRunning ? 0.05 : 0.03; // Mais amplo ao correr, mas mantendo visível
            
            // Animação de balanço baseada no tempo
            const time = Date.now() * 0.001; 
            const swingX = Math.sin(time * frequency) * amplitude;
            const swingY = Math.abs(Math.sin(time * frequency * 2)) * amplitude * 0.5;
            
            // Aplica o movimento - USANDO A POSIÇÃO BASE MAIOR
            this.weaponGroup.position.x = 0.3 + swingX;
            this.weaponGroup.position.y = -0.4 - swingY;
            
            // Rotação leve durante o movimento
            this.weaponGroup.rotation.z = swingX * 0.5;
            this.weaponGroup.rotation.x = swingY * 0.5;
        } else {
            // Movimento suave de "respiração" quando parado
            const breatheTime = Date.now() * 0.001;
            const breatheAmount = Math.sin(breatheTime * 0.5) * 0.005;
            
            // Retorna suavemente à posição neutra - USANDO A POSIÇÃO BASE MAIOR
            this.weaponGroup.position.x = THREE.MathUtils.lerp(
                this.weaponGroup.position.x, 0.3, deltaTime * 3);
            this.weaponGroup.position.y = THREE.MathUtils.lerp(
                this.weaponGroup.position.y, -0.4 + breatheAmount, deltaTime * 3);
            
            // Retorna à rotação neutra
            this.weaponGroup.rotation.z = THREE.MathUtils.lerp(
                this.weaponGroup.rotation.z, 0, deltaTime * 3);
            this.weaponGroup.rotation.x = THREE.MathUtils.lerp(
                this.weaponGroup.rotation.x, 0, deltaTime * 3);
        }
        
        // Aplica efeito de recuo se tiver atirado recentemente
        if (this.recoilAnimation) {
            this.updateRecoilAnimation(deltaTime);
        }
    }
    
    /**
     * Atualiza a animação de recuo da arma
     * @param {number} deltaTime - Tempo desde o último frame
     */
    updateRecoilAnimation(deltaTime) {
        if (!this.recoilAnimation) return;
        
        // Atualiza o timer da animação
        this.recoilAnimation.time += deltaTime;
        
        if (this.recoilAnimation.time < this.recoilAnimation.duration) {
            const progress = this.recoilAnimation.time / this.recoilAnimation.duration;
            
            // Fase inicial do recuo (recuo para trás)
            if (progress < 0.3) {
                const recuoPhase = progress / 0.3;
                this.weaponGroup.position.z = -0.8 - this.recoilAnimation.amount * recuoPhase;
                this.weaponGroup.position.y = -0.4 + this.recoilAnimation.amount * 0.5 * recuoPhase;
            } 
            // Fase de retorno (volta à posição)
            else {
                const returnPhase = (progress - 0.3) / 0.7;
                this.weaponGroup.position.z = -0.8 - this.recoilAnimation.amount * (1 - returnPhase);
                this.weaponGroup.position.y = -0.4 + this.recoilAnimation.amount * 0.5 * (1 - returnPhase);
            }
        } else {
            // Finaliza a animação
            this.weaponGroup.position.z = -0.8;
            this.recoilAnimation = null;
        }
    }
} 