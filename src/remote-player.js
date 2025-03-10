/**
 * Classe que representa um jogador remoto controlado pela rede
 */
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.157.0/build/three.module.js';
import { PLAYER } from './config.js';

export class RemotePlayer {
    /**
     * Cria um jogador remoto
     * @param {string} id - ID único do jogador
     * @param {Object} initialData - Dados iniciais do jogador
     * @param {THREE.Scene} scene - Cena onde o jogador será renderizado
     */
    constructor(id, initialData, scene) {
        // Identificação
        this.id = id;
        
        // Referência à cena
        this.scene = scene;
        
        // Propriedades básicas
        this.position = new THREE.Vector3();
        this.rotation = new THREE.Euler(0, 0, 0, 'YXZ');
        this.health = PLAYER.HEALTH;
        this.lastUpdateTime = Date.now();
        
        // Para interpolação
        this.targetPosition = new THREE.Vector3();
        this.previousPosition = new THREE.Vector3();
        this.lerpFactor = 0.2; // Fator de suavização
        
        // Representação visual
        this.mesh = null;
        
        // Inicializa com os dados recebidos
        this.updateFromNetworkData(initialData);
        
        // Cria a representação visual
        this.createMesh();
        
        console.log(`RemotePlayer: Jogador remoto [${id}] criado`);
    }
    
    /**
     * Cria a representação visual do jogador remoto
     */
    createMesh() {
        // Grupo principal
        this.mesh = new THREE.Group();
        this.mesh.position.copy(this.position);
        
        // Corpo do jogador
        const bodyGeometry = new THREE.CapsuleGeometry(PLAYER.RADIUS, PLAYER.HEIGHT - PLAYER.RADIUS * 2, 8, 8);
        
        // Material com cor diferente para jogador remoto (azul)
        const bodyMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x0088ff, 
            metalness: 0.1,
            roughness: 0.5
        });
        
        // Cria o mesh do corpo
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.position.y = PLAYER.HEIGHT / 2;
        this.mesh.add(body);
        
        // Adiciona um indicador de direção (para ver para onde está olhando)
        const directionMarkerGeometry = new THREE.ConeGeometry(0.2, 0.5, 8);
        const directionMarkerMaterial = new THREE.MeshStandardMaterial({ 
            color: 0xffff00, 
            metalness: 0.1,
            roughness: 0.5 
        });
        
        this.directionMarker = new THREE.Mesh(directionMarkerGeometry, directionMarkerMaterial);
        this.directionMarker.position.set(0, PLAYER.HEIGHT, -0.5);
        this.directionMarker.rotation.x = Math.PI / 2;
        this.mesh.add(this.directionMarker);
        
        // Barra de vida
        this.createHealthBar();
        
        // Adiciona à cena
        if (this.scene) {
            this.scene.add(this.mesh);
        }
    }
    
    /**
     * Cria uma barra de vida acima do jogador
     */
    createHealthBar() {
        // Container para a barra
        this.healthBarContainer = new THREE.Group();
        this.healthBarContainer.position.set(0, PLAYER.HEIGHT + 0.5, 0);
        
        // Fundo da barra
        const backGeometry = new THREE.PlaneGeometry(1, 0.1);
        const backMaterial = new THREE.MeshBasicMaterial({ 
            color: 0x333333, 
            side: THREE.DoubleSide 
        });
        const back = new THREE.Mesh(backGeometry, backMaterial);
        this.healthBarContainer.add(back);
        
        // Barra de vida
        const barGeometry = new THREE.PlaneGeometry(1, 0.1);
        const barMaterial = new THREE.MeshBasicMaterial({ 
            color: 0x00ff00, 
            side: THREE.DoubleSide 
        });
        this.healthBar = new THREE.Mesh(barGeometry, barMaterial);
        this.healthBar.position.z = 0.01; // Ligeiramente à frente
        this.healthBarContainer.add(this.healthBar);
        
        // Adiciona ao mesh principal
        this.mesh.add(this.healthBarContainer);
        
        // Configura para sempre olhar para a câmera
        this.healthBarContainer.lookAt(0, 0, 0);
    }
    
    /**
     * Atualiza o jogador com base nos dados da rede
     * @param {Object} data - Dados recebidos da rede
     */
    updateFromNetworkData(data) {
        if (!data) return;
        
        // Salva posição anterior para interpolação
        this.previousPosition.copy(this.position);
        
        // Atualiza posição alvo para interpolação
        if (data.position) {
            this.targetPosition.set(
                data.position.x,
                data.position.y,
                data.position.z
            );
        }
        
        // Atualiza rotação diretamente
        if (data.rotation) {
            this.rotation.set(
                data.rotation.x,
                data.rotation.y,
                data.rotation.z
            );
        }
        
        // Atualiza saúde
        if (data.health !== undefined) {
            this.health = data.health;
            this.updateHealthBar();
        }
        
        // Marca o tempo de atualização
        this.lastUpdateTime = Date.now();
    }
    
    /**
     * Atualiza a aparência da barra de vida
     */
    updateHealthBar() {
        if (!this.healthBar) return;
        
        // Atualiza escala da barra de acordo com a saúde
        const healthRatio = this.health / PLAYER.HEALTH;
        this.healthBar.scale.x = Math.max(0, healthRatio);
        
        // Atualiza cor da barra baseado na saúde
        if (healthRatio > 0.6) {
            this.healthBar.material.color.setHex(0x00ff00); // Verde
        } else if (healthRatio > 0.3) {
            this.healthBar.material.color.setHex(0xffff00); // Amarelo
        } else {
            this.healthBar.material.color.setHex(0xff0000); // Vermelho
        }
    }
    
    /**
     * Atualiza o estado do jogador remoto (chamado a cada frame)
     * @param {number} deltaTime - Tempo desde o último frame
     */
    update(deltaTime) {
        // Interpolação suave da posição
        this.position.lerp(this.targetPosition, this.lerpFactor);
        
        // Atualiza posição do mesh
        if (this.mesh) {
            this.mesh.position.copy(this.position);
            
            // Atualiza rotação do corpo (apenas no eixo Y)
            this.mesh.rotation.y = this.rotation.y;
            
            // A barra de saúde sempre olha para o jogador
            if (this.healthBarContainer) {
                // Obtém a câmera do jogo (se disponível através de window.game)
                const camera = window.game?.sceneManager?.camera;
                if (camera) {
                    this.healthBarContainer.lookAt(camera.position);
                }
            }
        }
    }
    
    /**
     * Remove o jogador da cena
     */
    remove() {
        if (this.mesh && this.scene) {
            this.scene.remove(this.mesh);
            
            // Libera recursos
            if (this.mesh.geometry) {
                this.mesh.geometry.dispose();
            }
            
            if (this.mesh.material) {
                if (Array.isArray(this.mesh.material)) {
                    this.mesh.material.forEach(m => m.dispose());
                } else {
                    this.mesh.material.dispose();
                }
            }
            
            this.mesh = null;
        }
        
        console.log(`RemotePlayer: Jogador remoto [${this.id}] removido`);
    }
} 