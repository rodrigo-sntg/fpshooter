/**
 * Classe que representa um projétil no jogo
 * Gerencia o movimento, colisão e comportamento das balas
 */
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.157.0/build/three.module.js';
import { WEAPON } from './config.js';

// Objetos compartilhados para reduzir alocações de memória
const SHARED = {
    // Geometrias compartilhadas (reduz alocações de memória)
    geometries: {
        playerBullet: new THREE.SphereGeometry(0.1, 6, 6), // Reduzido de 8,8 para 6,6 segmentos
        enemyBullet: new THREE.SphereGeometry(0.15, 6, 6)
    },
    
    // Materiais compartilhados
    materials: {
        playerBullet: new THREE.MeshBasicMaterial({ color: 0xffff00 }),
        enemyBullet: new THREE.MeshBasicMaterial({ color: 0xff0000 })
    },
    
    // Vetores temporários para cálculos (reutilizados)
    tempVector: new THREE.Vector3(),
    tempDirection: new THREE.Vector3(),
    
    // Pool para reutilização de objetos
    pool: [],
    maxPoolSize: 100, // Aumentado para 100 para reutilizar mais objetos
    
    // Contadores para estatísticas de desempenho
    stats: {
        created: 0,
        recycled: 0,
        reused: 0
    }
};

export class Bullet {
    /**
     * Obtém uma instância de projétil, do pool ou nova
     * @param {THREE.Vector3} position - Posição inicial do projétil
     * @param {THREE.Vector3} direction - Direção de movimento (normalizada)
     * @param {boolean} isPlayerBullet - Se o projétil é do jogador (true) ou inimigo (false)
     * @returns {Bullet} - Instância de projétil
     */
    static get(position, direction, isPlayerBullet) {
        // Tenta obter do pool
        if (SHARED.pool.length > 0) {
            const bullet = SHARED.pool.pop();
            bullet.reset(position, direction, isPlayerBullet);
            SHARED.stats.reused++;
            return bullet;
        }
        
        // Cria nova instância se não tem no pool
        SHARED.stats.created++;
        return new Bullet(position, direction, isPlayerBullet);
    }
    
    /**
     * Devolve o projétil ao pool para reutilização
     * @param {Bullet} bullet - Projétil a ser reciclado
     */
    static recycle(bullet) {
        // Limpa referências e reseta estado
        bullet.hasCollided = true;
        bullet.addedToScene = false;
        
        // Limita o tamanho do pool
        if (SHARED.pool.length < SHARED.maxPoolSize) {
            SHARED.pool.push(bullet);
            SHARED.stats.recycled++;
        }
    }
    
    /**
     * Cria um novo projétil
     * @param {THREE.Vector3} position - Posição inicial
     * @param {THREE.Vector3} direction - Direção de movimento
     * @param {boolean} isPlayerBullet - Se é projétil do jogador
     */
    constructor(position, direction, isPlayerBullet = true) {
        // Propriedades básicas
        this.position = position.clone();
        this.direction = direction.clone().normalize();
        this.isPlayerBullet = isPlayerBullet;
        this.speed = isPlayerBullet ? WEAPON.BULLET_SPEED * 2 : WEAPON.BULLET_SPEED * 1.5;
        this.distance = 0;
        this.hasCollided = false;
        this.addedToScene = false;
        this.maxDistance = isPlayerBullet ? WEAPON.RANGE * 2 : WEAPON.RANGE * 1.5;
        this.damage = isPlayerBullet ? WEAPON.DAMAGE : 10;
        
        // Usar geometrias e materiais compartilhados (reduz uso de memória)
        const geometry = isPlayerBullet ? SHARED.geometries.playerBullet : SHARED.geometries.enemyBullet;
        const material = isPlayerBullet ? SHARED.materials.playerBullet : SHARED.materials.enemyBullet;
        
        // Criar o mesh do projétil
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.copy(position);
        
        // Campos otimizados
        this._boundingBox = new THREE.Box3();
        this._boundingBoxNeedsUpdate = true;
        
        // NOTA: Removida a criação de luzes dinâmicas para melhorar desempenho
    }
    
    /**
     * Reseta o projétil para reutilização
     * @param {THREE.Vector3} position - Nova posição
     * @param {THREE.Vector3} direction - Nova direção
     * @param {boolean} isPlayerBullet - Se é projétil do jogador
     */
    reset(position, direction, isPlayerBullet) {
        // Reseta estado
        this.position.copy(position);
        this.direction.copy(direction).normalize();
        this.isPlayerBullet = isPlayerBullet;
        this.distance = 0;
        this.hasCollided = false;
        this.addedToScene = false;
        this._boundingBoxNeedsUpdate = true;
        
        // Configura propriedades baseadas no tipo
        this.speed = isPlayerBullet ? WEAPON.BULLET_SPEED * 2 : WEAPON.BULLET_SPEED * 1.5;
        this.maxDistance = isPlayerBullet ? WEAPON.RANGE * 2 : WEAPON.RANGE * 1.5;
        this.damage = isPlayerBullet ? WEAPON.DAMAGE : 10;
        
        // Atualiza a geometria e material se necessário
        if (isPlayerBullet) {
            this.mesh.geometry = SHARED.geometries.playerBullet;
            this.mesh.material = SHARED.materials.playerBullet;
        } else {
            this.mesh.geometry = SHARED.geometries.enemyBullet;
            this.mesh.material = SHARED.materials.enemyBullet;
        }
        
        // Atualiza posição do mesh
        this.mesh.position.copy(position);
    }
    
    /**
     * Obtém a bounding box para colisão
     */
    get boundingBox() {
        if (this._boundingBoxNeedsUpdate) {
            this._boundingBox.setFromObject(this.mesh);
            this._boundingBoxNeedsUpdate = false;
        }
        return this._boundingBox;
    }
    
    /**
     * Atualiza o projétil
     * @param {number} deltaTime - Tempo desde o último frame
     */
    update(deltaTime) {
        if (this.hasCollided) return;
        
        // Movimento mais eficiente, reduzindo alocações
        const moveDistance = this.speed * Math.max(deltaTime, 0.01);
        this.distance += moveDistance;
        
        // Atualiza posição, evitando criar novos vetores
        SHARED.tempDirection.copy(this.direction).multiplyScalar(moveDistance);
        this.position.add(SHARED.tempDirection);
        
        // Atualiza posição do mesh
        this.mesh.position.copy(this.position);
        
        // Bounding box precisa ser atualizada
        this._boundingBoxNeedsUpdate = true;
        
        // Verifica se alcançou a distância máxima
        if (this.distance > this.maxDistance) {
            this.hasCollided = true;
        }
    }
    
    /**
     * Verifica colisão com outro objeto
     * @param {Object} object - Objeto para verificar colisão
     * @returns {boolean} - Verdadeiro se colidiu
     */
    checkCollision(object) {
        if (this.hasCollided) return false;
        
        // Verificação rápida de distância antes de calcular bounding box
        if (object.position) {
            const distanceSq = this.position.distanceToSquared(object.position);
            
            // Aumentando o raio de colisão para melhorar detecção
            // Usando 16 (4²) para inimigos normais ou 25 (5²) para sentinelas
            const collisionRadiusSq = object.type === 'basic' ? 25 : 16;
            
            // Otimização: usa distância ao quadrado para evitar cálculo de raiz quadrada
            if (distanceSq <= collisionRadiusSq) {
                console.log(`Colisão por distância detectada: ${Math.sqrt(distanceSq).toFixed(2)} unidades`);
                this.hasCollided = true;
                return true;
            }
        }
        
        // Verifica colisão de bounding boxes como backup
        if (!this.hasCollided && object.boundingBox) {
            const collision = this.boundingBox.intersectsBox(object.boundingBox);
            if (collision) {
                this.hasCollided = true;
                return true;
            }
        }
        
        return false;
    }
    
    /**
     * Adiciona o projétil à cena
     * @param {THREE.Scene} scene - Cena onde adicionar
     */
    addToScene(scene) {
        if (!this.addedToScene) {
            scene.add(this.mesh);
            this.addedToScene = true;
        }
    }
    
    /**
     * Remove o projétil da cena
     * @param {THREE.Scene} scene - Cena de onde remover
     */
    removeFromScene(scene) {
        if (this.addedToScene) {
            scene.remove(this.mesh);
            this.addedToScene = false;
        }
    }
    
    /**
     * Marca o projétil como colidido e cria efeito
     */
    onCollision() {
        this.hasCollided = true;
    }
} 