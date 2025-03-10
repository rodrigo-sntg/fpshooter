/**
 * Gerenciador de rede para conexões multiplayer
 * Responsável pela comunicação entre cliente e servidor via WebSockets
 */
import { PLAYER } from './config.js';

export class NetworkManager {
    /**
     * Inicializa o gerenciador de rede
     * @param {Object} gameState - Referência ao estado do jogo
     * @param {Object} player - Referência ao jogador local
     */
    constructor(gameState, player) {
        // Referências
        this.gameState = gameState;
        this.player = player;
        
        // Estado da conexão
        this.connected = false;
        this.connecting = false;
        this.serverUrl = null;
        this.socket = null;
        this.playerId = null;
        this.authToken = null;
        this.latency = 0;
        
        // Estado do jogo remoto
        this.remotePlayers = new Map(); // id -> playerObject
        this.remoteProjectiles = new Map(); // id -> projectileObject
        
        // Input prediction
        this.pendingInputs = [];
        this.sequenceNumber = 0;
        
        // Timestamp para cálculo de latência
        this.lastPingTime = 0;
        this.pingInterval = null;
        
        // UI update
        this.uiUpdateTimer = null;
        
        console.log("NetworkManager: Inicializado");
    }
    
    /**
     * Conecta ao servidor multiplayer
     * @param {string} serverUrl - URL do servidor WebSocket
     * @param {string} authToken - Token de autenticação (opcional)
     * @returns {Promise} - Promessa que resolve quando conectado
     */
    connect(serverUrl, authToken = null) {
        if (this.connected || this.connecting) {
            console.warn("NetworkManager: Já está conectado ou conectando");
            return Promise.reject("Já conectado ou tentando conectar");
        }
        
        this.connecting = true;
        this.serverUrl = serverUrl;
        this.authToken = authToken;
        
        console.log(`NetworkManager: Conectando ao servidor ${serverUrl}`);
        
        return new Promise((resolve, reject) => {
            try {
                // Constrói a URL completa com token se fornecido
                const fullUrl = authToken 
                    ? `${serverUrl}?token=${authToken}`
                    : serverUrl;
                
                // Cria a conexão WebSocket
                this.socket = new WebSocket(fullUrl);
                
                // Configura os handlers de eventos
                this.socket.onopen = () => this._handleOpen(resolve);
                this.socket.onmessage = (event) => this._handleMessage(event);
                this.socket.onclose = (event) => this._handleClose(event);
                this.socket.onerror = (error) => this._handleError(error, reject);
                
                // Timeout para falha na conexão
                this.connectionTimeout = setTimeout(() => {
                    if (!this.connected) {
                        this.connecting = false;
                        reject("Tempo de conexão esgotado");
                        this.socket.close();
                    }
                }, 10000); // 10 segundos para timeout
            } catch (error) {
                this.connecting = false;
                console.error("NetworkManager: Erro ao conectar", error);
                reject(error);
            }
        });
    }
    
    /**
     * Desconecta do servidor
     */
    disconnect() {
        if (this.socket) {
            console.log("NetworkManager: Desconectando do servidor");
            
            // Limpa o intervalo de ping
            if (this.pingInterval) {
                clearInterval(this.pingInterval);
                this.pingInterval = null;
            }
            
            // Limpa o timeout de conexão
            if (this.connectionTimeout) {
                clearTimeout(this.connectionTimeout);
                this.connectionTimeout = null;
            }
            
            // Fecha o socket
            this.socket.close(1000, "Desconexão pelo cliente");
            this.socket = null;
            
            // Reseta o estado
            this.connected = false;
            this.connecting = false;
            this.playerId = null;
            this.remotePlayers.clear();
            this.remoteProjectiles.clear();
            this.pendingInputs = [];
        }
    }
    
    /**
     * Envia movimento do jogador para o servidor
     * @param {THREE.Vector3} position - Posição do jogador
     * @param {THREE.Vector3} velocity - Velocidade do jogador
     * @param {THREE.Euler} rotation - Rotação da câmera
     */
    sendPlayerUpdate(position, velocity, rotation) {
        if (!this.connected || !this.socket) return;
        
        const input = {
            position: {
                x: position.x,
                y: position.y,
                z: position.z
            },
            velocity: {
                x: velocity.x,
                y: velocity.y,
                z: velocity.z
            },
            rotation: {
                x: rotation.x,
                y: rotation.y,
                z: rotation.z
            },
            sequence: this.sequenceNumber++
        };
        
        // Armazena para client prediction
        this.pendingInputs.push(input);
        
        // Limita o tamanho da lista
        if (this.pendingInputs.length > 60) {
            this.pendingInputs.shift();
        }
        
        // Envia ao servidor
        this._sendMessage('input', input);
    }
    
    /**
     * Envia informação de tiro para o servidor
     * @param {THREE.Vector3} position - Posição inicial do projétil
     * @param {THREE.Vector3} direction - Direção do projétil
     */
    sendShoot(position, direction) {
        if (!this.connected || !this.socket) return;
        
        this._sendMessage('action', {
            action: 'shoot',
            position: {
                x: position.x,
                y: position.y,
                z: position.z
            },
            direction: {
                x: direction.x,
                y: direction.y,
                z: direction.z
            }
        });
    }
    
    /**
     * Envia ping para medir latência
     */
    sendPing() {
        if (!this.connected || !this.socket) return;
        
        this.lastPingTime = Date.now();
        this._sendMessage('ping', { timestamp: this.lastPingTime });
    }
    
    /**
     * Processa as atualizações do servidor e aplica ao estado do jogo
     * @param {Object} update - Dados de atualização do servidor
     */
    processServerUpdate(update) {
        // Processa jogadores remotos
        if (update.players) {
            for (const id in update.players) {
                // Ignora o jogador local
                if (id === this.playerId) {
                    // Reconcilia a posição do jogador local
                    this._reconcilePlayerState(update.players[id]);
                    continue;
                }
                
                const playerData = update.players[id];
                
                // Jogador existente - atualiza
                if (this.remotePlayers.has(id)) {
                    const remotePlayer = this.remotePlayers.get(id);
                    remotePlayer.position.set(
                        playerData.position.x,
                        playerData.position.y,
                        playerData.position.z
                    );
                    
                    if (playerData.rotation) {
                        remotePlayer.rotation.set(
                            playerData.rotation.x,
                            playerData.rotation.y,
                            playerData.rotation.z
                        );
                    }
                    
                    // Atualiza outros estados (saúde, etc.)
                    remotePlayer.health = playerData.health || PLAYER.HEALTH;
                    remotePlayer.lastUpdateTime = Date.now();
                } 
                // Novo jogador - cria
                else {
                    this._createRemotePlayer(id, playerData);
                }
            }
            
            // Remove jogadores que não foram atualizados
            this._cleanupStaleRemotePlayers();
        }
        
        // Processa projéteis remotos
        if (update.projectiles) {
            // Limpa projéteis antigos
            this.remoteProjectiles.clear();
            
            // Adiciona novos projéteis
            for (const id in update.projectiles) {
                const projectileData = update.projectiles[id];
                this._createOrUpdateRemoteProjectile(id, projectileData);
            }
        }
    }
    
    /**
     * Atualiza o gerenciador de rede (chamado a cada frame)
     * @param {number} deltaTime - Tempo desde o último frame
     */
    update(deltaTime) {
        if (!this.connected) return;
        
        // Atualiza a posição do jogador no servidor em intervalos
        if (this.player && this.updateTimer <= 0) {
            this.sendPlayerUpdate(
                this.player.position,
                this.player.velocity,
                this.player.rotation
            );
            
            // Redefine o temporizador (10 atualizações por segundo)
            this.updateTimer = 0.1;
            
            // Atualiza a lista de jogadores na UI a cada segundo
            if (window.game && window.game.uiManager) {
                // Apenas atualiza a cada segundo aproximadamente
                if (!this.uiUpdateTimer || this.uiUpdateTimer <= 0) {
                    const playersList = [];
                    
                    // Adiciona o jogador local
                    playersList.push({
                        id: this.playerId || 'local',
                        name: 'Você',
                        latency: this.latency,
                        isLocal: true
                    });
                    
                    // Adiciona jogadores remotos
                    this.remotePlayers.forEach((player, id) => {
                        playersList.push({
                            id,
                            name: player.name || `Jogador ${id}`,
                            latency: 0, // Sem informação de latência de outros jogadores
                            isLocal: false
                        });
                    });
                    
                    // Atualiza a UI
                    window.game.uiManager.updatePlayersList(playersList);
                    
                    // Redefine o timer (atualizar a cada segundo)
                    this.uiUpdateTimer = 1.0;
                } else {
                    this.uiUpdateTimer -= deltaTime;
                }
            }
        } else {
            this.updateTimer -= deltaTime;
        }
        
        // Atualiza projéteis remotos
        this.remoteProjectiles.forEach(projectile => {
            if (projectile.update) {
                projectile.update(deltaTime);
            }
        });
    }
    
    /**
     * Handler para quando a conexão é estabelecida
     * @private
     * @param {Function} resolvePromise - Função para resolver a promessa de conexão
     */
    _handleOpen(resolvePromise) {
        console.log("NetworkManager: Conectado ao servidor");
        
        this.connected = true;
        this.connecting = false;
        
        // Limpa o timeout de conexão
        if (this.connectionTimeout) {
            clearTimeout(this.connectionTimeout);
            this.connectionTimeout = null;
        }
        
        // Inicia o intervalo de ping
        this.pingInterval = setInterval(() => this.sendPing(), 2000);
        
        // Define temporizador de atualização
        this.updateTimer = 0;
        
        // Resolve a promessa de conexão
        resolvePromise();
    }
    
    /**
     * Handler para mensagens recebidas do servidor
     * @private
     * @param {MessageEvent} event - Evento de mensagem
     */
    _handleMessage(event) {
        try {
            const message = JSON.parse(event.data);
            
            switch (message.type) {
                case 'connected':
                    this.playerId = message.data.id;
                    console.log(`NetworkManager: ID atribuído: ${this.playerId}`);
                    break;
                    
                case 'update':
                    this.processServerUpdate(message.data);
                    break;
                    
                case 'pong':
                    // Calcula latência
                    this.latency = Date.now() - message.data.timestamp;
                    break;
                    
                case 'error':
                    console.error(`NetworkManager: Erro do servidor: ${message.data.message}`);
                    break;
                    
                default:
                    console.warn(`NetworkManager: Tipo de mensagem desconhecido: ${message.type}`);
            }
        } catch (error) {
            console.error("NetworkManager: Erro ao processar mensagem", error);
        }
    }
    
    /**
     * Handler para fechamento da conexão
     * @private
     * @param {CloseEvent} event - Evento de fechamento
     */
    _handleClose(event) {
        console.log(`NetworkManager: Desconectado do servidor: ${event.reason}`);
        
        // Limpa o intervalo de ping
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
        
        // Limpa o timeout de conexão
        if (this.connectionTimeout) {
            clearTimeout(this.connectionTimeout);
            this.connectionTimeout = null;
        }
        
        // Reseta o estado
        this.connected = false;
        this.connecting = false;
        this.socket = null;
        this.playerId = null;
        
        // Evento de desconexão
        if (this.onDisconnect) {
            this.onDisconnect(event.reason);
        }
    }
    
    /**
     * Handler para erros de conexão
     * @private
     * @param {Event} error - Evento de erro
     * @param {Function} rejectPromise - Função para rejeitar a promessa de conexão
     */
    _handleError(error, rejectPromise) {
        console.error("NetworkManager: Erro de WebSocket", error);
        
        // Rejeita a promessa se ainda estiver conectando
        if (this.connecting && rejectPromise) {
            this.connecting = false;
            rejectPromise(error);
        }
    }
    
    /**
     * Envia uma mensagem para o servidor
     * @private
     * @param {string} type - Tipo da mensagem
     * @param {Object} data - Dados da mensagem
     */
    _sendMessage(type, data) {
        if (!this.connected || !this.socket) return;
        
        try {
            this.socket.send(JSON.stringify({
                type,
                data
            }));
        } catch (error) {
            console.error(`NetworkManager: Erro ao enviar mensagem ${type}`, error);
        }
    }
    
    /**
     * Cria um jogador remoto
     * @private
     * @param {string} id - ID do jogador
     * @param {Object} data - Dados do jogador
     */
    _createRemotePlayer(id, data) {
        // Implementação específica dependendo da estrutura do jogo
        console.log(`NetworkManager: Criando jogador remoto [${id}]`);
        
        // Cria um objeto temporário para o jogador remoto
        const remotePlayer = {
            id,
            position: new THREE.Vector3(
                data.position.x,
                data.position.y,
                data.position.z
            ),
            rotation: new THREE.Euler(
                data.rotation?.x || 0,
                data.rotation?.y || 0,
                data.rotation?.z || 0,
                'YXZ'
            ),
            health: data.health || PLAYER.HEALTH,
            lastUpdateTime: Date.now(),
            mesh: null // Será preenchido quando o jogador for visualizado
        };
        
        // Adiciona ao mapa de jogadores remotos
        this.remotePlayers.set(id, remotePlayer);
        
        // Notifica a criação de um novo jogador
        if (this.onPlayerJoined) {
            this.onPlayerJoined(remotePlayer);
        }
    }
    
    /**
     * Cria ou atualiza um projétil remoto
     * @private
     * @param {string} id - ID do projétil
     * @param {Object} data - Dados do projétil
     */
    _createOrUpdateRemoteProjectile(id, data) {
        // Implementação específica dependendo da estrutura do jogo
        if (!this.remoteProjectiles.has(id)) {
            // Cria objeto temporário para o projétil
            const remoteProjectile = {
                id,
                position: new THREE.Vector3(
                    data.position.x,
                    data.position.y,
                    data.position.z
                ),
                direction: new THREE.Vector3(
                    data.direction.x,
                    data.direction.y,
                    data.direction.z
                ),
                speed: data.speed || 0,
                owner: data.owner || null,
                isPlayerBullet: data.owner === this.playerId,
                update: function(deltaTime) {
                    // Atualiza posição baseado na direção
                    this.position.addScaledVector(this.direction, this.speed * deltaTime);
                }
            };
            
            this.remoteProjectiles.set(id, remoteProjectile);
        } else {
            // Atualiza projétil existente
            const projectile = this.remoteProjectiles.get(id);
            projectile.position.set(
                data.position.x,
                data.position.y,
                data.position.z
            );
            
            if (data.direction) {
                projectile.direction.set(
                    data.direction.x,
                    data.direction.y,
                    data.direction.z
                );
            }
        }
    }
    
    /**
     * Remove jogadores remotos que não foram atualizados recentemente
     * @private
     */
    _cleanupStaleRemotePlayers() {
        const now = Date.now();
        const staleTimeout = 5000; // 5 segundos
        
        this.remotePlayers.forEach((player, id) => {
            if (now - player.lastUpdateTime > staleTimeout) {
                console.log(`NetworkManager: Removendo jogador remoto inativo [${id}]`);
                
                // Notifica a saída de um jogador
                if (this.onPlayerLeft) {
                    this.onPlayerLeft(player);
                }
                
                this.remotePlayers.delete(id);
            }
        });
    }
    
    /**
     * Reconcilia o estado do jogador local com o estado do servidor
     * @private
     * @param {Object} serverState - Estado do jogador no servidor
     */
    _reconcilePlayerState(serverState) {
        // Não implementar reconciliação plena nesta versão - apenas logs
        console.log("NetworkManager: Reconciliando estado do jogador local");
        
        // Remove inputs já processados pelo servidor
        if (serverState.lastProcessedSequence) {
            this.pendingInputs = this.pendingInputs.filter(input => 
                input.sequence > serverState.lastProcessedSequence
            );
        }
        
        // Avançada: implementar correção de posição e reaplicação de inputs pendentes
    }
} 