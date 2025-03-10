/**
 * Classe que representa um jogador remoto controlado pela rede
 */
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.157.0/build/three.module.js';
import { PLAYER } from './config.js';

// Variável para armazenar o modelo base que será clonado para todos os jogadores
let baseModelCache = null;
let isLoadingModel = false;
let modelLoadCallbacks = [];

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
        
        // Cor do jogador (aleatória por jogador)
        this.playerColor = new THREE.Color(
            0.3 + Math.random() * 0.7,
            0.3 + Math.random() * 0.7,
            0.3 + Math.random() * 0.7
        );
        
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
        try {
            console.log(`RemotePlayer: Iniciando criação do mesh para jogador [${this.id}]`);
            
            // Grupo principal
            this.mesh = new THREE.Group();
            this.mesh.position.copy(this.position);
            
            console.log(`RemotePlayer: Posição inicial do mesh: (${this.position.x.toFixed(2)}, ${this.position.y.toFixed(2)}, ${this.position.z.toFixed(2)})`);
            
            // Corpo do jogador - Usando um modelo humanoide simples feito a partir de formas básicas
            // Tronco (corpo principal)
            const bodyGeometry = new THREE.CapsuleGeometry(PLAYER.RADIUS, PLAYER.HEIGHT * 0.5, 8, 8);
            const bodyMaterial = new THREE.MeshStandardMaterial({ 
                color: this.playerColor,
                roughness: 0.7,
                metalness: 0.3
            });
            const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
            body.position.y = PLAYER.HEIGHT * 0.5;
            this.mesh.add(body);
            
            console.log(`RemotePlayer: Corpo adicionado ao mesh`);
            
            // Cabeça
            const headGeometry = new THREE.SphereGeometry(PLAYER.RADIUS * 0.8, 16, 16);
            const headMaterial = new THREE.MeshStandardMaterial({ 
                color: this.playerColor,
                roughness: 0.7,
                metalness: 0.3
            });
            const head = new THREE.Mesh(headGeometry, headMaterial);
            head.position.y = PLAYER.HEIGHT * 0.8;
            this.mesh.add(head);
            
            // Braços
            const armGeometry = new THREE.CapsuleGeometry(PLAYER.RADIUS * 0.3, PLAYER.HEIGHT * 0.4, 8, 8);
            const armMaterial = new THREE.MeshStandardMaterial({ 
                color: this.playerColor, 
                roughness: 0.7,
                metalness: 0.3
            });
            
            // Braço esquerdo
            const leftArm = new THREE.Mesh(armGeometry, armMaterial);
            leftArm.position.set(-PLAYER.RADIUS * 1.2, PLAYER.HEIGHT * 0.5, 0);
            leftArm.rotation.z = -Math.PI / 8;
            this.mesh.add(leftArm);
            
            // Braço direito
            const rightArm = new THREE.Mesh(armGeometry, armMaterial);
            rightArm.position.set(PLAYER.RADIUS * 1.2, PLAYER.HEIGHT * 0.5, 0);
            rightArm.rotation.z = Math.PI / 8;
            this.mesh.add(rightArm);
            
            // Pernas
            const legGeometry = new THREE.CapsuleGeometry(PLAYER.RADIUS * 0.3, PLAYER.HEIGHT * 0.5, 8, 8);
            const legMaterial = new THREE.MeshStandardMaterial({ 
                color: this.playerColor, 
                roughness: 0.7,
                metalness: 0.3
            });
            
            // Perna esquerda
            const leftLeg = new THREE.Mesh(legGeometry, legMaterial);
            leftLeg.position.set(-PLAYER.RADIUS * 0.6, PLAYER.HEIGHT * 0.1, 0);
            this.mesh.add(leftLeg);
            
            // Perna direita
            const rightLeg = new THREE.Mesh(legGeometry, legMaterial);
            rightLeg.position.set(PLAYER.RADIUS * 0.6, PLAYER.HEIGHT * 0.1, 0);
            this.mesh.add(rightLeg);
            
            // Arma (representação básica)
            const gunGeometry = new THREE.BoxGeometry(PLAYER.RADIUS * 0.8, PLAYER.RADIUS * 0.4, PLAYER.RADIUS * 2.5);
            const gunMaterial = new THREE.MeshStandardMaterial({ 
                color: 0x444444, 
                roughness: 0.5,
                metalness: 0.7
            });
            const gun = new THREE.Mesh(gunGeometry, gunMaterial);
            gun.position.set(PLAYER.RADIUS * 1.2, PLAYER.HEIGHT * 0.4, -PLAYER.RADIUS * 1.5);
            this.mesh.add(gun);
            
            // Adiciona um texto flutuante com o ID do jogador
            this.addPlayerLabel();
            
            // Barra de vida com cores mais vibrantes
            this.createHealthBar();
            
            // Adiciona à cena
            if (this.scene) {
                // Garantir que o mesh tem valores válidos antes de adicionar
                this.mesh.matrixAutoUpdate = true;
                this.mesh.matrixWorldAutoUpdate = true;
                
                // Teste de visibilidade - aumentar o tamanho para debugar
                this.mesh.scale.set(3, 3, 3);
                
                this.scene.add(this.mesh);
                console.log(`RemotePlayer: Jogador [${this.id}] adicionado à cena em posição:`, 
                   `x: ${this.position.x.toFixed(2)}, y: ${this.position.y.toFixed(2)}, z: ${this.position.z.toFixed(2)}`);
                   
                // Verifica se o mesh foi realmente adicionado
                console.log(`RemotePlayer: Mesh está na cena: ${this.mesh.parent === this.scene}`);
                console.log(`RemotePlayer: Número de elementos na cena: ${this.scene.children.length}`);
            } else {
                console.error(`RemotePlayer: Não foi possível adicionar o jogador [${this.id}] à cena: cena indisponível`);
            }
        } catch (error) {
            console.error(`RemotePlayer: Erro ao criar mesh do jogador [${this.id}]:`, error);
        }
    }
    
    /**
     * Adiciona um texto flutuante acima do jogador com seu ID
     */
    addPlayerLabel() {
        // Criar um canvas para renderizar o texto
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 256;
        canvas.height = 128;
        
        // Definir o estilo do texto
        context.font = 'Bold 40px Arial';
        context.fillStyle = 'white';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        
        // Desenhar um fundo para o texto
        context.fillStyle = 'rgba(0, 0, 0, 0.7)';
        context.fillRect(0, 0, canvas.width, canvas.height);
        
        // Desenhar o texto
        context.fillStyle = 'yellow';
        context.fillText(`Jogador ${this.id}`, canvas.width / 2, canvas.height / 2);
        
        // Criar uma textura a partir do canvas
        const texture = new THREE.CanvasTexture(canvas);
        
        // Criar material e geometria para o sprite
        const material = new THREE.SpriteMaterial({ map: texture });
        const sprite = new THREE.Sprite(material);
        
        // Posicionar o sprite acima do jogador
        sprite.position.set(0, PLAYER.HEIGHT * 1.8, 0);
        sprite.scale.set(3, 1.5, 1);
        
        // Adicionar o sprite ao mesh
        this.mesh.add(sprite);
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
        try {
            if (!data) {
                console.warn(`RemotePlayer: Dados de rede inválidos para jogador [${this.id}]`);
                return;
            }
            
            // Sempre logar na atualização inicial e ocasionalmente depois
            const initialUpdate = !this.lastUpdateTime;
            const shouldLog = initialUpdate || Math.random() < 0.05; // 5% das atualizações
            
            if (shouldLog) {
                console.log(`RemotePlayer: Atualizando jogador [${this.id}] com dados:`, JSON.stringify(data));
            }
            
            // Salva posição anterior para interpolação
            this.previousPosition.copy(this.position);
            
            // Atualiza posição alvo para interpolação
            if (data.position) {
                // Certificar-se de que os valores são numéricos válidos
                const x = Number(data.position.x) || 0;
                const y = Number(data.position.y) || 1.8; // Altura padrão se inválido
                const z = Number(data.position.z) || 0;
                
                this.targetPosition.set(x, y, z);
                
                if (shouldLog) {
                    console.log(`RemotePlayer: Nova posição alvo para jogador [${this.id}]: (${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)})`);
                }
                
                // Se a distância for muito grande, teleporta em vez de interpolar
                const distanceToTarget = this.position.distanceTo(this.targetPosition);
                if (distanceToTarget > 10 || initialUpdate) {
                    console.log(`RemotePlayer: TELEPORTE do jogador [${this.id}] de (${this.position.x.toFixed(1)}, ${this.position.y.toFixed(1)}, ${this.position.z.toFixed(1)}) para (${this.targetPosition.x.toFixed(1)}, ${this.targetPosition.y.toFixed(1)}, ${this.targetPosition.z.toFixed(1)})`);
                    this.position.copy(this.targetPosition);
                    
                    // Atualiza o mesh também se existir
                    if (this.mesh) {
                        this.mesh.position.copy(this.position);
                        
                        if (shouldLog) {
                            console.log(`RemotePlayer: Mesh do jogador [${this.id}] teleportado para (${this.position.x.toFixed(2)}, ${this.position.y.toFixed(2)}, ${this.position.z.toFixed(2)})`);
                        }
                    }
                }
            }
            
            // Atualiza rotação diretamente
            if (data.rotation) {
                // Certificar-se de que os valores são numéricos válidos
                const x = Number(data.rotation.x) || 0;
                const y = Number(data.rotation.y) || 0;
                const z = Number(data.rotation.z) || 0;
                
                this.rotation.set(x, y, z);
                
                // Atualiza a rotação do mesh se existir
                if (this.mesh) {
                    this.mesh.rotation.y = this.rotation.y;
                    
                    if (shouldLog) {
                        console.log(`RemotePlayer: Rotação atualizada para jogador [${this.id}]: (${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)})`);
                    }
                }
            }
            
            // Atualiza atributos adicionais se disponíveis
            if (data.name) {
                this.name = data.name;
            }
            
            // Atualiza saúde se disponível
            if (data.health !== undefined) {
                this.health = data.health;
                this.updateHealthBar();
            }
            
            // Verifica se o mesh existe e está na cena
            if (!this.mesh) {
                console.error(`RemotePlayer: Mesh do jogador [${this.id}] não existe. Criando novamente...`);
                this.createMesh();
            } else if (this.mesh && !this.mesh.parent && this.scene) {
                console.error(`RemotePlayer: Mesh do jogador [${this.id}] não está na cena. Adicionando novamente...`);
                this.scene.add(this.mesh);
            }
            
            // Atualiza o timestamp da última atualização
            this.lastUpdateTime = Date.now();
        } catch (error) {
            console.error(`RemotePlayer: Erro ao atualizar jogador [${this.id}]:`, error);
        }
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
        try {
            // Para evitar logs excessivos, só logar ocasionalmente
            const shouldLog = Math.random() < 0.01; // 1% das atualizações
            
            // Detecção de jogador ausente da cena
            if (!this.mesh) {
                console.error(`RemotePlayer: ERRO CRÍTICO: Mesh do jogador [${this.id}] não encontrado. Tentando recriar...`);
                this.createMesh();
                return;
            }
            
            // Verifica se o mesh está na cena
            if (this.mesh && !this.mesh.parent && this.scene) {
                console.error(`RemotePlayer: ERRO: Mesh do jogador [${this.id}] não está na cena. Adicionando...`);
                this.scene.add(this.mesh);
            }
            
            // Interpolação suave da posição
            this.position.lerp(this.targetPosition, this.lerpFactor);
            
            // Atualiza posição do mesh
            if (this.mesh) {
                this.mesh.position.copy(this.position);
                
                // Atualiza rotação do corpo (apenas no eixo Y)
                this.mesh.rotation.y = this.rotation.y;
                
                if (shouldLog) {
                    console.log(`RemotePlayer: Atualizando posição do jogador [${this.id}] para (${this.position.x.toFixed(2)}, ${this.position.y.toFixed(2)}, ${this.position.z.toFixed(2)})`);
                    console.log(`RemotePlayer: Jogador [${this.id}] está visível na cena: ${this.mesh.visible} e é filho da cena: ${this.mesh.parent === this.scene}`);
                }
            }
            
            // A barra de saúde sempre olha para o jogador
            if (this.healthBarContainer) {
                // Obtém a câmera do jogo (se disponível através de window.game)
                const camera = window.game?.camera;
                if (camera) {
                    this.healthBarContainer.lookAt(camera.position);
                }
            }
        } catch (error) {
            console.error(`RemotePlayer: Erro ao atualizar jogador [${this.id}]:`, error);
        }
    }
    
    /**
     * Remove o jogador da cena
     */
    remove() {
        try {
            // Remove o mesh principal
            if (this.mesh) {
                // Remove da cena
                if (this.mesh.parent) {
                    this.mesh.parent.remove(this.mesh);
                } else if (this.scene) {
                    this.scene.remove(this.mesh);
                }
                
                // Percorre todos os filhos e libera recursos
                this.mesh.traverse(child => {
                    if (child.geometry) {
                        child.geometry.dispose();
                    }
                    
                    if (child.material) {
                        if (Array.isArray(child.material)) {
                            child.material.forEach(m => m.dispose());
                        } else {
                            child.material.dispose();
                        }
                    }
                });
                
                // Limpa referências
                this.mesh = null;
            }
            
            // Limpa outras referências
            this.scene = null;
            
            console.log(`RemotePlayer: Jogador remoto [${this.id}] removido e recursos liberados`);
        } catch (error) {
            console.error(`Erro ao remover jogador remoto [${this.id}]:`, error);
        }
    }
}

// Registra a classe RemotePlayer globalmente para que possa ser acessada pelo NetworkManager
window.RemotePlayer = RemotePlayer; 