/**
 * Classe que representa um projétil no jogo
 * Gerencia o movimento, colisão e comportamento das balas
 */
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.157.0/build/three.module.js';
import { WEAPON } from './config.js';

export class Bullet {
    /**
     * Cria um novo projétil
     * @param {THREE.Vector3} position - Posição inicial do projétil
     * @param {THREE.Vector3} direction - Direção de movimento do projétil (normalizada)
     * @param {boolean} isPlayerBullet - Indica se o projétil é do jogador (true) ou de um inimigo (false)
     */
    constructor(position, direction, isPlayerBullet = true) {
        // Propriedades básicas
        this.position = position;
        this.direction = direction.normalize();
        this.isPlayerBullet = isPlayerBullet;
        this.speed = isPlayerBullet ? WEAPON.BULLET_SPEED * 2 : WEAPON.BULLET_SPEED * 1.5; // Velocidade adequada
        this.distance = 0; // Distância percorrida
        this.hasCollided = false;
        this.addedToScene = false; // Flag para rastrear se foi adicionado à cena
        this.maxDistance = isPlayerBullet ? WEAPON.RANGE * 2 : WEAPON.RANGE * 1.5; // Alcance adequado
        
        // Propriedades relacionadas ao dano
        this.damage = isPlayerBullet ? WEAPON.DAMAGE : 10; // Dano padrão para balas de inimigos
        
        // Criar a geometria e material da bala
        // Tamanho maior para projéteis inimigos para torná-los mais visíveis
        const bulletSize = isPlayerBullet ? 0.1 : 0.15;
        const geometry = new THREE.SphereGeometry(bulletSize, 8, 8);
        
        // Cores diferentes: amarelo para jogador, vermelho para inimigos
        const bulletColor = isPlayerBullet ? 0xffff00 : 0xff0000;
        const material = new THREE.MeshBasicMaterial({
            color: bulletColor,
            // MeshBasicMaterial não suporta emissive, usando apenas cor brilhante
        });
        
        // Criar o mesh
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.copy(position);
        
        // Raycaster para detecção de colisão
        this.raycaster = new THREE.Raycaster(position, direction, 0, 0.2);
        
        // Bounding box para colisão
        this.boundingBox = new THREE.Box3().setFromObject(this.mesh);
    }
    
    /**
     * Atualiza a posição e estado do projétil
     * @param {number} deltaTime - Tempo desde o último frame em segundos
     */
    update(deltaTime) {
        // Se já colidiu, não atualiza
        if (this.hasCollided) return;
        
        // Calcula o movimento neste frame - usa valor fixo para evitar problemas com deltaTime muito pequeno
        const moveDistance = this.speed * Math.max(deltaTime, 0.01);
        this.distance += moveDistance;
        
        // Atualiza a posição
        this.position.x += this.direction.x * moveDistance;
        this.position.y += this.direction.y * moveDistance;
        this.position.z += this.direction.z * moveDistance;
        
        // Atualiza a posição do mesh
        this.mesh.position.copy(this.position);
        
        // Atualiza o raycaster para detectar colisões no próximo frame
        this.raycaster.set(this.position, this.direction);
        
        // Atualiza a bounding box
        this.boundingBox.setFromObject(this.mesh);
    }
    
    /**
     * Verifica colisão com um objeto
     * @param {Object} object - Objeto a verificar colisão (deve ter boundingBox)
     * @returns {boolean} - Verdadeiro se houve colisão
     */
    checkCollision(object) {
        // Verifica se o objeto tem uma bounding box
        if (!object.boundingBox) return false;
        
        // Se já colidiu, não verifica novamente
        if (this.hasCollided) return false;
        
        // Atualiza a bounding box do projétil
        this.boundingBox.setFromObject(this.mesh);
        
        // Verifica se as bounding boxes se intersectam
        const intersects = this.boundingBox.intersectsBox(object.boundingBox);
        
        // Aumenta o raio de colisão para sentinelas para facilitar acertos
        let collision = intersects;
        if (!intersects && object.isSentinel && this.isPlayerBullet) {
            // Calcula a distância entre o projétil e o sentinela
            const distance = this.mesh.position.distanceTo(object.position);
            
            // Se estiver dentro de um raio maior (1.5x), considera como acerto
            if (distance < 1.5) {
                collision = true;
            }
        }
        
        // Se houve colisão, processa os efeitos
        if (collision) {
            this.onCollision();
        }
        
        return collision;
    }
    
    /**
     * Verifica colisão com raycasting
     * @param {Array} objects - Array de objetos para verificar colisão
     * @param {number} maxDistance - Distância máxima para verificar colisão
     * @returns {Object|null} - Objeto de interseção ou null se não houver colisão
     */
    checkRayCollision(objects, maxDistance) {
        // Atualiza as propriedades do raycaster
        this.raycaster.far = maxDistance || 0.1;
        
        // Verifica interseções
        const intersects = this.raycaster.intersectObjects(objects, true);
        
        // Se houver interseção, colide
        if (intersects.length > 0) {
            this.onCollision();
            return intersects[0];
        }
        
        return null;
    }
    
    /**
     * Manipulador de evento de colisão
     */
    onCollision() {
        // Marca o projétil como colidido
        this.hasCollided = true;
        
        // Aqui podemos adicionar efeitos visuais, sons, etc.
        this.createImpactEffect();
    }
    
    /**
     * Cria um efeito visual de impacto
     */
    createImpactEffect() {
        // Placeholder para futura implementação de efeitos de partículas ou visuais
        // Por enquanto, apenas muda a cor do projétil para indicar colisão
        if (this.mesh.material) {
            this.mesh.material.color.set(0xffffff);
            this.mesh.material.opacity = 0.5;
            this.mesh.material.transparent = true;
            
            // Faz o projétil expandir e desaparecer
            this.mesh.scale.set(2, 2, 2);
        }
    }
    
    /**
     * Adiciona o projétil à cena
     * @param {THREE.Scene} scene - Cena onde o projétil será adicionado
     */
    addToScene(scene) {
        scene.add(this.mesh);
        this.addedToScene = true;
    }
    
    /**
     * Remove o projétil da cena
     * @param {THREE.Scene} scene - Cena de onde o projétil será removido
     */
    removeFromScene(scene) {
        scene.remove(this.mesh);
        
        // Libera recursos
        if (this.mesh.geometry) {
            this.mesh.geometry.dispose();
        }
        
        if (this.mesh.material) {
            this.mesh.material.dispose();
        }
    }
} 